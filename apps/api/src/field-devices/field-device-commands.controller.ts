import {
  BadRequestException, Body, ConflictException, Controller, ForbiddenException,
  Get, NotFoundException, Param, Post, Req, UseGuards,
} from '@nestjs/common';
import { prisma } from '@scc/database';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

type CommandAction = 'LOCK' | 'WIPE' | 'SYNC_POLICY';

class CommandRequestDto {
  action!: CommandAction;
  reason!: string;
  idempotencyKey!: string;
}

/** Registers auditable intentions. There is deliberately NO device dispatch adapter. */
@Controller('field-device-commands')
@UseGuards(JwtAuthGuard)
export class FieldDeviceCommandsController {
  private identity(req: any, write = false) {
    const user = req?.user;
    if (!user?.tenantId || !user?.userId ||
      !(write ? ['ADMIN'] : ['ADMIN', 'MANAGER', 'AUDITOR', 'READONLY']).includes(user.role)) {
      throw new ForbiddenException('Tenant administrator session required');
    }
    return { tenantId: user.tenantId as string, actorId: user.userId as string };
  }

  private validate(dto: CommandRequestDto) {
    if (!dto || Object.keys(dto).some(k => !['action', 'reason', 'idempotencyKey'].includes(k)) ||
      !['LOCK', 'WIPE', 'SYNC_POLICY'].includes(dto.action) ||
      typeof dto.reason !== 'string' || !dto.reason.trim() || dto.reason.length > 500 ||
      typeof dto.idempotencyKey !== 'string' ||
      !/^[A-Za-z0-9_-]{16,100}$/.test(dto.idempotencyKey)) {
      throw new BadRequestException('Invalid command request or idempotency key');
    }
    return { action: dto.action, reason: dto.reason.trim(), idempotencyKey: dto.idempotencyKey };
  }

  @Get(':deviceId')
  async history(@Req() req: any, @Param('deviceId') deviceId: string) {
    const { tenantId } = this.identity(req);
    const device = await prisma.fieldManagedDevice.findFirst({
      where: { tenantId, id: deviceId }, select: { id: true },
    });
    if (!device) throw new NotFoundException('Device not found in company');
    return prisma.fieldDeviceCommand.findMany({
      where: { tenantId, deviceId }, orderBy: { createdAt: 'desc' }, take: 100,
      select: { id: true, action: true, status: true, reason: true,
        requestedById: true, approvedById: true, createdAt: true, completedAt: true },
    });
  }

  @Post(':deviceId')
  async request(@Req() req: any, @Param('deviceId') deviceId: string,
    @Body() dto: CommandRequestDto) {
    const { tenantId, actorId } = this.identity(req, true);
    const body = this.validate(dto);
    const device = await prisma.fieldManagedDevice.findFirst({
      where: { id: deviceId, tenantId },
      select: { id: true, provider: true, managementState: true },
    });
    if (!device) throw new NotFoundException('Device not found in company');

    const existing = await prisma.fieldDeviceCommand.findFirst({
      where: { tenantId, idempotencyKey: body.idempotencyKey },
      select: { id: true, deviceId: true, action: true, reason: true, status: true },
    });
    if (existing) {
      if (existing.deviceId !== deviceId || existing.action !== body.action ||
        existing.reason !== body.reason) {
        throw new ConflictException('Idempotency key reused with a different command');
      }
      return existing;
    }
    try {
      return await prisma.$transaction(async tx => {
        const command = await tx.fieldDeviceCommand.create({
          data: { tenantId, deviceId, requestedById: actorId, action: body.action,
            reason: body.reason, idempotencyKey: body.idempotencyKey,
            status: 'NOT_DISPATCHED' },
          select: { id: true, action: true, status: true, createdAt: true },
        });
        await tx.fieldDeviceAudit.create({
          data: { tenantId, deviceId, actorUserId: actorId,
            action: 'COMMAND_REQUEST_' + body.action, decision: 'NOT_DISPATCHED',
            reason: body.reason },
        });
        return command;
      });
    } catch (error: any) {
      if (error?.code === 'P2002') throw new ConflictException('Concurrent idempotent command request');
      throw error;
    }
  }

  @Post(':deviceId/:commandId/approve')
  async approve(@Req() req: any, @Param('deviceId') deviceId: string,
    @Param('commandId') commandId: string) {
    const { tenantId, actorId } = this.identity(req, true);
    return prisma.$transaction(async tx => {
      const device = await tx.fieldManagedDevice.findFirst({
        where: { id: deviceId, tenantId }, select: { id: true },
      });
      if (!device) throw new NotFoundException('Device not found in company');
      const command = await tx.fieldDeviceCommand.findFirst({
        where: { id: commandId, tenantId, deviceId },
        select: { id: true, requestedById: true, approvedById: true, action: true, status: true },
      });
      if (!command) throw new NotFoundException('Command not found in company');
      if (command.requestedById === actorId) {
        throw new ForbiddenException('Requester cannot approve their own command');
      }
      if (command.status !== 'NOT_DISPATCHED' || command.approvedById) {
        throw new ConflictException('Command already approved or processed');
      }
      const changed = await tx.fieldDeviceCommand.updateMany({
        where: { id: commandId, tenantId, deviceId, approvedById: null, status: 'NOT_DISPATCHED' },
        data: { approvedById: actorId },
      });
      if (!changed.count) throw new ConflictException('Approval changed concurrently');
      await tx.fieldDeviceAudit.create({
        data: { tenantId, deviceId, actorUserId: actorId,
          action: 'COMMAND_APPROVE_' + command.action, decision: 'APPROVED_NOT_DISPATCHED',
          reason: 'Provider-backed device execution remains disabled' },
      });
      return { commandId, approved: true, status: 'NOT_DISPATCHED' };
    });
  }
}
