import { Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SmartAlertsService } from './alerts.service';

@Controller('alerts')
@UseGuards(JwtAuthGuard)
export class AlertsController {
  constructor(private readonly service: SmartAlertsService) {}

  @Get()
  async getAlerts(@Req() req: any) {
    return this.service.generateAndGetAlerts(req.user?.tenantId, req.user?.role);
  }

  @Get('counts')
  async getCounts(@Req() req: any) {
    return this.service.getAlertCounts(req.user?.tenantId, req.user?.role);
  }

  @Post(':id/read')
  async markAsRead(@Req() req: any, @Param('id') id: string) {
    return this.service.markAsRead(id, req.user?.tenantId, req.user?.role);
  }

  @Post('read-all')
  async markAllAsRead(@Req() req: any) {
    return this.service.markAllAsRead(req.user?.tenantId, req.user?.role);
  }

  @Delete(':id')
  async dismiss(@Req() req: any, @Param('id') id: string) {
    return this.service.dismiss(id, req.user?.tenantId, req.user?.role);
  }
}
