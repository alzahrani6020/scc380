import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@scc/database';
import { PropertiesService } from '../src/real-estate/properties.service';
import { UnitsService } from '../src/real-estate/units.service';

test(
  'Real estate database lifecycle: tenant-isolated property and unit CRUD',
  { skip: process.env.REAL_ESTATE_DB_E2E !== '1' ? 'Dedicated ephemeral database required' : false },
  async () => {
    const run = `${process.pid}-${Date.now()}`;
    const tenantA = await prisma.tenant.create({ data: { name: `RE A ${run}`, slug: `re-a-${run}` } });
    const tenantB = await prisma.tenant.create({ data: { name: `RE B ${run}`, slug: `re-b-${run}` } });
    const properties = new PropertiesService();
    const units = new UnitsService();
    try {
      const property = await properties.create(tenantA.id, { name: `Office ${run}`, propertyType: 'COMMERCIAL', city: 'Jeddah' });
      assert.equal(property.tenantId, tenantA.id);
      const unit = await units.create(tenantA.id, { propertyId: property.id, unitNumber: '101', unitType: 'OFFICE', status: 'VACANT' });
      assert.equal(unit.propertyId, property.id);
      assert.equal(unit.tenantId, tenantA.id);

      const readProperty = await properties.findOne(tenantA.id, property.id);
      const readUnit = await units.findOne(tenantA.id, unit.id);
      assert.equal(readProperty.name, `Office ${run}`);
      assert.equal(readUnit.unitNumber, '101');

      const updatedProperty = await properties.update(tenantA.id, property.id, { name: `Renamed ${run}` });
      const updatedUnit = await units.update(tenantA.id, unit.id, { status: 'UNDER_MAINTENANCE' });
      assert.equal(updatedProperty.name, `Renamed ${run}`);
      assert.equal(updatedUnit.status, 'UNDER_MAINTENANCE');
      assert.equal((await properties.findOne(tenantA.id, property.id)).name, updatedProperty.name);
      assert.equal((await units.findOne(tenantA.id, unit.id)).status, updatedUnit.status);

      const summary = await properties.summary(tenantA.id);
      assert.equal(summary.total, 1);
      assert.equal(summary.totalUnits, 1);
      assert.equal(summary.vacantUnits, 0);
      assert.equal((await properties.summary(tenantB.id)).totalUnits, 0);

      assert.equal((await properties.findAll(tenantB.id)).count, 0);
      assert.equal((await units.findAll(tenantB.id)).count, 0);
      await assert.rejects(() => properties.findOne(tenantB.id, property.id));
      await assert.rejects(() => units.findOne(tenantB.id, unit.id));
      await assert.rejects(() => properties.update(tenantB.id, property.id, { name: 'Invalid' }));
      await assert.rejects(() => units.update(tenantB.id, unit.id, { status: 'VACANT' }));
      await assert.rejects(() => units.create(tenantB.id, { propertyId: property.id, unitNumber: 'X' }));
      await assert.rejects(() => units.delete(tenantB.id, unit.id));
      await assert.rejects(() => properties.delete(tenantB.id, property.id));

      await units.delete(tenantA.id, unit.id);
      await properties.delete(tenantA.id, property.id);
      assert.equal((await properties.findAll(tenantA.id)).count, 0);
      assert.equal((await units.findAll(tenantA.id)).count, 0);
    } finally {
      await prisma.tenant.deleteMany({ where: { id: { in: [tenantA.id, tenantB.id] } } });
      await prisma.$disconnect();
    }
  },
);
