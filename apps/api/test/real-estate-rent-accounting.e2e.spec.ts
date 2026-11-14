import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, AccountType } from '@scc/database';
import { PropertiesService } from '../src/real-estate/properties.service';
import { UnitsService } from '../src/real-estate/units.service';
import { LeaseContractsService } from '../src/real-estate/lease-contracts.service';
import { RentPaymentsService } from '../src/real-estate/rent-payments.service';
import { RentAccountingService } from '../src/real-estate/rent-accounting.service';
import { AccountingPostingService } from '../src/accounting-core/accounting-posting.service';
import { AccountingDualWriteService } from '../src/accounting-core/accounting-dual-write.service';
import { AccountMappingService } from '../src/accounting-core/account-mapping.service';

test(
  'Rent collection journal: balanced, tenant-guarded, mapped and idempotent',
  { skip: process.env.REAL_ESTATE_DB_E2E !== '1' ? 'Disposable database required' : false },
  async () => {
    const token = `${process.pid}-${Date.now()}`;
    const a = await prisma.tenant.create({ data: { name: `Rent accounting A ${token}`, slug: `rent-ac-a-${token}` } });
    const b = await prisma.tenant.create({ data: { name: `Rent accounting B ${token}`, slug: `rent-ac-b-${token}` } });
    const properties = new PropertiesService();
    const units = new UnitsService();
    const leases = new LeaseContractsService();
    const receipts = new RentPaymentsService();
    const journals = new RentAccountingService(
      new AccountingDualWriteService(new AccountingPostingService()),
      new AccountMappingService(),
    );
    try {
      await prisma.chartOfAccount.createMany({
        data: [
          { tenantId: a.id, code: '1120', name: 'Rent receivables', type: AccountType.ASSET },
          { tenantId: a.id, code: '4200', name: 'Rent revenue', type: AccountType.REVENUE },
          { tenantId: a.id, code: '1110', name: 'Cash', type: AccountType.ASSET },
        ],
      });
      const property = await properties.create(a.id, { name: 'Accounting test property' });
      const unit = await units.create(a.id, { propertyId: property.id, unitNumber: 'AR1' });
      const contract = await leases.create(a.id, {
        propertyId: property.id, unitId: unit.id,
        lessorName: 'Landlord', lessorIdNumber: '123',
        lesseeName: 'Tenant', lesseeIdNumber: '456',
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-02-01T00:00:00.000Z',
        rentAmount: '1000.00', paymentFrequency: 'MONTHLY', status: 'ACTIVE',
      });
      const due = (await leases.findOne(a.id, contract.id)).payments[0];
      await assert.rejects(() => journals.postAccrual(b.id, due.id), /not found/);
      const accrual = await journals.postAccrual(a.id, due.id);
      assert.equal(accrual.status, 'POSTED');
      assert.equal(accrual.lines.length, 2);
      assert.equal(accrual.lines.reduce((sum, line) => sum + Number(line.debitAmount), 0), 1000);
      assert.equal(accrual.lines.reduce((sum, line) => sum + Number(line.creditAmount), 0), 1000);
      assert.equal((await journals.postAccrual(a.id, due.id)).id, accrual.id);

      const part = await receipts.recordPayment(a.id, due.id, {
        paidDate: '2026-01-05T00:00:00.000Z', amount: '400.00',
        idempotencyKey: 'rent-journal-part-'+token, paymentMethod: 'CASH',
        transactionRef: 'rent-journal-first-'+token,
      });
      assert.equal(part.status, 'PENDING');
      const first = await prisma.rentCollection.findFirstOrThrow({
        where: { tenantId: a.id, rentPaymentId: due.id },
      });
      await assert.rejects(() => journals.postCollection(b.id, first.id), /not found/);
      const cashEntry = await journals.postCollection(a.id, first.id);
      assert.equal(cashEntry.status, 'POSTED');
      assert.equal(cashEntry.lines.length, 2);
      assert.equal(cashEntry.lines.reduce((sum, line) => sum + Number(line.debitAmount), 0), 400);
      assert.equal(cashEntry.lines.reduce((sum, line) => sum + Number(line.creditAmount), 0), 400);
      assert.equal((await journals.postCollection(a.id, first.id)).id, cashEntry.id);

      await receipts.recordPayment(a.id, due.id, {
        paidDate: '2026-01-06T00:00:00.000Z', amount: '600.00',
        idempotencyKey: 'rent-journal-final-'+token, paymentMethod: 'CASH',
      });
      const second = await prisma.rentCollection.findFirstOrThrow({
        where: { tenantId: a.id, rentPaymentId: due.id, amount: '600.00' },
      });
      const finalEntry = await journals.postCollection(a.id, second.id);
      assert.notEqual(finalEntry.id, cashEntry.id);
      assert.equal(finalEntry.lines.reduce((sum, line) => sum + Number(line.creditAmount), 0), 600);
      const history = await receipts.collectionHistory(a.id, due.id);
      assert.equal(history.count, 2);
      assert.equal(history.accrualJournalId, accrual.id);
      assert.ok(history.data.every(item => item.accountingJournalId));
      await assert.rejects(() => receipts.collectionHistory(b.id, due.id), /not found/);
      assert.equal(await prisma.journalEntryHeader.count({
        where: { tenantId: a.id, sourceType: 'RENT_COLLECTION' },
      }), 2);
      assert.equal(await prisma.journalEntryHeader.count({
        where: { tenantId: a.id, sourceType: 'RENT_RECEIVABLE' },
      }), 1);
    } finally {
      await prisma.tenant.deleteMany({ where: { id: { in: [a.id, b.id] } } });
      await prisma.$disconnect();
    }
  },
);
