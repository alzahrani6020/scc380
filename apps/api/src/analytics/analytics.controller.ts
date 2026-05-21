import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';
import { AlertsService } from './alerts.service';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private service: AnalyticsService,
    private alertsService: AlertsService,
  ) {}

  @Get('public-summary')
  async getPublicSummary() {
    return this.service.getDashboardStats(undefined, 'SUPER_ADMIN');
  }

  @Get('dashboard')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getDashboardStats(@Request() req: any) {
    return this.service.getDashboardStats(req.user.tenantId, req.user.role);
  }

  @Get('crm')
  async getCrmStats(@Request() req: any, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.getCrmStats(req.user.tenantId, req.user.role, from, to);
  }

  @Get('erp')
  async getErpStats(@Request() req: any, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.getErpStats(req.user.tenantId, req.user.role, from, to);
  }

  @Get('fleet')
  async getFleetStats(@Request() req: any) {
    return this.service.getFleetStats(req.user.tenantId, req.user.role);
  }

  @Get('hr')
  async getHrStats(@Request() req: any) {
    return this.service.getHrStats(req.user.tenantId, req.user.role);
  }

  @Get('projects')
  async getProjectStats(@Request() req: any) {
    return this.service.getProjectStats(req.user.tenantId, req.user.role);
  }

  @Get('finance')
  async getFinanceStats(@Request() req: any) {
    return this.service.getFinanceStats(req.user.tenantId, req.user.role);
  }

  @Get('revenue-trend')
  async getRevenueTrend(@Request() req: any) {
    return this.service.getInvoiceRevenueTrend(req.user.tenantId, req.user.role);
  }

  @Get('alerts')
  async getAlerts(@Request() req: any) {
    return this.alertsService.getAlerts(req.user.tenantId, req.user.role);
  }
}
