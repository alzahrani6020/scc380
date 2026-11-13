import { Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller';
import { AlertsMaintenanceController } from './alerts-maintenance.controller';
import { SmartAlertsService } from './alerts.service';
import { AlertsGateway } from './gateway/alerts.gateway';

@Module({
  controllers: [AlertsController, AlertsMaintenanceController],
  providers: [SmartAlertsService, AlertsGateway],
  exports: [SmartAlertsService, AlertsGateway],
})
export class AlertsModule {}
