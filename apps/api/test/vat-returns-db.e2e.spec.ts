import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@scc/database';
import { AccountMappingService } from '../src/accounting-core/account-mapping.service';
import { AccountingPostingService } from '../src/accounting-core/accounting-posting.service';
import { VatLedgerService } from '../src/accounting-core/vat-ledger.service';
import { VatReturnsService } from '../src/finance/vat-returns.service';

test(
  'VAT return filing locks tax period and settlement is auditable and reversible',
  { skip: process.env.ACCOUNTING_DB_E2E !== '1' ? 'ACCOUNTING_DB_E2E=1 is required' : false },
  async () => {
    const run = `${process.pid}-${Date.now()}`;
    const tenant = await prisma.tenant.create({
      data: {
        name: `VAT E2E ${run}`,
        slug: `vat-e2e-${run}`,
        baseCurrency: 'SAR',
      },
    });

    try {
      const [vatPayable, vatReceivable, ar, ap, settlementPayable, settlementReceivable] =
        await Promise.all([
          prisma.chartOfAccount.create({
            data: { tenantId: tenant.id, code: '2110', name: 'VAT payable', type: 'LIABILITY' },
          }),
          prisma.chartOfAccount.create({
            data: { tenantId: tenant.id, code: '1140', name: 'VAT receivable', type: 'ASSET' },
          }),
          prisma.chartOfAccount.create({
            data: { tenantId: tenant.id, code: '1120', name: 'AR', type: 'ASSET' },
          }),
          prisma.chartOfAccount.create({
            data: { tenantId: tenant.id, code: '2100', name: 'AP', type: 'LIABILITY' },
          }),
          prisma.chartOfAccount.create({
            data: { tenantId: tenant.id, code: `VATP-${run}`, name: 'VAT settlement payable', type: 'LIABILITY' },
          }),
          prisma.chartOfAccount.create({
            data: { tenantId: tenant.id, code: `VATR-${run}`, name: 'VAT settlement receivable', type: 'ASSET' },
          }),
        ]);

      await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          vatSettlementPayableAccountId: settlementPayable.id,
          vatSettlementReceivableAccountId: settlementReceivable.id,
        },
      });

      const mapping = new AccountMappingService();
      const posting = new AccountingPostingService();
      const vatLedger = new VatLedgerService(mapping);
      const service = new VatReturnsService(mapping, posting, vatLedger);

      await posting.post({
        tenantId: tenant.id,
        entryNumber: `VAT-OUT-${run}`,
        date: new Date('2026-07-10T12:00:00.000Z'),
        description: 'Output VAT seed',
        sourceType: 'VAT_TEST_OUTPUT',
        sourceId: `out-${run}`,
        lines: [
          { accountId: ar.id, debitAmount: 150 },
          { accountId: vatPayable.id, creditAmount: 150 },
        ],
      });

      await posting.post({
        tenantId: tenant.id,
        entryNumber: `VAT-IN-${run}`,
        date: new Date('2026-07-11T12:00:00.000Z'),
        description: 'Input VAT seed',
        sourceType: 'VAT_TEST_INPUT',
        sourceId: `in-${run}`,
        lines: [
          { accountId: vatReceivable.id, debitAmount: 60 },
          { accountId: ap.id, creditAmount: 60 },
        ],
      });

      const vatReturn = await service.create(tenant.id, {
        periodStart: '2026-07-01',
        periodEnd: '2026-07-31',
      });

      const preview = await service.preview(tenant.id, vatReturn.id);
      assert.equal(Number(preview.outputVat), 150);
      assert.equal(Number(preview.inputVat), 60);
      assert.equal(Number(preview.netVat), 90);
      assert.equal(preview.snapshotLocked, false);

      const filed = await service.file(tenant.id, vatReturn.id, 'vat-e2e-admin');
      assert.equal(filed.status, 'FILED');
      assert.equal(Number(filed.outputVat), 150);
      assert.equal(Number(filed.inputVat), 60);
      assert.equal(Number(filed.netVat), 90);

      await assert.rejects(
        () =>
          posting.post({
            tenantId: tenant.id,
            entryNumber: `VAT-LATE-${run}`,
            date: new Date('2026-07-20T12:00:00.000Z'),
            description: 'Must be blocked after filing',
            sourceType: 'VAT_LATE_TEST',
            sourceId: `late-${run}`,
            lines: [
              { accountId: ar.id, debitAmount: 15 },
              { accountId: vatPayable.id, creditAmount: 15 },
            ],
          }),
        /VAT period .* is FILED/,
      );

      const settled = await service.settle(tenant.id, vatReturn.id, 'vat-e2e-admin');
      assert.equal(settled.status, 'SETTLED');
      assert.equal(settled.settlementVersion, 1);
      assert.ok(settled.settlementJournalId);

      const settlementJournal = await prisma.journalEntryHeader.findUniqueOrThrow({
        where: { id: settled.settlementJournalId! },
        include: { lines: true },
      });
      assert.equal(settlementJournal.sourceType, 'VAT_SETTLEMENT');
      assert.equal(
        Number(settlementJournal.lines.find(line => line.accountId === vatPayable.id)!.debitAmount),
        150,
      );
      assert.equal(
        Number(settlementJournal.lines.find(line => line.accountId === vatReceivable.id)!.creditAmount),
        60,
      );
      assert.equal(
        Number(settlementJournal.lines.find(line => line.accountId === settlementPayable.id)!.creditAmount),
        90,
      );

      const postSettlementSnapshot = await prisma.$transaction(tx =>
        vatLedger.snapshot(
          tx,
          tenant.id,
          new Date('2026-07-01T00:00:00.000Z'),
          new Date('2026-07-31T23:59:59.999Z'),
        ),
      );
      assert.equal(Number(postSettlementSnapshot.outputVat), 150);
      assert.equal(Number(postSettlementSnapshot.inputVat), 60);
      assert.equal(Number(postSettlementSnapshot.netVat), 90);

      const reversed = await service.reverseSettlement(
        tenant.id,
        vatReturn.id,
        'vat-e2e-admin',
        'ADMIN',
      );
      assert.equal(reversed.status, 'FILED');
      assert.ok(reversed.reversalJournalId);
      assert.equal(reversed.settledAt, null);

      const reversalJournal = await prisma.journalEntryHeader.findUniqueOrThrow({
        where: { id: reversed.reversalJournalId! },
        include: { lines: true },
      });
      assert.equal(reversalJournal.sourceType, 'VAT_SETTLEMENT_REVERSAL');

      const resettled = await service.settle(tenant.id, vatReturn.id, 'vat-e2e-admin');
      assert.equal(resettled.status, 'SETTLED');
      assert.equal(resettled.settlementVersion, 2);
      assert.notEqual(resettled.settlementJournalId, settlementJournal.id);
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
      await prisma.$disconnect();
    }
  },
);
