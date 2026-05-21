import { Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller';
import { SmartAlertsService } from './alerts.service';
import { AlertsGateway } from './gateway/alerts.gateway';

@Module({
  controllers: [AlertsController],
  providers: [SmartAlertsService, AlertsGateway],
  exports: [SmartAlertsService, AlertsGateway],
})
export class AlertsModule {}
