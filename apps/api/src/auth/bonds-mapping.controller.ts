import {
  Body, Controller, HttpCode, Post, ServiceUnavailableException, UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { prisma } from '@scc/database';
import Redis from 'ioredis';
import { verifyBondsMappingProof } from './bonds-mapping-assertion';

@Controller('integrations/bonds')
export class BondsMappingController {
  constructor(private readonly config: ConfigService) {}

  @Post('verify-mapping')
  @HttpCode(200)
  async verifyMapping(@Body('assertion') assertion: string) {
    // Public-key verification happens BEFORE database, Redis, or any identity
    // lookup. This is NOT SCC login, SSO, refresh, session or app authorization.
    const claims = verifyBondsMappingProof(
      assertion,
      this.config.get<string>('BONDS_MAKKIN_PUBLIC_KEY_PEM'),
    );
    const redisUrl = this.config.get<string>('REDIS_URL');
    if (!redisUrl) throw new ServiceUnavailableException('BONDS verifier replay store unavailable');
    const redis = new Redis(redisUrl, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
    });
    try {
      await redis.connect();
      const replayKey = 'bonds:mapping:proof:' + claims.jti;
      const inserted = await redis.set(replayKey, 'consumed', 'EX', 90, 'NX');
      if (inserted !== 'OK') throw new UnauthorizedException('Mapping proof already consumed');
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new ServiceUnavailableException('BONDS verifier replay store unavailable');
    } finally {
      redis.disconnect();
    }
    const [tenant, user] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: claims.tenantId },
        select: { id: true, status: true, deletedAt: true },
      }),
      prisma.user.findUnique({
        where: { id: claims.userId },
        select: {
          id: true, email: true, emailVerified: true,
          status: true, tenantId: true, deletedAt: true,
          role: true,
        },
      }),
    ]);
    const matched = Boolean(
      tenant && tenant.status === 'ACTIVE' && !tenant.deletedAt &&
      user && user.status === 'ACTIVE' && !user.deletedAt &&
      user.tenantId === tenant.id && user.role !== 'SUPER_ADMIN' &&
      user.emailVerified && claims.emailConfirmed &&
      user.email.trim().toLowerCase() === claims.email,
    );
    // Do not expose names, external identifiers, PII or SCC session tokens.
    return { matched, operationalReady: false };
  }
}
