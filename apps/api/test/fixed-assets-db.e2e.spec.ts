import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@scc/database';
import { AccountingPostingService } from '../src/accounting-core/accounting-posting.service';
import { FixedAssetsService } from '../src/finance/fixed-assets.service';

test(
  'Fixed asset depreciation posts atomically and respects closed periods',
  { skip: process.env.ACCOUNTING_DB_E2E !== '1' ? 'ACCOUNTING_DB_E2E=1 is required' : false },
  async () => {
    const run = `${process.pid}-${Date.now()}`;
    const tenant = await prisma.tenant.create({
      data: { name: `FA E2E ${run}`, slug: `fa-e2e-${run}` },
    });

    try {
      const [expense, accumulated] = await Promise.all([
        prisma.chartOfAccount.create({
          data: { tenantId: tenant.id, code: `DEP-EXP-${run}`, name: 'Depreciation expense', type: 'EXPENSE' },
        }),
        prisma.chartOfAccount.create({
          data: { tenantId: tenant.id, code: `ACC-DEP-${run}`, name: 'Accumulated depreciation', type: 'ASSET' },
        }),
      ]);

      await prisma.financialPeriod.create({
        data: {
          tenantId: tenant.id,
          name: 'December 2026',
          year: 2026,
          month: 12,
          startDate: new Date('2026-12-01T00:00:00.000Z'),
          endDate: new Date('2026-12-31T23:59:59.999Z'),
          isClosed: true,
          closedAt: new Date('2026-12-31T23:59:59.999Z'),
        },
      });

      const posting = new AccountingPostingService();
      const service = new FixedAssetsService(posting);
      const req: any = { user: { tenantId: tenant.id, role: 'ADMIN' } };

      const category = await service.createCategory(req, {
        name: 'Computers',
        code: 'COMP',
        usefulLifeYears: 5,
        depreciationMethod: 'STRAIGHT_LINE',
      });

      const asset = await service.createAsset(req, {
        name: 'Server',
        code: 'SRV-001',
        categoryId: category.id,
        acquisitionCost: 12000,
        salvageValue: 0,
        usefulLifeYears: 5,
        depreciationMethod: 'STRAIGHT_LINE',
        purchaseDate: '2026-01-01T00:00:00.000Z',
        startDate: '2026-01-01T00:00:00.000Z',
      });

      const preview = await service.previewDepreciation(req, asset.id, '2026-11');
      assert.equal(preview.depreciationAmount, 200);

      const posted = await service.postDepreciation(req, asset.id, {
        period: '2026-11',
        expenseAccountId: expense.id,
        accumulatedDepreciationAccountId: accumulated.id,
      });

      assert.equal(Number(posted.entry.depreciationAmount), 200);
      assert.equal(posted.journal.lines.length, 2);
      assert.equal(
        posted.journal.lines.reduce((s, line) => s + Number(line.debitAmount), 0),
        200,
      );
      assert.equal(
        posted.journal.lines.reduce((s, line) => s + Number(line.creditAmount), 0),
        200,
      );

      const updated = await prisma.fixedAsset.findUnique({ where: { id: asset.id } });
      assert.equal(Number(updated!.accumulatedDepreciation), 200);
      assert.equal(Number(updated!.currentValue), 11800);

      await assert.rejects(
        () => service.postDepreciation(req, asset.id, {
          period: '2026-11',
          expenseAccountId: expense.id,
          accumulatedDepreciationAccountId: accumulated.id,
        }),
        /already posted/,
      );

      await assert.rejects(
        () => service.postDepreciation(req, asset.id, {
          period: '2026-12',
          expenseAccountId: expense.id,
          accumulatedDepreciationAccountId: accumulated.id,
        }),
        /Financial period "December 2026" is closed/,
      );

      assert.equal(
        await prisma.depreciationEntry.count({ where: { tenantId: tenant.id, assetId: asset.id } }),
        1,
      );
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
      await prisma.$disconnect();
    }
  },
);
