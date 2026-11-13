import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@scc/database';
import { LeaseContractsService } from '../src/real-estate/lease-contracts.service';

test('real estate lease creation, renewal, termination and occupancy are consistent', {
  skip: process.env.CRM_DB_E2E !== '1' ? 'CRM_DB_E2E=1 is required' : false,
}, async () => {
  const run = `${process.pid}-${Date.now()}`;
  const tenant = await prisma.tenant.create({ data: { name: `Lease A ${run}`, slug: `lease-a-${run}` } });
  const other = await prisma.tenant.create({ data: { name: `Lease B ${run}`, slug: `lease-b-${run}` } });
  try {
    const property = await prisma.property.create({ data: { tenantId: tenant.id, name: 'Lease test property' } });
    const unit = await prisma.unit.create({ data: { tenantId: tenant.id, propertyId: property.id, unitNumber: 'A-1' } });
    const service = new LeaseContractsService();
    const input = {
      propertyId: property.id,
      unitId: unit.id,
      lessorName: 'Test landlord',
      lessorIdNumber: '1111111111',
      lesseeName: 'Test tenant',
      lesseeIdNumber: '2222222222',
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2027-01-01T00:00:00.000Z',
      rentAmount: '1200.00',
      paymentFrequency: 'ANNUAL',
    };
    const draft = await service.create(tenant.id, input);
    assert.equal(draft.status, 'DRAFT');
    assert.ok(await prisma.rentPayment.count({ where: { tenantId: tenant.id, contractId: draft.id } }) >= 1);

    const initialUnit = await prisma.unit.findUniqueOrThrow({ where: { id: unit.id } });
    assert.equal(initialUnit.currentLeaseId, null, 'draft must not occupy the unit');

    await prisma.leaseContract.update({ where: { id: draft.id }, data: { status: 'ACTIVE' } });
    await prisma.unit.update({ where: { id: unit.id }, data: { status: 'OCCUPIED', currentLeaseId: draft.id } });

    await assert.rejects(
      () => service.renew(other.id, draft.id, {
        startDate: '2027-01-01T00:00:00.000Z', endDate: '2028-01-01T00:00:00.000Z',
      }),
      /Contract not found/,
    );
    await assert.rejects(
      () => service.renew(tenant.id, draft.id, {
        startDate: '2026-11-01T00:00:00.000Z', endDate: '2028-01-01T00:00:00.000Z',
      }),
      /overlaps/,
    );

    const renewal = await service.renew(tenant.id, draft.id, {
      startDate: '2027-01-01T00:00:00.000Z',
      endDate: '2028-01-01T00:00:00.000Z',
    });
    assert.equal(renewal.status, 'ACTIVE');
    const old = await prisma.leaseContract.findUniqueOrThrow({ where: { id: draft.id } });
    assert.equal(old.status, 'RENEWED');
    assert.equal((await prisma.unit.findUniqueOrThrow({ where: { id: unit.id } })).currentLeaseId, renewal.id);
    assert.ok(await prisma.rentPayment.count({ where: { tenantId: tenant.id, contractId: renewal.id } }) >= 1);
    await assert.rejects(
      () => service.renew(tenant.id, draft.id, {
        startDate: '2027-01-01T00:00:00.000Z', endDate: '2028-01-01T00:00:00.000Z',
      }),
      /Only active leases/,
    );
    const terminated = await service.terminate(tenant.id, renewal.id);
    assert.equal(terminated.status, 'TERMINATED');
    const vacant = await prisma.unit.findUniqueOrThrow({ where: { id: unit.id } });
    assert.equal(vacant.status, 'VACANT');
    assert.equal(vacant.currentLeaseId, null);
    await assert.rejects(() => service.terminate(tenant.id, renewal.id), /Only active leases/);
  } finally {
    await prisma.tenant.delete({ where: { id: tenant.id } });
    await prisma.tenant.delete({ where: { id: other.id } });
  }
});
