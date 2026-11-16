import {
  Body, Controller, HttpCode, Optional, Post, ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '@scc/database';
import Redis from 'ioredis';
import {
  BondsProofPurpose, verifyBondsMappingProof,
} from './bonds-mapping-assertion';

@Controller('integrations/bonds')
export class BondsMappingController {
  // JwtService is optional to preserve the independent mapping verifier when
  // unit-tested standalone; issuing sessions still fails closed without it.
  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly jwt?: JwtService,
  ) {}

  private async authenticateAssertion(assertion: string, purpose: BondsProofPurpose) {
    // Verify asymmetric signature and explicit audience BEFORE Redis or SQL.
    const claims = verifyBondsMappingProof(
      assertion,
      this.config.get<string>('BONDS_MAKKIN_PUBLIC_KEY_PEM'),
      Math.floor(Date.now() / 1000),
      purpose,
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
      const inserted = await redis.set(
        'bonds:mapping:proof:' + claims.jti, 'consumed', 'EX', 90, 'NX',
      );
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
        select: { id: true, slug: true, status: true, deletedAt: true },
      }),
      prisma.user.findUnique({
        where: { id: claims.userId },
        select: {
          id: true, email: true, emailVerified: true,
          status: true, tenantId: true, deletedAt: true,
          role: true, twoFactorEnabled: true,
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
    return { claims, tenant, user, matched };
  }

  @Post('verify-mapping')
  @HttpCode(200)
  async verifyMapping(@Body('assertion') assertion: string) {
    const { matched } = await this.authenticateAssertion(assertion, 'verify-identity-only');
    // Never reveal SCC user/tenant IDs or create an SCC session.
    return { matched, operationalReady: false };
  }

  @Post('program-session')
  @HttpCode(200)
  async issueScopedProgramSession(@Body('assertion') assertion: string) {
    if (!this.jwt || !this.config.get<string>('JWT_SECRET')) {
      throw new ServiceUnavailableException('BONDS session exchange unavailable');
    }
    const { claims, matched, tenant, user } = await this.authenticateAssertion(
      assertion, 'issue-program-session',
    );
    if (!matched || !tenant || !user) {
      throw new UnauthorizedException('BONDS identity is not linked to an active SCC account');
    }
    // Preserve existing SCC380 two-factor protection. Never substitute proof
    // of email ownership for a mandatory SCC380 second factor.
    if (user.twoFactorEnabled) {
      throw new UnauthorizedException('SCC second-factor verification required');
    }
    const expiresInSeconds = 110;
    const sessionId = randomBytes(24).toString('hex');
    const unusableRefreshHash = createHash('sha256')
      .update(randomBytes(48)).digest('hex');
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    const accessToken = await prisma.$transaction(async (tx) => {
      // Recheck status and tenant binding at issuance time.
      const current = await tx.user.findUnique({
        where: { id: user.id },
        select: {
          status: true, deletedAt: true, tenantId: true, twoFactorEnabled: true,
          email: true, emailVerified: true,
          tenant: { select: { status: true, deletedAt: true } },
        },
      });
      if (!current || current.status !== 'ACTIVE' || current.deletedAt ||
          current.twoFactorEnabled || !current.emailVerified ||
          current.tenantId !== tenant.id || current.tenant?.status !== 'ACTIVE' ||
          current.tenant.deletedAt ||
          current.email.trim().toLowerCase() !== claims.email) {
        throw new UnauthorizedException('BONDS account verification changed');
      }
      await tx.session.create({
        data: {
          id: sessionId,
          userId: user.id,
          tenantId: tenant.id,
          token: unusableRefreshHash,
          expiresAt,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          tenantId: tenant.id,
          action: 'BONDS_SCOPED_PROGRAM_SESSION_ISSUED',
          entityType: 'Session',
          entityId: sessionId,
          newValues: {
            origin: 'bonds', programKey: claims.programKey,
            workspaceLinkId: claims.workspaceLinkId,
            expiresAt: expiresAt.toISOString(),
          },
        },
      });
      return this.jwt!.sign({
        sub: user.id, email: user.email, role: user.role,
        tenantId: tenant.id, tenantSlug: tenant.slug,
        type: 'access', sid: sessionId,
        bondsOrigin: true, bondsProgramKey: claims.programKey,
        bondsWorkspaceLinkId: claims.workspaceLinkId,
      }, { expiresIn: expiresInSeconds });
    });
    // No refresh token. SCC JWT expires in at most 110 seconds; every
    // subsequent session needs a newly authorized BONDS entitlement check.
    return {
      accessToken, expiresInSeconds,
      programKey: claims.programKey,
      operationalParityVerified: false,
    };
  }
}
