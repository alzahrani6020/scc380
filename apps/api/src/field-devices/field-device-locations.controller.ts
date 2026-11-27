import { Controller, ForbiddenException, Get, NotFoundException, Param, Req, UseGuards } from '@nestjs/common';
import { prisma } from '@scc/database';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/** Historical, work-shift-only locations from verified future device telemetry. */
@Controller('field-device-locations')
@UseGuards(JwtAuthGuard)
export class FieldDeviceLocationsController {
  @Get(':deviceId')
  async history(@Req() req: any, @Param('deviceId') deviceId: string) {
    const user = req?.user;
    if (!user?.tenantId || !user?.userId || !['ADMIN', 'AUDITOR'].includes(user.role)) {
      throw new ForbiddenException('Authorized tenant location reviewer required');
    }
    const device = await prisma.fieldManagedDevice.findFirst({
      where: { id: deviceId, tenantId: user.tenantId },
      select: { id: true, noticeAcknowledgedAt: true, managementState: true },
    });
    if (!device) throw new NotFoundException('Device not found in company');
    if (!device.noticeAcknowledgedAt || device.managementState !== 'MANAGED') {
      throw new ForbiddenException('Verified management and employee notice required');
    }
    return prisma.fieldDeviceLocation.findMany({
      where: { tenantId: user.tenantId, deviceId, shift: { startedAt: { lte: new Date() } } },
      select: { id: true, shiftId: true, recordedAt: true, receivedAt: true,
        latitude: true, longitude: true, accuracyMeters: true, source: true },
      orderBy: { recordedAt: 'desc' }, take: 100,
    });
  }
}
