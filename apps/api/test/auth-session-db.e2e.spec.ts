import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JwtService } from '@nestjs/jwt';
import { prisma } from '@scc/database';
import { AuthService } from '../src/auth/auth.service';

test('DB-backed auth refresh preserves device session and blocks concurrent replay', {
  skip: process.env.CRM_DB_E2E !== '1' ? 'CRM_DB_E2E=1 is required' : false,
}, async () => {
  const unique = `${process.pid}-${Date.now()}`;
  const tenant = await prisma.tenant.create({
    data: {
      name: `Auth rotation E2E ${unique}`,
      slug: `auth-rotation-${unique}`,
      status: 'ACTIVE',
      plan: 'BASIC',
    },
  });
  try {
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: `auth-rotation-${unique}@example.test`,
        firstName: 'Auth',
        lastName: 'E2E',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
    const secret = 'test-only-secret-32-characters-minimum-0123456789';
    const jwt = new JwtService({ secret, signOptions: { expiresIn: '1h' } });
    const config = {
      get: (key: string) => key === 'JWT_SECRET' ? secret
        : key === 'REFRESH_TOKEN_EXPIRES_IN' ? '7d' : undefined,
    } as any;
    const auth = new AuthService(jwt, config);
    const req = { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' }, ip: '127.0.0.1' };
    const first = await auth.login(user.id, user.email, user.role, tenant.id, tenant.slug, req) as any;
    const firstSid = (jwt.decode(first.accessToken) as any).sid;
    assert.equal(typeof firstSid, 'string');
    const loggedIn = await prisma.auditLog.findMany({
      where: { userId: user.id, action: 'AUTH_LOGIN_SUCCESS' },
    });
    assert.equal(loggedIn.length, 1);
    assert.equal(loggedIn[0].entityId, firstSid);
    assert.deepEqual(loggedIn[0].newValues, { method: 'password', sessionId: firstSid });
    assert.equal(JSON.stringify(loggedIn[0]).includes(first.refreshToken), false);
    const firstAttempts = await prisma.loginAttempt.findMany({
      where: { userId: user.id },
    });
    assert.equal(firstAttempts.length, 1);
    assert.equal(firstAttempts[0].success, true);
    assert.equal(firstAttempts[0].tenantId, tenant.id);
    assert.equal(firstAttempts[0].ipAddress, '127.0.0.1');
    assert.equal(firstAttempts[0].email, null);
    assert.equal(JSON.stringify(firstAttempts).includes(first.refreshToken), false);
    const firstSession = await prisma.session.findUniqueOrThrow({ where: { id: firstSid } });
    assert.equal(firstSession.userAgent?.includes('Chrome/120'), true);
    assert.equal(firstSession.deviceInfo, 'Chrome · Windows');

    const rotated = await auth.refresh(first.refreshToken);
    assert.equal((jwt.decode(rotated.accessToken) as any).sid, firstSid);
    assert.notEqual(rotated.refreshToken, first.refreshToken);
    assert.equal(await prisma.session.count({ where: { userId: user.id } }), 1);

    const second = await auth.login(user.id, user.email, user.role, tenant.id, tenant.slug, req) as any;
    const secondSid = (jwt.decode(second.accessToken) as any).sid;
    assert.equal(await prisma.loginAttempt.count({
      where: { userId: user.id, success: true },
    }), 2);
    assert.notEqual(secondSid, firstSid);

    const simultaneous = await Promise.allSettled([
      auth.refresh(rotated.refreshToken),
      auth.refresh(rotated.refreshToken),
    ]);
    assert.equal(simultaneous.filter(x => x.status === 'fulfilled').length, 1);
    assert.equal(simultaneous.filter(x => x.status === 'rejected').length, 1);
    assert.equal(await prisma.session.count({ where: { userId: user.id } }), 2);
    await assert.rejects(() => auth.refresh(first.refreshToken));
    const logoutToken = simultaneous.find((x): x is PromiseFulfilledResult<any> => x.status === 'fulfilled')!.value.refreshToken;
    await auth.logout(logoutToken);
    await auth.logout(logoutToken);
    const logoutEvents = await prisma.auditLog.findMany({
      where: { userId: user.id, action: 'AUTH_LOGOUT_SUCCESS' },
    });
    assert.equal(logoutEvents.length, 1);
    assert.equal(logoutEvents[0].entityId, firstSid);
    assert.equal(JSON.stringify(logoutEvents[0]).includes(logoutToken), false);
    await auth.logoutAll(user.id, tenant.id);
    await auth.logoutAll(user.id, tenant.id);
    const logoutAllEvents = await prisma.auditLog.findMany({
      where: { userId: user.id, action: 'AUTH_LOGOUT_ALL_SUCCESS' },
    });
    assert.equal(logoutAllEvents.length, 1);
    assert.deepEqual(logoutAllEvents[0].newValues, { count: 1 });
    const other = await prisma.session.findUniqueOrThrow({ where: { id: secondSid } });
    assert.notEqual(other.revokedAt, null);
  } finally {
    await prisma.tenant.delete({ where: { id: tenant.id } });
    await prisma.$disconnect();
  }
});
