import { UnauthorizedException } from '@nestjs/common';
import { prisma } from '@scc/database';

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

  return {
    id: user.id,
    userId: user.id,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
    tenantSlug: user.tenant?.slug,
    sessionId: payload.sid,
  };
}
