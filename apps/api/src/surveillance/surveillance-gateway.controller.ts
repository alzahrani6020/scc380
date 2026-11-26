import {
  BadRequestException, Body, Controller, ForbiddenException, Get,
  Headers, Injectable, NotFoundException, Param, Post, Req, UseGuards,
} from '@nestjs/common';
import { IsArray, IsIn, IsOptional, IsString, MaxLength, ArrayMaxSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { prisma } from '@scc/database';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// No network fetch is ever made to user-controlled camera URLs.
class RegisterGatewayDto {
  @IsString() @MaxLength(80) siteId!: string;
  @IsString() @MaxLength(120) name!: string;
}

class EdgeCameraStatusDto {
  @IsString() @MaxLength(80) cameraId!: string;
  @IsIn(['ONLINE', 'OFFLINE', 'DEGRADED']) status!: 'ONLINE' | 'OFFLINE' | 'DEGRADED';
}

class EdgeHeartbeatDto {
  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true })
  @Type(() => EdgeCameraStatusDto) cameras!: EdgeCameraStatusDto[];
}

const digest = (raw: string) => createHash('sha256').update(raw, 'utf8').digest('hex');

@Injectable()
@Controller('surveillance/gateways')
export class SurveillanceGatewayController {
  private admin(req: any) {
    if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(req.user?.role) ||
        !req.user?.tenantId || !req.user?.userId) {
      throw new ForbiddenException('Company administrator required');
    }
    return { tenantId: req.user.tenantId as string, userId: req.user.userId as string };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@Req() req: any) {
    const { tenantId } = this.admin(req);
    const rows = await prisma.surveillanceGateway.findMany({
      where: { tenantId },
      select: { id: true, siteId: true, name: true, tokenPrefix: true,
        lastSeenAt: true, revokedAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' }, take: 200,
    });
    const cutoff = Date.now() - 120_000;
    return rows.map(gateway => ({
      ...gateway,
      connectionState: gateway.revokedAt ? 'REVOKED'
        : !gateway.lastSeenAt ? 'NEVER_CONNECTED'
        : gateway.lastSeenAt.getTime() < cutoff ? 'STALE' : 'CONNECTED',
    }));
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async issue(@Req() req: any, @Body() dto: RegisterGatewayDto) {
    const { tenantId, userId } = this.admin(req);
    const site = await prisma.surveillanceSite.findFirst({
      where: { id: dto.siteId, tenantId }, select: { id: true },
    });
    if (!site) throw new NotFoundException('Site not found in tenant');
    if (!dto.name?.trim()) throw new BadRequestException('Gateway name required');
    const token = 'sccg_' + randomBytes(32).toString('base64url');
    const result = await prisma.surveillanceGateway.create({
      data: { tenantId, siteId: site.id, name: dto.name.trim(),
        tokenHash: digest(token), tokenPrefix: token.slice(0, 13), createdById: userId },
      select: { id: true, siteId: true, name: true },
    });
    // Response contains the single-use enrollment token only once. Never write it to logs or audit rows.
    return { ...result, enrollmentToken: token };
  }

  @Post(':id/revoke')
  @UseGuards(JwtAuthGuard)
  async revoke(@Req() req: any, @Param('id') id: string) {
    const { tenantId } = this.admin(req);
    const result = await prisma.surveillanceGateway.updateMany({
      where: { id, tenantId, revokedAt: null }, data: { revokedAt: new Date() },
    });
    if (result.count !== 1) throw new NotFoundException('Gateway not found or already revoked');
    return { status: 'REVOKED' };
  }

  private async verifyGateway(auth: string | undefined) {
    if (!auth || !/^Bearer sccg_[A-Za-z0-9_-]{43}$/.test(auth)) {
      throw new ForbiddenException('Valid gateway authentication required');
    }
    const token = auth.slice('Bearer '.length);
    const tokenHash = digest(token);
    const gateway = await prisma.surveillanceGateway.findUnique({
      where: { tokenHash }, select: { id: true, tenantId: true, siteId: true, revokedAt: true, tokenHash: true },
    });
    if (!gateway || gateway.revokedAt ||
        !timingSafeEqual(Buffer.from(gateway.tokenHash ?? tokenHash), Buffer.from(tokenHash))) {
      throw new ForbiddenException('Gateway credentials rejected');
    }
    return gateway;
  }

  @Post('heartbeat')
  async heartbeat(@Headers('authorization') authorization: string,
      @Body() dto: EdgeHeartbeatDto) {
    const gateway = await this.verifyGateway(authorization);
    const status = dto.cameras || [];
    if (Object.keys(dto).some(k => k !== 'cameras') ||
        !Array.isArray(status) || status.length > 100 ||
        status.some(c => !c || typeof c.cameraId !== 'string' ||
          !['ONLINE', 'OFFLINE', 'DEGRADED'].includes(c.status) ||
          Object.keys(c).some(k => !['cameraId', 'status'].includes(k)))) {
      throw new BadRequestException('Invalid gateway heartbeat payload');
    }
    if (new Set(status.map(c => c.cameraId)).size !== status.length) {
      throw new BadRequestException('Duplicate camera IDs');
    }
    const ids = status.map(c => c.cameraId);
    const actual = await prisma.surveillanceCamera.findMany({
      where: { id: { in: ids }, tenantId: gateway.tenantId, siteId: gateway.siteId },
      select: { id: true },
    });
    if (actual.length !== ids.length) throw new ForbiddenException('Camera not assigned to this gateway site');
    const now = new Date();
    await prisma.$transaction(async tx => {
      const active = await tx.surveillanceGateway.updateMany({
        where: { id: gateway.id, revokedAt: null }, data: { lastSeenAt: now },
      });
      if (active.count !== 1) throw new ForbiddenException('Gateway revoked');
      for (const camera of status) {
        await tx.surveillanceCamera.updateMany({
          where: { id: camera.cameraId, tenantId: gateway.tenantId, siteId: gateway.siteId },
          data: { connectionStatus: camera.status, lastSeenAt: now },
        });
      }
    });
    return { accepted: status.length, serverTime: now.toISOString() };
  }
}
