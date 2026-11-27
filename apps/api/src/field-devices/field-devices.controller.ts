import { Controller, ForbiddenException, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Read-only provider readiness API. Never claim that an unconfigured MDM,
 * location service or media server can control a physical device.
 */
@Controller('field-devices')
@UseGuards(JwtAuthGuard)
export class FieldDevicesController {
  private scope(req: any) {
    const user = req.user;
    if (!user?.tenantId || !user?.userId ||
      !['ADMIN', 'MANAGER', 'AUDITOR', 'READONLY'].includes(user.role)) {
      throw new ForbiddenException('Authenticated company management role required');
    }
    return { tenantId: user.tenantId, userId: user.userId };
  }

  @Get('capabilities')
  capabilities(@Req() req: any) {
    this.scope(req);
    return {
      status: 'NOT_CONFIGURED',
      enrollment: { android: 'NOT_CONFIGURED', ios: 'NOT_CONFIGURED' },
      compliance: 'NOT_CONFIGURED',
      location: 'NOT_CONFIGURED',
      screenControl: { android: 'REQUIRES_INTERACTION', ios: 'UNSUPPORTED' },
      media: 'REQUIRES_VISIBLE_ACCEPTED_SESSION',
      personalMessages: 'UNSUPPORTED',
      corporateMessaging: 'NOT_CONFIGURED',
      commands: 'NOT_CONFIGURED',
      note: 'Capabilities are descriptive only; no device or MDM provider is connected.',
    };
  }
}
