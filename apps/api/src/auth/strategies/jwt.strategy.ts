import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { prisma } from '@scc/database';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is required');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    if (payload?.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
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
    };
  }
}
