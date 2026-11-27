import {
  BadRequestException, Body, ConflictException, Controller, ForbiddenException,
  NotFoundException, Param, Post, Req, UseGuards,
} from '@nestjs/common';
import { prisma } from '@scc/database';
import { IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

class AssignDto {
  @IsString() @MaxLength(80) employeeId!: string;
  @IsString() @MaxLength(80) noticeVersion!: string;
}
class AcknowledgeDto {
  @IsString() @MaxLength(80) noticeVersion!: string;
}

/** Tracks allocation and an independently authenticated employee acknowledgment. */
@Controller('field-device-assignments')
@UseGuards(JwtAuthGuard)
export class FieldDeviceAssignmentsController {
  private identity(req: any) {
    if (!req.user?.tenantId || !req.user?.userId) {
      throw new ForbiddenException('Authenticated tenant identity required');
    }
    return { tenantId: req.user.tenantId as string, actorId: req.user.userId as string, role: req.user.role as string };
  }
  private rejectServerFields(dto: object) {
    if (['tenantId','actorId','userId','role','noticeAcknowledgedAt','managementState'].some(
      key => Object.prototype.hasOwnProperty.call(dto, key))) {
      throw new BadRequestException('Server-managed field supplied');
    }
  }

  @Post(':deviceId')
  async assign(@Req() req: any, @Param('deviceId') deviceId: string, @Body() dto: AssignDto) {
    const { tenantId, actorId, role } = this.identity(req);
    if (role !== 'ADMIN') throw new ForbiddenException('Company administrator required');
    if (!dto || typeof dto.employeeId !== 'string' || !dto.employeeId.trim() ||
        typeof dto.noticeVersion !== 'string' || !dto.noticeVersion.trim() ||
        dto.employeeId.length > 80 || dto.noticeVersion.length > 80) throw new BadRequestException('Invalid assignment');
    this.rejectServerFields(dto);
    const employee = await prisma.employee.findFirst({ where: { id: dto.employeeId, tenantId }, select: { id: true } });
    if (!employee) throw new NotFoundException('Employee not found in company');
    return prisma.$transaction(async tx => {
      const changed = await tx.fieldManagedDevice.updateMany({
        where: { id: deviceId, tenantId, assignedAt: null },
        data: { employeeId: employee.id, assignedAt: new Date(),
          noticeVersion: dto.noticeVersion.trim(), noticeAcknowledgedAt: null },
      });
      if (!changed.count) throw new ConflictException('Device not found or already assigned');
      await tx.fieldDeviceAudit.create({ data: { tenantId, deviceId, actorUserId: actorId,
        action: 'ASSIGN', decision: 'RECORDED', reason: 'Employee acknowledgment pending' } });
      return { deviceId, employeeId: employee.id, noticeVersion: dto.noticeVersion.trim(),
        noticeAcknowledged: false, status: 'AWAITING_EMPLOYEE_ACKNOWLEDGMENT' };
    });
  }

  @Post(':deviceId/acknowledge')
  async acknowledge(@Req() req: any, @Param('deviceId') deviceId: string, @Body() dto: AcknowledgeDto) {
    const { tenantId, actorId } = this.identity(req);
    if (!dto || typeof dto.noticeVersion !== 'string' || !dto.noticeVersion.trim() ||
        dto.noticeVersion.length > 80) throw new BadRequestException('Valid notice version required');
    this.rejectServerFields(dto);
    return prisma.$transaction(async tx => {
      const employee = await tx.employee.findFirst({
        where: { tenantId, userId: actorId }, select: { id: true },
      });
      if (!employee) throw new ForbiddenException('A linked employee login is required');
      const changed = await tx.fieldManagedDevice.updateMany({
        where: { id: deviceId, tenantId, employeeId: employee.id,
          noticeVersion: dto.noticeVersion.trim(), noticeAcknowledgedAt: null },
        data: { noticeAcknowledgedAt: new Date() },
      });
      if (!changed.count) throw new ConflictException('No pending matching notice for assigned employee');
      await tx.fieldDeviceAudit.create({ data: { tenantId, deviceId, actorUserId: actorId,
        action: 'NOTICE_ACKNOWLEDGED', decision: 'RECORDED',
        reason: 'Employee explicitly acknowledged version ' + dto.noticeVersion.trim() } });
      return { deviceId, noticeVersion: dto.noticeVersion.trim(), acknowledged: true };
    });
  }
}
