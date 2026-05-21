import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AlertsService } from './alerts.service';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AlertsService],
})
export class AnalyticsModule {}
