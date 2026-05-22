import { Controller, Post, Get, Body, Param, Query, Request, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WasslService } from './wassl.service';
import { prisma, withTenant } from '@scc/database';

@ApiTags('Fleet - Telemetry & Tracking')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('fleet/telemetry')
export class TelemetryController {
  constructor(private readonly wasslService: WasslService) {}

  @Post(':vehicleId')
  async ingest(
    @Request() req,
    @Param('vehicleId') vehicleId: string,
    @Body()
    body: {
      deviceId: string;
      latitude: number;
      longitude: number;
      speed: number;
      heading?: number;
      altitude?: number;
      accuracy?: number;
      ignitionOn?: boolean;
      engineHours?: number;
      recordedAt?: string;
    },
  ) {
    return this.wasslService.submitTelemetry(req.user.tenantId, vehicleId, {
      ...body,
      recordedAt: body.recordedAt || new Date().toISOString(),
    });
  }

  @Post(':vehicleId/batch')
  async ingestBatch(
    @Request() req,
    @Param('vehicleId') vehicleId: string,
    @Body() body: { points: Array<{
      deviceId: string;
      latitude: number;
      longitude: number;
      speed: number;
      heading?: number;
      altitude?: number;
      accuracy?: number;
      ignitionOn?: boolean;
      engineHours?: number;
      recordedAt: string;
    }> },
  ) {
    return this.wasslService.submitTelemetryBatch(
      req.user.tenantId,
      vehicleId,
      body.points,
    );
  }

  @Get(':vehicleId/history')
  async history(
    @Request() req,
    @Param('vehicleId') vehicleId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    const where = withTenant({ vehicleId }, req.user.tenantId);
    if (from || to) {
      (where as any).recordedAt = {};
      if (from) (where as any).recordedAt.gte = new Date(from);
      if (to) (where as any).recordedAt.lte = new Date(to);
    }
    return prisma.vehicleGpsLog.findMany({
      where,
      orderBy: { recordedAt: 'desc' },
      take: limit || 100,
    });
  }

  @Get(':vehicleId/latest')
  async latest(@Request() req, @Param('vehicleId') vehicleId: string) {
    const where = withTenant({ vehicleId }, req.user.tenantId);
    const [log, vehicle] = await Promise.all([
      prisma.vehicleGpsLog.findFirst({ where, orderBy: { recordedAt: 'desc' } }),
      prisma.vehicle.findFirst({ where: withTenant({ id: vehicleId }, req.user.tenantId) }),
    ]);
    return { log, vehicleLastUpdated: vehicle?.lastLocationAt };
  }

  @Get(':vehicleId/speed-violations')
  async speedViolations(
    @Request() req,
    @Param('vehicleId') vehicleId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const where = withTenant({ vehicleId, type: 'SPEEDING' }, req.user.tenantId);
    if (from || to) {
      (where as any).occurredAt = {};
      if (from) (where as any).occurredAt.gte = new Date(from);
      if (to) (where as any).occurredAt.lte = new Date(to);
    }
    return prisma.fleetViolation.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
    });
  }
}
