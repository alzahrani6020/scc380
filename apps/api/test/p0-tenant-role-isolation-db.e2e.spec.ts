import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ForbiddenException } from '@nestjs/common';
import { prisma } from '@scc/database';
import { TenantService } from '../src/tenant/tenant.service';

test('P0: platform owner, company admin, manager and worker cannot cross company boundaries', {
  skip: process.env.CRM_DB_E2E !== '1' ? 'CRM_DB_E2E=1 required' : false,
}, async () => {
  const suffix = process.pid + '-' + Date.now();
  const tenantA = await prisma.tenant.create({
    data: { name: 'P0 tenant A', slug: 'p0-a-' + suffix },
  });
  const tenantB = await prisma.tenant.create({
    data: { name: 'P0 tenant B', slug: 'p0-b-' + suffix },
  });
  const users: Array<{ id: string; role: string; tenantId: string | null }> = [];
  const tenantService = new TenantService();
  try {
    for (const role of ['ADMIN', 'MANAGER', 'USER', 'AUDITOR', 'READONLY'] as const) {
      const user = await prisma.user.create({
        data: { tenantId: tenantA.id, role,
          email: 'p0-'+role.toLowerCase()+'-'+suffix+'@example.test',
          firstName: 'P0', lastName: role, status: 'ACTIVE' },
      });
      users.push({ id: user.id, role: user.role, tenantId: user.tenantId });
    }
    const owner = { userId: 'platform-owner-fixture', role: 'SUPER_ADMIN', tenantId: null };
    const admin = users.find(u => u.role === 'ADMIN')!;
    const manager = users.find(u => u.role === 'MANAGER')!;
    const worker = users.find(u => u.role === 'USER')!;
    const auditor = users.find(u => u.role === 'AUDITOR')!;
    const readonly = users.find(u => u.role === 'READONLY')!;

    await assert.rejects(() => tenantService.findAll({ role: 'ADMIN' }), ForbiddenException);
    await assert.rejects(() => tenantService.findAll({ role: 'MANAGER', tenantId: undefined }), ForbiddenException);
    await assert.rejects(() => tenantService.findAll({ role: 'USER', tenantId: null }), ForbiddenException);
    await assert.rejects(() => tenantService.findOne({ role: 'USER' }, tenantA.id), ForbiddenException);
    // The platform owner can read across tenants; local users only their own.
    assert.equal((await tenantService.findAll(owner)).some(t => t.id === tenantB.id), true);
    for (const actor of [admin, manager, worker, auditor, readonly]) {
      const visible = await tenantService.findAll(actor);
      assert.deepEqual(visible.map(t => t.id), [tenantA.id]);
      await assert.rejects(() => tenantService.findOne(actor, tenantB.id), ForbiddenException);
      await assert.rejects(() => tenantService.update(actor, tenantB.id,
        { name: 'unauthorized foreign company name' }), ForbiddenException);
      await assert.rejects(() => tenantService.remove(actor, tenantB.id), ForbiddenException);
    }
    // Defense in depth: a manager and employee also cannot call the service
    // directly to mutate their own company, even if the HTTP guard is bypassed.
    for (const actor of [manager, worker, auditor, readonly]) {
      await assert.rejects(() => tenantService.update(actor, tenantA.id,
        { name: 'unauthorized self-service name' }), ForbiddenException);
    }
    const ownName = 'P0 tenant A admin edited';
    const updated = await tenantService.update(admin, tenantA.id, { name: ownName });
    assert.equal(updated.name, ownName);
    assert.equal((await tenantService.findOne(owner, tenantB.id)).id, tenantB.id);
    assert.equal((await prisma.tenant.findUniqueOrThrow({ where: { id: tenantB.id } })).name,
      'P0 tenant B');
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: users.map(u => u.id) } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantA.id, tenantB.id] } } });
  }
});
