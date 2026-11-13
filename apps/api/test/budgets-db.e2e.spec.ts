import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@scc/database';
import { AccountingPostingService } from '../src/accounting-core/accounting-posting.service';
import { BudgetsService } from '../src/finance/budgets.service';

test(
  'Budgets report actuals by account/cost center and enforce approval lifecycle',
  { skip: process.env.ACCOUNTING_DB_E2E !== '1' ? 'ACCOUNTING_DB_E2E=1 is required' : false },
  async () => {
    const run = `${process.pid}-${Date.now()}`;
    const tenant = await prisma.tenant.create({
      data: { name: `BUD E2E ${run}`, slug: `bud-e2e-${run}` },
    });

    try {
      const [expense, cash] = await Promise.all([
        prisma.chartOfAccount.create({
          data: { tenantId: tenant.id, code: `BUD-EXP-${run}`, name: 'Budget expense', type: 'EXPENSE' },
        }),
        prisma.chartOfAccount.create({
          data: { tenantId: tenant.id, code: `BUD-CASH-${run}`, name: 'Budget cash', type: 'ASSET' },
        }),
      ]);
      const [ccA, ccB] = await Promise.all([
        prisma.costCenter.create({ data: { tenantId: tenant.id, name: 'Operations', code: `OPS-${run}` } }),
        prisma.costCenter.create({ data: { tenantId: tenant.id, name: 'Sales', code: `SAL-${run}` } }),
      ]);

      const posting = new AccountingPostingService();
      await posting.post({
        tenantId: tenant.id,
        entryNumber: `BUD-JV-A-${run}`,
        date: new Date('2027-01-15T12:00:00.000Z'),
        description: 'Operations expense',
        lines: [
          { accountId: expense.id, debitAmount: 100, costCenterId: ccA.id },
          { accountId: cash.id, creditAmount: 100, costCenterId: ccA.id },
        ],
      });
      await posting.post({
        tenantId: tenant.id,
        entryNumber: `BUD-JV-B-${run}`,
        date: new Date('2027-01-16T12:00:00.000Z'),
        description: 'Sales expense',
        lines: [
          { accountId: expense.id, debitAmount: 50, costCenterId: ccB.id },
          { accountId: cash.id, creditAmount: 50, costCenterId: ccB.id },
        ],
      });

      const service = new BudgetsService();
      const admin: any = { user: { tenantId: tenant.id, role: 'ADMIN', id: 'admin-test' } };
      const manager: any = { user: { tenantId: tenant.id, role: 'MANAGER', id: 'manager-test' } };

      const plan = await service.create(admin, { year: 2027, name: '2027 Approved Budget' });
      const line = await service.addLine(admin, plan.id, {
        month: 1,
        accountId: expense.id,
        costCenterId: ccA.id,
        amount: 300,
      });
      assert.equal(Number(line.amount), 300);

      await assert.rejects(
        () => service.addLine(admin, plan.id, {
          month: 1,
          accountId: expense.id,
          amount: 500,
        }),
        /already has cost-center allocations/,
      );

      let report = await service.report(admin, plan.id);
      assert.equal(report.rows.length, 1);
      assert.equal(report.rows[0].budget, 300);
      assert.equal(report.rows[0].actual, 100);
      assert.equal(report.rows[0].favorableVariance, 200);

      const approved = await service.approve(admin, plan.id);
      assert.equal(approved.status, 'APPROVED');
      await assert.rejects(
        () => service.addLine(admin, plan.id, {
          month: 2,
          accountId: expense.id,
          costCenterId: ccA.id,
          amount: 100,
        }),
        /immutable/,
      );

      await assert.rejects(
        () => service.reopen(manager, plan.id),
        /Only ADMIN or SUPER_ADMIN/,
      );
      const reopened = await service.reopen(admin, plan.id);
      assert.equal(reopened.status, 'DRAFT');

      report = await service.report(admin, plan.id);
      assert.equal(report.totals.budget, 300);
      assert.equal(report.totals.actual, 100);
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
      await prisma.$disconnect();
    }
  },
);
