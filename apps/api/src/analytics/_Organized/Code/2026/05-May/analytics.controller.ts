import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';
import { AlertsService } from './alerts.service';

@ApiTags('Analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(
    private service: AnalyticsService,
    private alertsService: AlertsService,
  ) {}

  @Get('dashboard')
  async getDashboardStats(@Request() req) {
    return this.service.getDashboardStats(req.user.tenantId, req.user.role);
  }

  @Get('crm')
  async getCrmStats(@Request() req, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.getCrmStats(req.user.tenantId, req.user.role, from, to);
  }

  @Get('erp')
  async getErpStats(@Request() req, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.getErpStats(req.user.tenantId, req.user.role, from, to);
  }

  @Get('fleet')
  async getFleetStats(@Request() req) {
    return this.service.getFleetStats(req.user.tenantId, req.user.role);
  }

  @Get('hr')
  async getHrStats(@Request() req) {
    return this.service.getHrStats(req.user.tenantId, req.user.role);
  }

  @Get('projects')
  async getProjectStats(@Request() req) {
    return this.service.getProjectStats(req.user.tenantId, req.user.role);
  }

  @Get('finance')
  async getFinanceStats(@Request() req) {
    return this.service.getFinanceStats(req.user.tenantId, req.user.role);
  }

  @Get('revenue-trend')
  async getRevenueTrend(@Request() req) {
    return this.service.getInvoiceRevenueTrend(req.user.tenantId, req.user.role);
  }

  @Get('alerts')
  async getAlerts(@Request() req) {
    return this.alertsService.getAlerts(req.user.tenantId, req.user.role);
  }
}
