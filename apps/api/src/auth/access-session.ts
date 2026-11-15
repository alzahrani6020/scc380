import { UnauthorizedException } from '@nestjs/common';
import { prisma } from '@scc/database';
import { BONDS_PROGRAM_KEYS } from './bonds-program-scope';

export async function validateAccessSessionPayload(payload: any) {
  if (payload?.type !== 'access') {
    throw new UnauthorizedException('Invalid token type');
  }

  if (!payload?.sub) {
    throw new UnauthorizedException('Invalid access token');
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      emailVerified: true,
      tenantId: true,
      tenant: { select: { slug: true, status: true } },
    },
  });

  if (!user || user.status !== 'ACTIVE') {
    throw new UnauthorizedException('Account is not active');
  }
  if (user.tenant && user.tenant.status !== 'ACTIVE') {
    throw new UnauthorizedException('Tenant is not active');
  }
  if (user.role !== 'SUPER_ADMIN' && !user.tenantId) {
    throw new UnauthorizedException('Tenant context is required');
  }
  if (!payload?.sid) {
    throw new UnauthorizedException('Session is required');
  }

  const session = await prisma.session.findUnique({
    where: { id: payload.sid },
    select: {
      userId: true,
      tenantId: true,
      revokedAt: true,
      expiresAt: true,
    },
  });

  if (
    !session ||
    session.userId !== user.id ||
    session.revokedAt ||
    session.expiresAt <= new Date() ||
    (session.tenantId || null) !== (user.tenantId || null)
  ) {
    throw new UnauthorizedException('Session is not active');
  }

  const isBondsScope = payload.bondsOrigin === true;
  if (isBondsScope && (
    !BONDS_PROGRAM_KEYS.includes(payload.bondsProgramKey) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.bondsWorkspaceLinkId || '') ||
    !user.emailVerified || user.role === 'SUPER_ADMIN' ||
    payload.tenantId !== user.tenantId ||
    typeof payload.iat !== 'number' || typeof payload.exp !== 'number' ||
    payload.exp - payload.iat > 120 || payload.exp <= payload.iat
  )) {
    throw new UnauthorizedException('Invalid BONDS program session');
  }

  return {
    id: user.id,
    userId: user.id,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
    tenantSlug: user.tenant?.slug,
    sessionId: payload.sid,
    ...(isBondsScope ? { bondsOrigin: true, bondsProgramKey: payload.bondsProgramKey,
      bondsWorkspaceLinkId: payload.bondsWorkspaceLinkId } : {}),
  };
}
