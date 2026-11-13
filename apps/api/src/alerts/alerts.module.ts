import { Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller';
import { AlertsMaintenanceController } from './alerts-maintenance.controller';
import { SmartAlertsService } from './alerts.service';
import { AlertsGateway } from './gateway/alerts.gateway';
import { HrExpiryAlertsScheduler } from './hr-expiry-alerts.scheduler';

@Module({
  controllers: [AlertsController, AlertsMaintenanceController],
  providers: [SmartAlertsService, AlertsGateway, HrExpiryAlertsScheduler],
  exports: [SmartAlertsService, AlertsGateway],
})
export class AlertsModule {}
