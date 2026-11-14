import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { prisma } from '@scc/database';
import * as speakeasy from 'speakeasy';
import { AuthService } from '../src/auth/auth.service';
import { AuthController } from '../src/auth/auth.controller';
import { LoginAttemptsService } from '../src/security/login-attempts.service';
import { ApiKeysService } from '../src/security/api-keys.service';
import { SessionsService } from '../src/security/sessions.service';

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
    assert.equal((await svc.revoke(req, created.id)).revoked, false);
    const events = await prisma.auditLog.findMany({
      where: { userId: user.id, entityType: 'ApiKey' },
      orderBy: { createdAt: 'asc' },
    });
    assert.deepEqual(events.map((e) => e.action).sort(), ['API_KEY_CREATED', 'API_KEY_REVOKED']);
    for (const e of events) {
      assert.equal(JSON.stringify(e.newValues).includes(created.key), false);
      assert.equal(JSON.stringify(e.newValues).includes(stored.key), false);
      assert.equal(e.entityId, created.id);
      assert.equal(e.tenantId, tenant.id);
    }
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
    const issuedSessionId = (jwt.decode(result.accessToken) as any).sid;
    const loginEvents = await prisma.auditLog.findMany({
      where: { userId: user.id, action: 'AUTH_2FA_LOGIN_SUCCESS' },
    });
    assert.equal(loginEvents.length, 1);
    assert.equal(loginEvents[0].entityId, issuedSessionId);
    assert.deepEqual(loginEvents[0].newValues, { method: '2fa', sessionId: issuedSessionId });
    assert.equal(JSON.stringify(loginEvents[0]).includes(pending.tempToken), false);
    await assert.rejects(() => auth.verify2FALoginAndIssueToken(pending.tempToken, code));
    assert.equal(await prisma.auditLog.count({
      where: { userId: user.id, action: 'AUTH_2FA_LOGIN_SUCCESS' },
    }), 1);
    assert.equal(await prisma.session.count({ where: { userId: user.id } }), 1);
    const backup = 'ABCD1234EF567890';
    const backupHash = createHash('sha256').update(backup).digest('hex');
    await prisma.user.update({
      where: { id: user.id }, data: { twoFactorBackupCodes: [backupHash] },
    });
    const attempts = await Promise.allSettled([
      auth.verify2FALogin(user.id, backup),
      auth.verify2FALogin(user.id, backup),
    ]);
    assert.equal(attempts.filter((x) => x.status === 'fulfilled').length, 1);
    assert.equal(attempts.filter((x) => x.status === 'rejected').length, 1);
    assert.deepEqual((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).twoFactorBackupCodes, []);
  } finally {
    await prisma.tenant.delete({ where: { id: tenant.id } });
    await prisma.$disconnect();
  }
});

test('DB-backed session revoke audit is tenant-safe and records only successful changes', {
  skip: process.env.CRM_DB_E2E !== '1',
}, async () => {
  const run = `${process.pid}-${Date.now()}`;
  const tenant = await prisma.tenant.create({
    data: { name: 'Session audit test ' + run, slug: 'session-audit-' + run },
  });
  try {
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id, email: 'session-audit-' + run + '@example.test',
        firstName: 'Audit', lastName: 'Test', role: 'ADMIN', status: 'ACTIVE',
      },
    });
    const otherUser = await prisma.user.create({
      data: {
        tenantId: tenant.id, email: 'other-session-' + run + '@example.test',
        firstName: 'Other', lastName: 'Test', role: 'USER', status: 'ACTIVE',
      },
    });
    const now = Date.now();
    const addSession = (userId: string, key: string) => prisma.session.create({
      data: {
        userId, tenantId: tenant.id, token: 'audit-session-test-' + run + '-' + key,
        expiresAt: new Date(now + 60_000),
      },
    });
    const a = await addSession(user.id, 'a');
    const b = await addSession(user.id, 'b');
    const foreign = await addSession(otherUser.id, 'foreign');
    const req = { user: { userId: user.id, tenantId: tenant.id, sessionId: a.id } };
    const service = new SessionsService();
    await assert.rejects(() => service.revoke(req, foreign.id));
    assert.deepEqual(await service.revoke(req, a.id), { revoked: 1 });
    assert.deepEqual(await service.revoke(req, a.id), { revoked: 0 });
    assert.deepEqual(await service.revokeAll(req), { revoked: 1 });
    assert.deepEqual(await service.revokeAll(req), { revoked: 0 });
    assert.equal((await prisma.session.findUniqueOrThrow({ where: { id: foreign.id } })).revokedAt, null);
    assert.notEqual((await prisma.session.findUniqueOrThrow({ where: { id: b.id } })).revokedAt, null);
    const audit = await prisma.auditLog.findMany({ where: { userId: user.id, entityType: 'Session' } });
    assert.equal(audit.length, 2, 'retries and foreign revokes must not generate extra audit rows');
    assert.deepEqual(audit.map((event) => event.action).sort(), ['SESSIONS_REVOKED_ALL', 'SESSION_REVOKED']);
    for (const event of audit) {
      assert.equal(event.tenantId, tenant.id);
      assert.equal(JSON.stringify(event.newValues).includes('audit-session-test-'), false);
    }
  } finally {
    await prisma.tenant.delete({ where: { id: tenant.id } });
    await prisma.$disconnect();
  }
});

test('DB-backed failed login is recorded without submitted email or password; unauthorized audit reads are forbidden', {
  skip: process.env.CRM_DB_E2E !== '1',
}, async () => {
  const run = `${process.pid}-${Date.now()}`;
  const ip = 'audit-ip-' + run;
  const attemptedEmail = 'not-registered-' + run + '@example.test';
  const attemptedPassword = 'DO_NOT_STORE_PASSWORD_' + run;
  const req = { ip, headers: { 'user-agent': 'Auth audit E2E' } };
  const secret = 'test-only-secret-32-characters-minimum-0123456789';
  const jwt = new JwtService({ secret, signOptions: { expiresIn: '1h' } });
  const service = new AuthService(jwt, { get: (key: string) => key === 'JWT_SECRET' ? secret : undefined } as any);
  const controller = new AuthController(service);
  const reader = new LoginAttemptsService();
  try {
    await assert.rejects(
      () => controller.login({ email: attemptedEmail, password: attemptedPassword } as any, req),
      (error: any) => error?.status === 401,
    );
    const rows = await prisma.loginAttempt.findMany({ where: { ipAddress: ip } });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].success, false);
    assert.equal(rows[0].failureReason, 'INVALID_CREDENTIALS');
    assert.equal(rows[0].tenantId, null);
    assert.equal(rows[0].userId, null);
    assert.equal(rows[0].email, null);
    const serialized = JSON.stringify(rows[0]);
    assert.equal(serialized.includes(attemptedEmail), false);
    assert.equal(serialized.includes(attemptedPassword), false);
    await assert.rejects(
      () => reader.findAll({ user: { role: 'ADMIN' } }, { ipAddress: ip }),
      (error: any) => error?.status === 403,
    );
    const authorized = await reader.findAll(
      { user: { role: 'SUPER_ADMIN' } }, { ipAddress: ip, success: 'false' },
    );
    assert.equal(authorized.count, 1);
    assert.equal(authorized.data[0].id, rows[0].id);
  } finally {
    await prisma.loginAttempt.deleteMany({ where: { ipAddress: ip } });
    await prisma.$disconnect();
  }
});
