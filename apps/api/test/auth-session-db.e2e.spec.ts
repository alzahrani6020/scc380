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
    const firstSession = await prisma.session.findUniqueOrThrow({ where: { id: firstSid } });
    assert.equal(firstSession.userAgent?.includes('Chrome/120'), true);
    assert.equal(firstSession.deviceInfo, 'Chrome · Windows');

    const rotated = await auth.refresh(first.refreshToken);
    assert.equal((jwt.decode(rotated.accessToken) as any).sid, firstSid);
    assert.notEqual(rotated.refreshToken, first.refreshToken);
    assert.equal(await prisma.session.count({ where: { userId: user.id } }), 1);

    const second = await auth.login(user.id, user.email, user.role, tenant.id, tenant.slug, req) as any;
    const secondSid = (jwt.decode(second.accessToken) as any).sid;
    assert.notEqual(secondSid, firstSid);

    const simultaneous = await Promise.allSettled([
      auth.refresh(rotated.refreshToken),
      auth.refresh(rotated.refreshToken),
    ]);
    assert.equal(simultaneous.filter(x => x.status === 'fulfilled').length, 1);
    assert.equal(simultaneous.filter(x => x.status === 'rejected').length, 1);
    assert.equal(await prisma.session.count({ where: { userId: user.id } }), 2);
    await assert.rejects(() => auth.refresh(first.refreshToken));
    const other = await prisma.session.findUniqueOrThrow({ where: { id: secondSid } });
    assert.equal(other.revokedAt, null);
  } finally {
    await prisma.tenant.delete({ where: { id: tenant.id } });
    await prisma.$disconnect();
  }
});
