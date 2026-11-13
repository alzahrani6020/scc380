import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@scc/database';
import { AccountingPostingService } from '../src/accounting-core/accounting-posting.service';
import { CostCentersService } from '../src/finance/cost-centers.service';

test(
  'Cost centers are tenant-scoped and report posted journal activity',
  { skip: process.env.ACCOUNTING_DB_E2E !== '1' ? 'ACCOUNTING_DB_E2E=1 is required' : false },
  async () => {
    const run = `${process.pid}-${Date.now()}`;
    const [tenantA, tenantB] = await Promise.all([
      prisma.tenant.create({ data: { name: `CC A ${run}`, slug: `cc-a-${run}` } }),
      prisma.tenant.create({ data: { name: `CC B ${run}`, slug: `cc-b-${run}` } }),
    ]);

    try {
      const [expenseA, cashA] = await Promise.all([
        prisma.chartOfAccount.create({
          data: { tenantId: tenantA.id, code: `CC-EXP-${run}`, name: 'Cost center expense', type: 'EXPENSE' },
        }),
        prisma.chartOfAccount.create({
          data: { tenantId: tenantA.id, code: `CC-CASH-${run}`, name: 'Cost center cash', type: 'ASSET' },
        }),
      ]);

      const service = new CostCentersService();
      const posting = new AccountingPostingService();
      const reqA: any = { user: { tenantId: tenantA.id, role: 'ADMIN' } };
      const reqB: any = { user: { tenantId: tenantB.id, role: 'ADMIN' } };

      const centerA = await service.create(reqA, {
        name: 'Operations',
        code: 'OPS',
        budget: 1000,
      });
      const centerB = await service.create(reqB, {
        name: 'Operations B',
        code: 'OPS',
        budget: 2000,
      });

      assert.equal(centerA.code, 'OPS');
      assert.equal(centerB.code, 'OPS');

      await posting.post({
        tenantId: tenantA.id,
        entryNumber: `CC-JV-${run}`,
        date: new Date('2026-11-13T08:00:00.000Z'),
        description: 'Cost center expense',
        lines: [
          { accountId: expenseA.id, debitAmount: 250, costCenterId: centerA.id },
          { accountId: cashA.id, creditAmount: 250, costCenterId: centerA.id },
        ],
      });

      const report = await service.report(reqA, centerA.id);
      assert.equal(report.lineCount, 2);
      assert.equal(report.totals.debit, 250);
      assert.equal(report.totals.credit, 250);
      assert.equal(report.totals.expenseActual, 250);
      assert.equal(report.totals.budget, 1000);
      assert.equal(report.totals.budgetVariance, 750);
      assert.equal(report.totals.budgetUsagePct, 25);

      await assert.rejects(
        () => service.findOne(reqB, centerA.id),
        /Cost center not found/,
      );

      await assert.rejects(
        () => service.remove(reqA, centerA.id),
        /journal history/,
      );
    } finally {
      await prisma.tenant.deleteMany({ where: { id: { in: [tenantA.id, tenantB.id] } } });
      await prisma.$disconnect();
    }
  },
);
