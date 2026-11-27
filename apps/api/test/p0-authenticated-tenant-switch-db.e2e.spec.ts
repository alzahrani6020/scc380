import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { prisma } from '@scc/database';
import { TenantMiddleware } from '../src/common/middleware/tenant.middleware';
import { validateAccessSessionPayload } from '../src/auth/access-session';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';

test('P0: a real company session cannot switch its organization by X-Tenant-Slug', {
  skip: process.env.CRM_DB_E2E !== '1' ? 'CRM_DB_E2E=1 required' : false,
}, async () => {
  const unique = process.pid + '-' + Date.now();
  const a = await prisma.tenant.create({ data: { name: 'JWT Tenant A', slug: 'p0-jwt-a-' + unique } });
  const b = await prisma.tenant.create({ data: { name: 'JWT Tenant B', slug: 'p0-jwt-b-' + unique } });
  let userId: string | undefined;
  try {
    const user = await prisma.user.create({ data: {
      tenantId: a.id, role: 'ADMIN', status: 'ACTIVE',
      firstName: 'JWT', lastName: 'Fixture',
      email: 'p0-jwt-' + unique + '@example.test',
    } });
    userId = user.id;
    const session = await prisma.session.create({ data: {
      userId: user.id, tenantId: a.id, token: 'p0-jwt-session-' + unique,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    } });
    const payload = { type: 'access', sub: user.id, sid: session.id };
    const actor = await validateAccessSessionPayload(payload);
    assert.equal(actor.tenantId, a.id);

    const mw = new TenantMiddleware();
    const guard = new JwtAuthGuard();
    const selector = async (slug: string) => {
      const req: any = { hostname: 'localhost', subdomains: [],
        headers: { 'x-tenant-slug': slug } };
      let nextCalled = false;
      const response: any = {
        status(code: number) { this.code = code; return this; },
        json(data: any) { this.response = data; return this; },
      };
      await mw.use(req, response, (() => { nextCalled = true; }) as any);
      assert.equal(nextCalled, true);
      const context = {
        switchToHttp: () => ({ getRequest: () => req }),
      } as unknown as ExecutionContext;
      return { req, context };
    };
    const own = await selector(a.slug);
    assert.equal(own.req.tenantId, a.id);
    assert.equal(guard.handleRequest(null, actor, null, own.context), actor);

    const foreign = await selector(b.slug);
    assert.equal(foreign.req.tenantId, b.id);
    assert.throws(() => guard.handleRequest(null, actor, null, foreign.context),
      ForbiddenException);
    assert.equal((await prisma.tenant.findUniqueOrThrow({ where: { id: b.id } })).name,
      'JWT Tenant B');
  } finally {
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.tenant.deleteMany({ where: { id: { in: [a.id, b.id] } } });
  }
});
