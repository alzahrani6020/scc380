import { Controller, Get, Post, Delete, Headers, Param } from '@nestjs/common';
import { SmartAlertsService } from './alerts.service';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly service: SmartAlertsService) {}

  @Get()
  async getAlerts(@Headers('x-tenant-id') tenantId: string) {
    return this.service.generateAndGetAlerts(tenantId, 'SUPER_ADMIN');
  }

  @Get('counts')
  async getCounts(@Headers('x-tenant-id') tenantId: string) {
    return this.service.getAlertCounts(tenantId, 'SUPER_ADMIN');
  }

  @Post(':id/read')
  async markAsRead(@Param('id') id: string, @Headers('x-tenant-id') tenantId: string) {
    return this.service.markAsRead(id, tenantId, 'SUPER_ADMIN');
  }

  @Post('read-all')
  async markAllAsRead(@Headers('x-tenant-id') tenantId: string) {
    return this.service.markAllAsRead(tenantId, 'SUPER_ADMIN');
  }

  @Delete(':id')
  async dismiss(@Param('id') id: string, @Headers('x-tenant-id') tenantId: string) {
    return this.service.dismiss(id, tenantId, 'SUPER_ADMIN');
  }
}
