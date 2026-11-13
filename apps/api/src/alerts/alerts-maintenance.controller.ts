import {
  Controller,
  Headers,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { SmartAlertsService } from './alerts.service';

@Controller('internal/maintenance')
export class AlertsMaintenanceController {
  constructor(private readonly service: SmartAlertsService) {}

  @Post('hr-expiry-alerts')
  async runHrExpiryAlerts(@Headers('x-cron-secret') suppliedSecret?: string) {
    const expectedSecret = process.env.HR_ALERTS_CRON_SECRET;
    if (!expectedSecret) {
      throw new ServiceUnavailableException('HR expiry scheduler is not configured');
    }
    if (!suppliedSecret || !this.sameSecret(suppliedSecret, expectedSecret)) {
      throw new UnauthorizedException();
    }
    return this.service.generateHrExpiryAlertsForAllTenants();
  }

  private sameSecret(supplied: string, expected: string) {
    const suppliedBuffer = Buffer.from(supplied);
    const expectedBuffer = Buffer.from(expected);
    if (suppliedBuffer.length !== expectedBuffer.length) return false;
    return timingSafeEqual(suppliedBuffer, expectedBuffer);
  }
}
