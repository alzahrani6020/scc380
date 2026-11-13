import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { prisma } from '@scc/database';
import * as speakeasy from 'speakeasy';
import { AuthService } from '../src/auth/auth.service';
import { ApiKeysService } from '../src/security/api-keys.service';

test('DB-backed new API keys are hashed, legacy keys untouched, tenant isolation enforced', {
  skip: process.env.CRM_DB_E2E !== '1',
}, async () => {
  const run = `${process.pid}-${Date.now()}`;
  const tenant = await prisma.tenant.create({ data: { name: 'Keys test ' + run, slug: 'keytest-' + run } });
  try {
    const user = await prisma.user.create({
      data: { tenantId: tenant.id, email: 'keytest-' + run + '@example.test',
        firstName: 'Key', lastName: 'Test', role: 'ADMIN', status: 'ACTIVE' },
    });
    const svc = new ApiKeysService();
    const req = { user: { userId: user.id, tenantId: tenant.id } };
    const created = await svc.create(req, { name: 'new key' });
    assert.match(created.key, /^sk_[0-9a-f]{64}$/);
    const stored = await prisma.apiKey.findUniqueOrThrow({ where: { id: created.id } });
    assert.equal(stored.key, 'sha256:' + createHash('sha256').update(created.key).digest('hex'));
    const legacy = await prisma.apiKey.create({
      data: { userId: user.id, tenantId: tenant.id, name: 'legacy key', key: 'sk_legacy_test_' + run },
    });
    const listed = await svc.findAll(req);
    assert.equal(listed.data.length, 2);
    assert.equal(listed.data.some((k: any) => k.key === created.key), false);
    assert.equal((await prisma.apiKey.findUniqueOrThrow({ where: { id: legacy.id } })).key, legacy.key);
    const otherTenant = await prisma.tenant.create({ data: { name: 'Other ' + run, slug: 'other-keytest-' + run } });
    try {
      const mismatched = { user: { userId: user.id, tenantId: otherTenant.id } };
      assert.equal((await svc.findAll(mismatched)).count, 0);
      await assert.rejects(() => svc.revoke(mismatched, created.id));
      assert.equal((await svc.revoke(req, created.id)).revoked, true);
    } finally {
      await prisma.tenant.delete({ where: { id: otherTenant.id } });
    }
  } finally {
    await prisma.tenant.delete({ where: { id: tenant.id } });
    await prisma.$disconnect();
  }
});

test('Redis-backed 2FA challenge can issue only one session', {
  skip: process.env.CRM_DB_E2E !== '1' || !process.env.REDIS_URL,
}, async () => {
  const run = `${process.pid}-${Date.now()}`;
  const tenant = await prisma.tenant.create({ data: { name: '2FA test ' + run, slug: '2fatest-' + run } });
  try {
    const otpSecret = speakeasy.generateSecret({ length: 32 }).base32;
    const user = await prisma.user.create({
      data: { tenantId: tenant.id, email: '2fatest-' + run + '@example.test',
        firstName: '2FA', lastName: 'Test', role: 'ADMIN', status: 'ACTIVE',
        twoFactorEnabled: true, twoFactorSecret: otpSecret },
    });
    const secret = 'integration-test-secret-32-chars-012345678901';
    const jwt = new JwtService({ secret, signOptions: { expiresIn: '15m' } });
    const config = { get: (k: string) => k === 'JWT_SECRET' ? secret
      : k === 'REDIS_URL' ? process.env.REDIS_URL : undefined } as any;
    const auth = new AuthService(jwt, config);
    const pending = await auth.login(user.id, user.email, user.role, tenant.id, tenant.slug) as any;
    assert.equal(pending.requires2FA, true);
    const code = speakeasy.totp({ secret: otpSecret, encoding: 'base32' });
    const result = await auth.verify2FALoginAndIssueToken(pending.tempToken, code) as any;
    assert.ok(result.accessToken);
    await assert.rejects(() => auth.verify2FALoginAndIssueToken(pending.tempToken, code));
    assert.equal(await prisma.session.count({ where: { userId: user.id } }), 1);
  } finally {
    await prisma.tenant.delete({ where: { id: tenant.id } });
    await prisma.$disconnect();
  }
});
