import {
  ConflictException, Controller, ForbiddenException, NotFoundException, Param,
  Post, Req, ServiceUnavailableException, UseGuards,
} from '@nestjs/common';
import { prisma } from '@scc/database';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { makeAndroidMdmAdapter } from './android-management.runtime';

/**
 * Safe real-provider LOCK dispatch. This intentionally does not support WIPE.
 * The persisted DISPATCH_UNCERTAIN status is never automatically retried.
 */
@Controller('field-device-dispatch')
@UseGuards(JwtAuthGuard)
export class FieldDeviceDispatchController {
  private admin(req: any) {
    const user = req?.user;
    if (!user?.tenantId || !user?.userId || user.role !== 'ADMIN') {
      throw new ForbiddenException('Authenticated company administrator required');
    }
    return { tenantId: user.tenantId as string, actorId: user.userId as string };
  }

  @Post(':deviceId/:commandId/lock')
  async lock(@Req() req: any, @Param('deviceId') deviceId: string,
    @Param('commandId') commandId: string) {
    const { tenantId, actorId } = this.admin(req);
    const device = await prisma.fieldManagedDevice.findFirst({
      where: { tenantId, id: deviceId },
      select: { id: true, platform: true, provider: true, providerDeviceId: true,
        managementState: true, noticeAcknowledgedAt: true, lastSeenAt: true },
    });
    if (!device) throw new NotFoundException('Device not found in company');
    if (device.platform !== 'ANDROID' || device.provider !== 'ANDROID_MANAGEMENT_API' ||
        device.managementState !== 'MANAGED' || !device.providerDeviceId ||
        !device.noticeAcknowledgedAt ||
        !device.lastSeenAt || Date.now() - device.lastSeenAt.getTime() > 24 * 60 * 60 * 1000) {
      throw new ForbiddenException('A recently verified company-managed Android device is required');
    }
    const command = await prisma.fieldDeviceCommand.findFirst({
      where: { id: commandId, tenantId, deviceId },
      select: { id: true, action: true, requestedById: true,
        approvedById: true, status: true },
    });
    if (!command) throw new NotFoundException('Company command not found');
    if (command.action !== 'LOCK' || !command.approvedById ||
        command.approvedById === command.requestedById ||
        command.status !== 'NOT_DISPATCHED') {
      throw new ForbiddenException('Only independently approved, undispatched LOCK commands are supported');
    }
    // Tenant binding verified before acquiring the irreversible dispatch claim.
    const adapter = makeAndroidMdmAdapter();
    if (!(await adapter.verifyTenantConnection(tenantId))) {
      throw new ServiceUnavailableException('Android Enterprise connection not verified');
    }
    const claimed = await prisma.$transaction(async tx => {
      const updated = await tx.fieldDeviceCommand.updateMany({
        where: { id: commandId, tenantId, deviceId, action: 'LOCK',
          approvedById: command.approvedById, status: 'NOT_DISPATCHED' },
        data: { status: 'DISPATCH_UNCERTAIN' },
      });
      if (!updated.count) return false;
      await tx.fieldDeviceAudit.create({ data: {
        tenantId, deviceId, actorUserId: actorId, action: 'LOCK_DISPATCH_CLAIM',
        decision: 'DISPATCH_UNCERTAIN',
        reason: 'Single dispatch claimed; provider outcome not established',
      } });
      return true;
    });
    if (!claimed) throw new ConflictException('Command already claimed for dispatch');
    // A crash or network timeout here stays UNCERTAIN. Never auto-retry.
    try {
      const receipt = await adapter.submitCommand(tenantId, device.providerDeviceId, 'LOCK');
      if (receipt.status !== 'PROVIDER_ACCEPTED' || receipt.deviceConfirmed) {
        throw new Error('PROVIDER_ACCEPTANCE_INVALID');
      }
      await prisma.$transaction(async tx => {
        const updated = await tx.fieldDeviceCommand.updateMany({
          where: { id: commandId, tenantId, deviceId, status: 'DISPATCH_UNCERTAIN' },
          data: { status: 'PROVIDER_ACCEPTED', providerReceipt: receipt.providerRequestId },
        });
        if (!updated.count) throw new ConflictException('Command state changed while saving receipt');
        await tx.fieldDeviceAudit.create({ data: {
          tenantId, deviceId, actorUserId: actorId,
          action: 'LOCK_PROVIDER_ACCEPTED', decision: 'PROVIDER_ACCEPTED',
          reason: 'Google accepted request; physical lock not independently confirmed',
        } });
      });
      return { commandId, status: 'PROVIDER_ACCEPTED', deviceConfirmed: false };
    } catch {
      // No success report when transmission or receipt persistence is uncertain.
      throw new ServiceUnavailableException(
        'Command outcome uncertain; inspect provider and audit before any retry');
    }
  }

  @Post(':deviceId/:commandId/verify')
  async verify(@Req() req: any, @Param('deviceId') deviceId: string,
    @Param('commandId') commandId: string) {
    const { tenantId, actorId } = this.admin(req);
    const device = await prisma.fieldManagedDevice.findFirst({
      where: { id: deviceId, tenantId },
      select: { provider: true, providerDeviceId: true, managementState: true },
    });
    if (!device) throw new NotFoundException('Device not found in company');
    const command = await prisma.fieldDeviceCommand.findFirst({
      where: { id: commandId, deviceId, tenantId },
      select: { action: true, status: true, providerReceipt: true },
    });
    if (!command) throw new NotFoundException('Company command not found');
    if (command.action !== 'LOCK' || !device.providerDeviceId ||
        device.provider !== 'ANDROID_MANAGEMENT_API' ||
        !command.providerReceipt ||
        !['PROVIDER_ACCEPTED', 'PROVIDER_PENDING', 'PROVIDER_COMPLETED', 'PROVIDER_FAILED'].includes(command.status)) {
      throw new ConflictException('Command lacks a verifiable Google provider receipt');
    }
    const adapter = makeAndroidMdmAdapter();
    let status: 'PROVIDER_PENDING' | 'PROVIDER_COMPLETED' | 'PROVIDER_FAILED';
    try {
      status = await adapter.readCommandOperation(tenantId, device.providerDeviceId, command.providerReceipt);
    } catch {
      throw new ServiceUnavailableException('Cannot verify command operation with Google');
    }
    if (command.status !== status) {
      await prisma.$transaction(async tx => {
        const changed = await tx.fieldDeviceCommand.updateMany({
          where: { id: commandId, tenantId, deviceId, providerReceipt: command.providerReceipt!,
            status: command.status },
          data: { status, ...(status !== 'PROVIDER_PENDING' ? { completedAt: new Date() } : {}) },
        });
        if (changed.count) {
          await tx.fieldDeviceAudit.create({ data: { tenantId, deviceId,
            actorUserId: actorId, action: 'LOCK_PROVIDER_OPERATION_CHECK',
            decision: status, reason: 'Verified against Google operation; not a live physical observation' } });
        }
      });
    }
    return { commandId, status, providerVerified: true,
      deviceConfirmed: false };
  }
}
