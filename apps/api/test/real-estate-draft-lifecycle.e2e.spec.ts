import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@scc/database';
import { PropertiesService } from '../src/real-estate/properties.service';
import { UnitsService } from '../src/real-estate/units.service';
import { LeaseContractsService } from '../src/real-estate/lease-contracts.service';

test(
  'Draft lease creates zero receivables, can change financial terms, and can be removed',
  { skip: process.env.REAL_ESTATE_DB_E2E !== '1' ? 'Isolated test database required' : false },
  async () => {
    const suffix = `${process.pid}-${Date.now()}`;
    const tenant = await prisma.tenant.create({
      data: { name: `Draft lease test ${suffix}`, slug: `draft-lease-${suffix}` },
    });
    const properties = new PropertiesService();
    const units = new UnitsService();
    const leases = new LeaseContractsService();
    try {
      const property = await properties.create(tenant.id, { name: 'Draft property' });
      const unit = await units.create(tenant.id, { propertyId: property.id, unitNumber: 'D1' });
      const contract = await leases.create(tenant.id, {
        propertyId: property.id,
        unitId: unit.id,
        lessorName: 'Lessor',
        lessorIdNumber: '123',
        lesseeName: 'Lessee',
        lesseeIdNumber: '456',
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-12-31T00:00:00.000Z',
        rentAmount: '12000.00',
        paymentFrequency: 'MONTHLY',
      });
      assert.equal(contract.status, 'DRAFT');
      assert.equal((await leases.findOne(tenant.id, contract.id)).payments.length, 0);
      assert.equal(await prisma.rentPayment.count({ where: { contractId: contract.id } }), 0);
      assert.equal((await units.findOne(tenant.id, unit.id)).status, 'VACANT');
      const updated = await leases.update(tenant.id, contract.id, {
        rentAmount: '15000.00',
        endDate: '2027-01-31T00:00:00.000Z',
      });
      assert.equal(Number(updated.rentAmount), 15000);
      assert.equal((await leases.findOne(tenant.id, contract.id)).payments.length, 0);
      await leases.delete(tenant.id, contract.id);
      await assert.rejects(() => leases.findOne(tenant.id, contract.id), /Contract not found/);
      assert.equal(await prisma.rentPayment.count({ where: { contractId: contract.id } }), 0);
    } finally {
      await prisma.tenant.deleteMany({ where: { id: tenant.id } });
      await prisma.$disconnect();
    }
  },
);

test(
  'Explicit ACTIVE lease still creates receivables (legacy behavior unchanged)',
  { skip: process.env.REAL_ESTATE_DB_E2E !== '1' ? 'Isolated test database required' : false },
  async () => {
    const suffix = `${process.pid}-${Date.now()}`;
    const tenant = await prisma.tenant.create({
      data: { name: `Active lease test ${suffix}`, slug: `active-lease-${suffix}` },
    });
    const properties = new PropertiesService();
    const units = new UnitsService();
    const leases = new LeaseContractsService();
    try {
      const property = await properties.create(tenant.id, { name: 'Active property' });
      const unit = await units.create(tenant.id, { propertyId: property.id, unitNumber: 'A1' });
      const contract = await leases.create(tenant.id, {
        propertyId: property.id,
        unitId: unit.id,
        lessorName: 'Lessor',
        lessorIdNumber: '123',
        lesseeName: 'Lessee',
        lesseeIdNumber: '456',
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-03-01T00:00:00.000Z',
        rentAmount: '1000.00',
        paymentFrequency: 'MONTHLY',
        status: 'ACTIVE',
      });
      assert.equal(contract.status, 'ACTIVE');
      assert.ok((await leases.findOne(tenant.id, contract.id)).payments.length > 0);
      assert.equal((await units.findOne(tenant.id, unit.id)).status, 'OCCUPIED');
    } finally {
      await prisma.tenant.deleteMany({ where: { id: tenant.id } });
      await prisma.$disconnect();
    }
  },
);


test(
  'Draft activation atomically claims unit, issues receivables once, and rejects foreign tenant or repeated activation',
  { skip: process.env.REAL_ESTATE_DB_E2E !== '1' ? 'Isolated test database required' : false },
  async () => {
    const suffix = `${process.pid}-${Date.now()}`;
    const a = await prisma.tenant.create({ data: { name: `Activation A ${suffix}`, slug: `activation-a-${suffix}` } });
    const b = await prisma.tenant.create({ data: { name: `Activation B ${suffix}`, slug: `activation-b-${suffix}` } });
    const properties = new PropertiesService();
    const units = new UnitsService();
    const leases = new LeaseContractsService();
    try {
      const property = await properties.create(a.id, { name: 'Activation property' });
      const unit = await units.create(a.id, { propertyId: property.id, unitNumber: 'AT1' });
      const contract = await leases.create(a.id, {
        propertyId: property.id, unitId: unit.id,
        lessorName: 'Lessor', lessorIdNumber: '111',
        lesseeName: 'Lessee', lesseeIdNumber: '222',
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-04-01T00:00:00.000Z',
        rentAmount: '1000.00', paymentFrequency: 'MONTHLY',
      });
      assert.equal((await leases.findOne(a.id, contract.id)).payments.length, 0);
      await assert.rejects(() => leases.activate(b.id, contract.id), /Contract not found/);
      assert.equal((await leases.activate(a.id, contract.id)).status, 'ACTIVE');
      const active = await leases.findOne(a.id, contract.id);
      assert.ok(active.payments.length > 0);
      assert.equal((await units.findOne(a.id, unit.id)).currentLeaseId, contract.id);
      assert.equal((await units.findOne(a.id, unit.id)).status, 'OCCUPIED');
      const count = await prisma.rentPayment.count({ where: { tenantId: a.id, contractId: contract.id } });
      await assert.rejects(() => leases.activate(a.id, contract.id), /Only draft contracts/);
      assert.equal(await prisma.rentPayment.count({ where: { tenantId: a.id, contractId: contract.id } }), count);
      const second = await leases.create(a.id, {
        propertyId: property.id, unitId: unit.id,
        lessorName: 'Lessor', lessorIdNumber: '111',
        lesseeName: 'Second', lesseeIdNumber: '333',
        startDate: '2026-05-01T00:00:00.000Z',
        endDate: '2026-08-01T00:00:00.000Z',
        rentAmount: '1000.00', paymentFrequency: 'MONTHLY',
      });
      await assert.rejects(() => leases.activate(a.id, second.id), /Unit must be vacant/);
      assert.equal((await leases.findOne(a.id, second.id)).status, 'DRAFT');
      assert.equal((await leases.findOne(a.id, second.id)).payments.length, 0);
    } finally {
      await prisma.tenant.deleteMany({ where: { id: { in: [a.id, b.id] } } });
      await prisma.$disconnect();
    }
  },
);
