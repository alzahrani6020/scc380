import {
  ConflictException, Controller, ForbiddenException, NotFoundException, Param, Post, Req,
  Res, ServiceUnavailableException, UseGuards,
} from '@nestjs/common';
import { prisma } from '@scc/database';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { makeAndroidMdmAdapter } from './android-management.runtime';

/** Single-use, time-limited corporate provisioning QR; no simulated enrollments. */
@Controller('field-device-enrollment')
@UseGuards(JwtAuthGuard)
export class FieldDeviceEnrollmentController {
  @Post(':deviceId/android')
  async android(@Req() req: any, @Param('deviceId') deviceId: string,
    @Res({ passthrough: true }) res: Response) {
    const user = req?.user;
    if (!user?.tenantId || !user?.userId || user.role !== 'ADMIN') {
      throw new ForbiddenException('Company administrator session required');
    }
    res.setHeader('Cache-Control', 'no-store, private');
    res.setHeader('Pragma', 'no-cache');

    const device = await prisma.fieldManagedDevice.findFirst({
      where: { id: deviceId, tenantId: user.tenantId },
      select: { id: true, assetTag: true, platform: true, managementState: true,
        providerDeviceId: true },
    });
    if (!device) throw new NotFoundException('Device not found in company');
    if (device.platform !== 'ANDROID' || device.managementState !== 'UNCONFIGURED' ||
      device.providerDeviceId) {
      throw new ForbiddenException('Only unconfigured Android company assets can enroll');
    }

    // Bound repeated short-lived tokens per asset; throttle before Google API.
    const recent = await prisma.fieldDeviceAudit.count({
      where: { tenantId: user.tenantId, deviceId, action: 'ANDROID_ENROLLMENT_REQUEST',
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
    });
    if (recent >= 4) throw new HttpException('Enrollment attempts exceeded for this asset', HttpStatus.TOO_MANY_REQUESTS);

    let adapter;
    try {
      adapter = makeAndroidMdmAdapter();
      if (!(await adapter.verifyTenantConnection(user.tenantId))) {
        throw new ServiceUnavailableException('Android MDM is not configured or verified');
      }
    } catch {
      throw new ServiceUnavailableException('Android MDM is not configured or verified');
    }
    await prisma.fieldDeviceAudit.create({
      data: { tenantId: user.tenantId, deviceId,
        actorUserId: user.userId, action: 'ANDROID_ENROLLMENT_REQUEST',
        decision: 'REQUESTED', reason: 'One-time fully managed corporate provisioning' },
    });
    let response;
    try {
      response = await adapter.requestEnrollment(user.tenantId, 'ANDROID', device.assetTag);
    } catch {
      // No credential, provider response or enrollment secret is exposed in errors.
      throw new ServiceUnavailableException('Android MDM could not issue enrollment token');
    }
    await prisma.fieldDeviceAudit.create({
      data: { tenantId: user.tenantId, deviceId,
        actorUserId: user.userId, action: 'ANDROID_ENROLLMENT_TOKEN_ISSUED',
        decision: 'PENDING_DEVICE_ENROLLMENT',
        reason: 'Provider token issued; actual device enrollment not yet verified' },
    });
    // Only return transient QR to authenticated company admin, never store token.
    return {
      deviceId, enrollmentQrData: response.enrollmentQrData,
      expiresAt: response.expiresAt, provider: 'ANDROID_MANAGEMENT_API',
      status: 'PENDING_DEVICE_ENROLLMENT',
      deviceManaged: false,
    };
  }
  @Post(':deviceId/android/verify')
  async verifyAndroidEnrollment(@Req() req: any, @Param('deviceId') deviceId: string) {
    const user = req?.user;
    if (!user?.tenantId || !user?.userId || user.role !== 'ADMIN') {
      throw new ForbiddenException('Company administrator session required');
    }
    const device = await prisma.fieldManagedDevice.findFirst({
      where: { id: deviceId, tenantId: user.tenantId },
      select: { id: true, assetTag: true, platform: true, managementState: true,
        providerDeviceId: true },
    });
    if (!device) throw new NotFoundException('Device not found in company');
    if (device.platform !== 'ANDROID') {
      throw new ForbiddenException('Only Android devices can use this verification');
    }
    let adapter;
    try {
      adapter = makeAndroidMdmAdapter();
      if (!(await adapter.verifyTenantConnection(user.tenantId))) {
        throw new ServiceUnavailableException('Android MDM is not configured or verified');
      }
    } catch {
      throw new ServiceUnavailableException('Android MDM is not configured or verified');
    }
    let verified: { providerDeviceId: string; lastSeenAt: Date } | null;
    try {
      verified = await adapter.findVerifiedDevice(user.tenantId, device.assetTag);
    } catch {
      throw new ServiceUnavailableException('Android provider verification could not complete');
    }
    if (!verified) {
      return { deviceId, managementState: device.managementState,
        verified: false, status: 'PENDING_DEVICE_ENROLLMENT' };
    }
    if (device.managementState === 'MANAGED') {
      if (device.providerDeviceId !== verified.providerDeviceId) {
        throw new ConflictException('Provider device does not match the linked company asset');
      }
      return { deviceId, managementState: 'MANAGED', verified: true };
    }
    if (device.managementState !== 'UNCONFIGURED' || device.providerDeviceId) {
      throw new ConflictException('Unexpected device state during enrollment verification');
    }
    try {
      return await prisma.$transaction(async tx => {
        const changed = await tx.fieldManagedDevice.updateMany({
          where: { id: deviceId, tenantId: user.tenantId,
            platform: 'ANDROID', managementState: 'UNCONFIGURED', providerDeviceId: null },
          data: { managementState: 'MANAGED', provider: 'ANDROID_MANAGEMENT_API',
            providerDeviceId: verified!.providerDeviceId, lastSeenAt: verified!.lastSeenAt },
        });
        if (!changed.count) throw new ConflictException('Device status changed during verification');
        await tx.fieldDeviceAudit.create({ data: {
          tenantId: user.tenantId, deviceId, actorUserId: user.userId,
          action: 'ANDROID_DEVICE_ENROLLMENT_VERIFIED', decision: 'PROVIDER_VERIFIED',
          reason: 'Device owner, corporate ownership, policy and compliance confirmed by Google API',
        } });
        return { deviceId, managementState: 'MANAGED', verified: true,
          lastSeenAt: verified!.lastSeenAt };
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException('Provider device is already linked to another company asset');
      }
      throw error;
    }
  }

}
