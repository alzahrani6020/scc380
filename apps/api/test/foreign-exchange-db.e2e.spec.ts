import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@scc/database';
import { AccountingPostingService } from '../src/accounting-core/accounting-posting.service';
import { ForeignExchangeService } from '../src/finance/foreign-exchange.service';

test(
  'FX journals preserve original currency and revaluation posts gain/loss',
  { skip: process.env.ACCOUNTING_DB_E2E !== '1' ? 'ACCOUNTING_DB_E2E=1 is required' : false },
  async () => {
    const run = `${process.pid}-${Date.now()}`;
    const tenant = await prisma.tenant.create({
      data: { name: `FX E2E ${run}`, slug: `fx-e2e-${run}`, baseCurrency: 'SAR' },
    });

    try {
      const [usdAsset, equity, gain, loss] = await Promise.all([
        prisma.chartOfAccount.create({
          data: { tenantId: tenant.id, code: `USD-${run}`, name: 'USD bank', type: 'ASSET' },
        }),
        prisma.chartOfAccount.create({
          data: { tenantId: tenant.id, code: `EQ-${run}`, name: 'Opening equity', type: 'EQUITY' },
        }),
        prisma.chartOfAccount.create({
          data: { tenantId: tenant.id, code: `FXG-${run}`, name: 'FX gain', type: 'REVENUE' },
        }),
        prisma.chartOfAccount.create({
          data: { tenantId: tenant.id, code: `FXL-${run}`, name: 'FX loss', type: 'EXPENSE' },
        }),
      ]);

      const service = new ForeignExchangeService(new AccountingPostingService());
      const req: any = { user: { tenantId: tenant.id, role: 'ADMIN' } };

      await service.createRate(req, {
        fromCurrency: 'USD',
        toCurrency: 'SAR',
        rate: 3.75,
        effectiveDate: '2027-01-01',
      });

      const foreign = await service.postForeignJournal(req, {
        entryNumber: `FX-OPEN-${run}`,
        description: 'USD opening balance',
        currency: 'USD',
        date: '2027-01-02T12:00:00.000Z',
        lines: [
          { accountId: usdAsset.id, foreignDebitAmount: 100 },
          { accountId: equity.id, foreignCreditAmount: 100 },
        ],
      });

      assert.equal(foreign.baseCurrency, 'SAR');
      assert.equal(foreign.transactionCurrency, 'USD');
      assert.equal(foreign.exchangeRate, 3.75);
      const assetLine = foreign.journal.lines.find((line: any) => line.accountId === usdAsset.id);
      assert.equal(Number(assetLine.foreignDebitAmount), 100);
      assert.equal(Number(assetLine.debitAmount), 375);

      await service.createRate(req, {
        fromCurrency: 'USD',
        toCurrency: 'SAR',
        rate: 3.8,
        effectiveDate: '2027-01-31',
      });

      const gainRevaluation = await service.revalue(req, {
        accountId: usdAsset.id,
        currency: 'USD',
        asOfDate: '2027-01-31',
        gainAccountId: gain.id,
        lossAccountId: loss.id,
      });
      assert.equal(gainRevaluation.foreignBalance, 100);
      assert.equal(gainRevaluation.carryingBase, 375);
      assert.equal(gainRevaluation.expectedBase, 380);
      assert.equal(gainRevaluation.difference, 5);
      const gainLine = gainRevaluation.journal.lines.find((line: any) => line.accountId === gain.id);
      assert.equal(Number(gainLine.creditAmount), 5);

      await service.createRate(req, {
        fromCurrency: 'USD',
        toCurrency: 'SAR',
        rate: 3.7,
        effectiveDate: '2027-02-28',
      });

      const lossRevaluation = await service.revalue(req, {
        accountId: usdAsset.id,
        currency: 'USD',
        asOfDate: '2027-02-28',
        gainAccountId: gain.id,
        lossAccountId: loss.id,
      });
      assert.equal(lossRevaluation.carryingBase, 380);
      assert.equal(lossRevaluation.expectedBase, 370);
      assert.equal(lossRevaluation.difference, -10);
      const lossLine = lossRevaluation.journal.lines.find((line: any) => line.accountId === loss.id);
      assert.equal(Number(lossLine.debitAmount), 10);

      await assert.rejects(
        () => service.setBaseCurrency(req, 'USD'),
        /cannot be changed after posted accounting journals/,
      );
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
      await prisma.$disconnect();
    }
  },
);
