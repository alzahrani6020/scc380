import {
  BadRequestException, Body, ConflictException, Controller, ForbiddenException,
  Get, NotFoundException, Param, Post, Req, UseGuards,
} from '@nestjs/common';
import { prisma } from '@scc/database';
import { IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

class ShiftReasonDto {
  @IsString() @MaxLength(200) reason!: string;
}

/**
 * Administrative shift state; this controller does not enable phone GPS.
 * Tracking requires a separately authenticated device channel and verified MDM.
 */
@Controller('field-device-shifts')
@UseGuards(JwtAuthGuard)
export class FieldDeviceShiftsController {
  private scope(req: any, write = false) {
    const user = req?.user;
    const roles = write ? ['ADMIN'] : ['ADMIN', 'MANAGER', 'AUDITOR', 'READONLY'];
    if (!user?.tenantId || !user?.userId || !roles.includes(user.role)) {
      throw new ForbiddenException('Tenant management session required');
    }
    return { tenantId: user.tenantId as string, actorId: user.userId as string };
  }

  private validateBody(body: ShiftReasonDto): string {
    if (!body || Object.keys(body).some(key => key !== 'reason') ||
        typeof body.reason !== 'string' || !body.reason.trim() ||
        body.reason.length > 200) {
      throw new BadRequestException('A valid operational reason is required');
    }
    return body.reason.trim();
  }

  @Get(':deviceId')
  async list(@Req() req: any, @Param('deviceId') deviceId: string) {
    const { tenantId } = this.scope(req);
    const device = await prisma.fieldManagedDevice.findFirst({
      where: { tenantId, id: deviceId }, select: { id: true },
    });
    if (!device) throw new NotFoundException('Device not found in company');
    return prisma.fieldDeviceShift.findMany({
      where: { tenantId, deviceId },
      select: { id: true, startedAt: true, endedAt: true, startedById: true, endedById: true },
      orderBy: { startedAt: 'desc' }, take: 100,
    });
  }

  @Post(':deviceId/start')
  async start(@Req() req: any, @Param('deviceId') deviceId: string, @Body() dto: ShiftReasonDto) {
    const { tenantId, actorId } = this.scope(req, true);
    const reason = this.validateBody(dto);
    return prisma.$transaction(async tx => {
      const device = await tx.fieldManagedDevice.findFirst({
        where: { tenantId, id: deviceId },
        select: { assignedAt: true, noticeAcknowledgedAt: true, managementState: true },
      });
      if (!device) throw new NotFoundException('Device not found in company');
      if (!device.assignedAt || !device.noticeAcknowledgedAt ||
          device.managementState !== 'MANAGED') {
        throw new ForbiddenException('MDM verification, assignment and acknowledgment required');
      }
      const existing = await tx.fieldDeviceShift.findFirst({
        where: { tenantId, deviceId, endedAt: null }, select: { id: true },
      });
      if (existing) throw new ConflictException('Shift already active');
      const shift = await tx.fieldDeviceShift.create({
        data: { tenantId, deviceId, startedById: actorId },
      });
      await tx.fieldDeviceAudit.create({
        data: { tenantId, deviceId, actorUserId: actorId, action: 'SHIFT_START',
          decision: 'RECORDED', reason },
      });
      return shift;
    });
  }

  @Post(':deviceId/end')
  async end(@Req() req: any, @Param('deviceId') deviceId: string, @Body() dto: ShiftReasonDto) {
    const { tenantId, actorId } = this.scope(req, true);
    const reason = this.validateBody(dto);
    return prisma.$transaction(async tx => {
      const device = await tx.fieldManagedDevice.findFirst({
        where: { tenantId, id: deviceId }, select: { id: true },
      });
      if (!device) throw new NotFoundException('Device not found in company');
      const active = await tx.fieldDeviceShift.findFirst({
        where: { tenantId, deviceId, endedAt: null }, select: { id: true },
      });
      if (!active) throw new NotFoundException('No active shift');
      const result = await tx.fieldDeviceShift.updateMany({
        where: { id: active.id, tenantId, endedAt: null },
        data: { endedAt: new Date(), endedById: actorId },
      });
      if (!result.count) throw new ConflictException('Shift was closed concurrently');
      await tx.fieldDeviceAudit.create({
        data: { tenantId, deviceId, actorUserId: actorId,
          action: 'SHIFT_END', decision: 'RECORDED', reason },
      });
      return { shiftId: active.id, status: 'ENDED' };
    });
  }
}
