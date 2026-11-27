import {
  Controller, ForbiddenException, Get, Req, UseGuards,
} from '@nestjs/common';
import { prisma } from '@scc/database';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Read-only operational overview: derived solely from tenant-owned records.
 * It is NOT proof of a currently playable camera stream or managed handset.
 */
@Controller('field-operations')
@UseGuards(JwtAuthGuard)
export class FieldOperationsController {
  @Get('overview')
  async overview(@Req() req: any) {
    const user = req?.user;
    if (!user?.tenantId || !user?.userId ||
      !['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'AUDITOR', 'READONLY'].includes(user.role)) {
      throw new ForbiddenException('Authenticated company operations role required');
    }
    const tenantId = user.tenantId as string;
    const cutoff = new Date(Date.now() - 120_000);
    const [
      sites, cameras, gateways, devices, openIncidents, pendingMaintenance,
      unconfirmedCommands,
    ] = await Promise.all([
      prisma.surveillanceSite.count({ where: { tenantId } }),
      prisma.surveillanceCamera.findMany({ where: { tenantId },
        select: { id: true, siteId: true, connectionStatus: true, lastSeenAt: true,
          supportsAudio: true, supportsTalk: true, supportsPtz: true, cameraType: true },
        take: 2000 }),
      prisma.surveillanceGateway.findMany({ where: { tenantId },
        select: { id: true, siteId: true, lastSeenAt: true, revokedAt: true },
        take: 1000 }),
      prisma.fieldManagedDevice.findMany({ where: { tenantId },
        select: { id: true, platform: true, managementState: true,
          lastSeenAt: true, provider: true }, take: 2000 }),
      prisma.surveillanceIncident.count({ where: { tenantId, status: { in: ['OPEN', 'ACKNOWLEDGED'] } } }),
      prisma.surveillanceMaintenance.count({ where: { tenantId, status: { in: ['PENDING', 'IN_PROGRESS'] } } }),
      prisma.fieldDeviceCommand.count({ where: { tenantId,
        status: { in: ['NOT_DISPATCHED', 'DISPATCH_UNCERTAIN', 'PROVIDER_ACCEPTED', 'PROVIDER_PENDING'] } } }),
    ]);
    const gatewayConnected = gateways.filter(g => !g.revokedAt &&
      g.lastSeenAt && g.lastSeenAt >= cutoff).length;
    const cameraFresh = cameras.filter(c => c.connectionStatus === 'ONLINE' &&
      c.lastSeenAt && c.lastSeenAt >= cutoff).length;
    const cameraDegraded = cameras.filter(c => c.connectionStatus === 'DEGRADED' &&
      c.lastSeenAt && c.lastSeenAt >= cutoff).length;
    const phoneRecentlyReported = devices.filter(d => d.managementState === 'MANAGED' &&
      d.lastSeenAt && d.lastSeenAt >= cutoff).length;

    return {
      asOf: new Date().toISOString(),
      tenantScoped: true,
      cameraCoverage: { total: cameras.length, freshOnline: cameraFresh,
        degraded: cameraDegraded, staleOrOffline: cameras.length - cameraFresh - cameraDegraded,
        sites, gateways: gateways.length, connectedGateways: gatewayConnected,
        audioCapable: cameras.filter(c => c.supportsAudio).length,
        talkCapable: cameras.filter(c => c.supportsTalk).length,
        ptzCapable: cameras.filter(c => c.supportsPtz).length,
        vehicleCameras: cameras.filter(c => c.cameraType.startsWith('DASHCAM')).length },
      fieldDevices: { total: devices.length,
        android: devices.filter(d => d.platform === 'ANDROID').length,
        ios: devices.filter(d => d.platform === 'IOS').length,
        managedRecords: devices.filter(d => d.managementState === 'MANAGED').length,
        recentlyReported: phoneRecentlyReported,
        unconfigured: devices.filter(d => d.managementState === 'UNCONFIGURED').length },
      workflow: { openIncidents, pendingMaintenance, unconfirmedCommands },
      acceptance: {
        playableStreamsVerified: false,
        liveDeviceControlVerified: false,
        gpsIngestionVerified: false,
        liveMediaSessionVerified: false,
        note: 'Counts and heartbeats are operational metadata, not independent proof of physical media or device execution',
      },
    };
  }
}
