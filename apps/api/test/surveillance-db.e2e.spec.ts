import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { prisma } from '@scc/database';
import { SurveillanceController } from '../src/surveillance/surveillance.controller';

if (process.env.SCC380_TEST_DATABASE_ISOLATED !== 'YES' ||
    !String(process.env.DATABASE_URL || '').includes('/surveillance_ci')) {
  throw new Error('Surveillance E2E requires a named isolated database');
}

const controller = new SurveillanceController();
const label = randomUUID().slice(0, 8);
const tenants: string[] = [];
const tenant = async (name: string) => {
  const record = await prisma.tenant.create({ data: { name, slug: 'surveillance-ci-' + name + '-' + label } });
  tenants.push(record.id);
  return record.id;
};
const req = (tenantId: string, role = 'ADMIN') => ({ user: { userId: 'test-actor', tenantId, role } });

after(async () => {
  // Isolated CI only. Never use production credentials for this test.
  if (tenants.length) {
    await prisma.surveillanceMaintenance.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.surveillanceCamera.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.surveillanceSite.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.tenant.deleteMany({ where: { id: { in: tenants } } });
  }
  await prisma.$disconnect();
});

test('surveillance tenant isolation and maintenance lifecycle', async () => {
  const a = await tenant('alpha');
  const b = await tenant('beta');
  const site = await controller.addSite(req(a), { name: 'Main warehouse' });
  const sitesB = await controller.sites(req(b));
  assert.equal(sitesB.some(x => x.id === site.id), false);
  await assert.rejects(() => controller.addCamera(req(b), {
    siteId: site.id, name: 'Foreign camera',
  }), /Site not found in tenant/);
  const camera = await controller.addCamera(req(a), {
    siteId: site.id, name: 'Loading bay', supportsAudio: true, supportsTalk: true,
    supportsPtz: true, supportsWiper: false,
  });
  assert.equal(camera.connectionStatus, 'UNCONFIGURED');
  assert.equal((await controller.cameras(req(b))).length, 0);
  await assert.rejects(() => controller.addMaintenance(req(b), {
    cameraId: camera.id, taskType: 'CLEANING',
  }), /Camera not found in tenant/);
  const task = await controller.addMaintenance(req(a), {
    cameraId: camera.id, taskType: 'CLEANING', description: 'Clean exterior lens',
  });
  await assert.rejects(() => controller.updateMaintenance(req(b), task.id, { status: 'COMPLETED' }),
    /Maintenance not found in tenant/);
  await controller.updateMaintenance(req(a), task.id, { status: 'IN_PROGRESS' });
  await controller.updateMaintenance(req(a), task.id, { status: 'COMPLETED' });
  await assert.rejects(() => controller.updateMaintenance(req(a), task.id, { status: 'IN_PROGRESS' }),
    /Closed maintenance records cannot be changed/);
  assert.equal((await controller.maintenance(req(a)))[0].status, 'COMPLETED');
});

test('tenant-free sessions and unprivileged roles cannot access cameras', async () => {
  assert.throws(() => controller.sites(req('', 'SUPER_ADMIN')), /tenant context/);
  assert.throws(() => controller.cameras(req('random', 'USER')), /role not authorized/);
  assert.throws(() => controller.maintenance(req('random', 'USER')), /role not authorized/);
});
