import {
  BadRequestException, Body, Controller, ForbiddenException, Get, Headers,
  Injectable, NotFoundException, Param, Post, Req, UseGuards,
} from '@nestjs/common';
import { IsIn, IsString, MaxLength } from 'class-validator';
import { prisma } from '@scc/database';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// This is an audited *request* protocol; it does not enable PTZ, audio or media playback.
// An approved site-side ONVIF/vendor adapter and functional tests are required before execution.
const ptzActions = ['PTZ_LEFT', 'PTZ_RIGHT', 'PTZ_UP', 'PTZ_DOWN', 'ZOOM_IN', 'ZOOM_OUT', 'PTZ_STOP'] as const;
class RequestDeviceCommandDto {
  @IsString() @MaxLength(80) cameraId!: string;
  @IsIn(ptzActions) action!: typeof ptzActions[number];
}
class RejectCommandDto {
  @IsIn(['UNSUPPORTED', 'FAILED']) resultCode!: 'UNSUPPORTED' | 'FAILED';
}
class CompleteCommandDto {
  @IsString() @MaxLength(100) leaseToken!: string;
  @IsIn(['SOAP_ACKNOWLEDGED', 'FAILED']) resultCode!: 'SOAP_ACKNOWLEDGED' | 'FAILED';
}
const digest = (raw: string) => createHash('sha256').update(raw, 'utf8').digest('hex');

@Injectable()
@Controller('surveillance/device-commands')
export class SurveillanceDeviceCommandsController {
  private admin(req: any) {
    if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(req.user?.role) ||
        !req.user?.tenantId || !req.user?.userId)
      throw new ForbiddenException('Company administrator required');
    return { tenantId: req.user.tenantId as string, userId: req.user.userId as string };
  }
  private async gateway(authorization?: string) {
    if (!authorization || !/^Bearer sccg_[A-Za-z0-9_-]{43}$/.test(authorization))
      throw new ForbiddenException('Gateway authentication required');
    const hashed = digest(authorization.slice(7));
    const row = await prisma.surveillanceGateway.findUnique({
      where: { tokenHash: hashed },
      select: { id: true, tokenHash: true, tenantId: true, siteId: true, revokedAt: true },
    });
    if (!row || row.revokedAt ||
        !timingSafeEqual(Buffer.from(row.tokenHash), Buffer.from(hashed)))
      throw new ForbiddenException('Gateway credentials rejected');
    return row;
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async request(@Req() req: any, @Body() dto: RequestDeviceCommandDto) {
    const { tenantId, userId } = this.admin(req);
    // Never accept a client-selected site, tenant, gateway, role or device address.
    if (Object.keys(dto).some(k => !['cameraId', 'action'].includes(k)))
      throw new BadRequestException('Unexpected command field');
    const camera = await prisma.surveillanceCamera.findFirst({
      where: { id: dto.cameraId, tenantId },
      select: { id: true, siteId: true, supportsPtz: true, connectionStatus: true, lastSeenAt: true },
    });
    if (!camera) throw new NotFoundException('Camera not found in tenant');
    if (!camera.supportsPtz) throw new BadRequestException('Camera has no declared PTZ capability');
    if (!camera.lastSeenAt || camera.lastSeenAt.getTime() < Date.now() - 120_000 ||
        camera.connectionStatus !== 'ONLINE')
      throw new BadRequestException('Camera connection is not confirmed fresh');
    const gateway = await prisma.surveillanceGateway.findFirst({
      where: { tenantId, siteId: camera.siteId, revokedAt: null,
        lastSeenAt: { gte: new Date(Date.now() - 120_000) } },
      orderBy: { lastSeenAt: 'desc' }, select: { id: true },
    });
    if (!gateway) throw new BadRequestException('No recently connected authorized gateway');
    const command = await prisma.surveillanceDeviceCommand.create({
      data: { tenantId, siteId: camera.siteId, cameraId: camera.id,
        gatewayId: gateway.id, action: dto.action, createdById: userId,
        expiresAt: new Date(Date.now() + 15_000) },
      select: { id: true, action: true, status: true, expiresAt: true },
    });
    // QUEUED means only that an auditable command intent was stored, NOT movement.
    return { ...command, deviceExecuted: false };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  history(@Req() req: any) {
    const { tenantId } = this.admin(req);
    return prisma.surveillanceDeviceCommand.findMany({
      where: { tenantId },
      select: { id: true, cameraId: true, action: true, status: true,
        resultCode: true, createdAt: true, expiresAt: true, acknowledgedAt: true },
      orderBy: { createdAt: 'desc' }, take: 100,
    });
  }

  @Get('pending')
  async pending(@Headers('authorization') authorization: string) {
    const gateway = await this.gateway(authorization);
    // Transport integration only. An edge adapter MUST validate action and device again.
    const rows = await prisma.surveillanceDeviceCommand.findMany({
      where: { tenantId: gateway.tenantId, siteId: gateway.siteId,
        gatewayId: gateway.id, status: 'QUEUED', expiresAt: { gt: new Date() } },
      select: { id: true, cameraId: true, action: true, expiresAt: true },
      orderBy: { createdAt: 'asc' }, take: 20,
    });
    return { commands: rows, executionEnabled: process.env.SCC_SURVEILLANCE_PTZ_PILOT_ENABLED === 'YES' };
  }

  @Post(':id/claim')
  async claim(@Headers('authorization') authorization: string, @Param('id') id: string) {
    if (process.env.SCC_SURVEILLANCE_PTZ_PILOT_ENABLED !== 'YES')
      throw new ForbiddenException('Physical PTZ pilot is disabled');
    const gateway = await this.gateway(authorization);
    const now = new Date();
    const leaseToken = randomBytes(32).toString('base64url');
    // Atomic compare-and-set; only one agent can take a command before its deadline.
    const claimed = await prisma.surveillanceDeviceCommand.updateMany({
      where: { id, tenantId: gateway.tenantId, siteId: gateway.siteId,
        gatewayId: gateway.id, status: 'QUEUED', expiresAt: { gt: now } },
      data: { status: 'CLAIMED', claimedAt: now, leaseTokenHash: digest(leaseToken) },
    });
    if (claimed.count !== 1) throw new NotFoundException('Command unavailable or expired');
    const command = await prisma.surveillanceDeviceCommand.findFirst({
      where: { id, tenantId: gateway.tenantId, gatewayId: gateway.id },
      select: { id: true, cameraId: true, action: true, expiresAt: true },
    });
    if (!command) throw new NotFoundException('Command unavailable');
    return { ...command, leaseToken, deviceExecuted: false };
  }

  @Post(':id/complete')
  async complete(@Headers('authorization') authorization: string,
    @Param('id') id: string, @Body() dto: CompleteCommandDto) {
    const gateway = await this.gateway(authorization);
    if (!/^[A-Za-z0-9_-]{43}$/.test(dto.leaseToken))
      throw new ForbiddenException('Invalid command lease');
    const now = new Date();
    const done = await prisma.surveillanceDeviceCommand.updateMany({
      where: { id, tenantId: gateway.tenantId, siteId: gateway.siteId,
        gatewayId: gateway.id, status: 'CLAIMED',
        leaseTokenHash: digest(dto.leaseToken), expiresAt: { gt: now } },
      data: { status: dto.resultCode === 'SOAP_ACKNOWLEDGED' ? 'ACKNOWLEDGED' : 'FAILED',
        resultCode: dto.resultCode, acknowledgedAt: now, leaseTokenHash: null },
    });
    if (done.count !== 1) throw new NotFoundException('Command lease expired or already consumed');
    return { status: dto.resultCode === 'SOAP_ACKNOWLEDGED' ? 'ACKNOWLEDGED' : 'FAILED',
      deviceMovementVerified: false };
  }

  @Post(':id/reject')
  async reject(@Headers('authorization') authorization: string,
    @Param('id') id: string, @Body() dto: RejectCommandDto) {
    const gateway = await this.gateway(authorization);
    const updated = await prisma.surveillanceDeviceCommand.updateMany({
      where: { id, tenantId: gateway.tenantId, siteId: gateway.siteId,
        gatewayId: gateway.id, status: 'QUEUED', expiresAt: { gt: new Date() } },
      data: { status: 'REJECTED', resultCode: dto.resultCode, acknowledgedAt: new Date() },
    });
    if (updated.count !== 1) throw new NotFoundException('Command unavailable, expired or already processed');
    return { status: 'REJECTED', deviceExecuted: false };
  }
}
