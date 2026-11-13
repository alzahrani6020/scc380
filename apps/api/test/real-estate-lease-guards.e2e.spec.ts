import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@scc/database';
import { PropertiesService } from '../src/real-estate/properties.service';
import { UnitsService } from '../src/real-estate/units.service';
import { LeaseContractsService } from '../src/real-estate/lease-contracts.service';
import { RentPaymentsService } from '../src/real-estate/rent-payments.service';

test(
  'Real-estate lease and receivable guardrails on isolated database',
  { skip: process.env.REAL_ESTATE_DB_E2E !== '1' ? 'Dedicated ephemeral database required' : false },
  async () => {
    const run = `${process.pid}-${Date.now()}`;
    const a = await prisma.tenant.create({ data: { name: `Lease A ${run}`, slug: `lease-a-${run}` } });
    const b = await prisma.tenant.create({ data: { name: `Lease B ${run}`, slug: `lease-b-${run}` } });
    const properties = new PropertiesService();
    const units = new UnitsService();
    const leases = new LeaseContractsService();
    const receivables = new RentPaymentsService();
    try {
      const property = await properties.create(a.id, { name: `Lease property ${run}` });
      const unit = await units.create(a.id, { propertyId: property.id, unitNumber: 'L1' });
      const terms = {
        propertyId: property.id,
        unitId: unit.id,
        lessorName: 'Test landlord',
        lessorIdNumber: '0000000000',
        lesseeName: 'Test tenant',
        lesseeIdNumber: '1111111111',
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-02-01T00:00:00.000Z',
        rentAmount: '1000.00',
        paymentFrequency: 'MONTHLY',
      };
      await assert.rejects(() => leases.create(b.id, terms), /Property\/unit relation not found/);
      await assert.rejects(() => leases.create(a.id, { ...terms, endDate: terms.startDate }), /end date/);
      const contract = await leases.create(a.id, { ...terms, status: 'ACTIVE' });
      assert.equal(contract.tenantId, a.id);
      assert.equal(contract.status, 'ACTIVE');
      const readBack = await leases.findOne(a.id, contract.id);
      assert.equal(readBack.unitId, unit.id);
      assert.ok(readBack.payments.length > 0);
      const scheduled = readBack.payments[0];
      assert.equal(scheduled.tenantId, a.id);
      assert.equal(scheduled.status, 'PENDING');
      assert.equal((await receivables.findAll(b.id)).count, 0);
      assert.equal((await leases.findAll(b.id)).count, 0);
      await assert.rejects(() => leases.findOne(b.id, contract.id));
      await assert.rejects(() => receivables.findOne(b.id, scheduled.id));
      await assert.rejects(() => receivables.recordPayment(b.id, scheduled.id, {
        paidDate: '2026-01-02T00:00:00.000Z', amount: '1000.00',
      }));
      await assert.rejects(() => leases.update(a.id, contract.id, { rentAmount: '2000' }), /financial terms/);
      await assert.rejects(() => leases.delete(a.id, contract.id), /draft contracts without scheduled/);
      await assert.rejects(() => receivables.recordPayment(a.id, scheduled.id, {
        paidDate: '2026-01-02T00:00:00.000Z', amount: '500',
      }), /Partial or excess/);
      const paid = await receivables.recordPayment(a.id, scheduled.id, {
        paidDate: '2026-01-02T00:00:00.000Z', amount: '1000.00',
        paymentMethod: 'BANK_TRANSFER', transactionRef: `lease-e2e-${run}`,
      });
      assert.equal(paid.status, 'COMPLETED');
      assert.equal((await receivables.findOne(a.id, scheduled.id)).status, 'COMPLETED');
      await assert.rejects(() => receivables.recordPayment(a.id, scheduled.id, {
        paidDate: '2026-01-02T00:00:00.000Z', amount: '1000.00',
      }), /Only pending/);
    } finally {
      await prisma.tenant.deleteMany({ where: { id: { in: [a.id, b.id] } } });
      await prisma.$disconnect();
    }
  },
);
