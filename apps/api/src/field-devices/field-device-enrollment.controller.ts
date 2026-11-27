import {
  Controller, ForbiddenException, NotFoundException, Param, Post, Req,
  Res, ServiceUnavailableException, TooManyRequestsException, UseGuards,
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
    if (recent >= 4) throw new TooManyRequestsException('Enrollment attempts exceeded for this asset');

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
}
