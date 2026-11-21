import { Controller, Get, Post, Body, Query, Request, Res, UseGuards, ForbiddenException, BadRequestException } from '@nestjs/common';
import { prisma } from '@scc/database';
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

  @Get('dashboard')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getDashboardStats(@Request() req: any) {
    return this.service.getDashboardStats(req.user.tenantId, req.user.role);
  }

  @Get('crm')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getCrmStats(@Request() req: any, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.getCrmStats(req.user.tenantId, req.user.role, from, to);
  }

  @Get('erp')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getErpStats(@Request() req: any, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.getErpStats(req.user.tenantId, req.user.role, from, to);
  }

  @Get('fleet')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getFleetStats(@Request() req: any) {
    return this.service.getFleetStats(req.user.tenantId, req.user.role);
  }

  @Get('hr')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getHrStats(@Request() req: any) {
    return this.service.getHrStats(req.user.tenantId, req.user.role);
  }

  @Get('projects')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getProjectStats(@Request() req: any) {
    return this.service.getProjectStats(req.user.tenantId, req.user.role);
  }

  @Get('finance')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getFinanceStats(@Request() req: any) {
    return this.service.getFinanceStats(req.user.tenantId, req.user.role);
  }

  @Get('revenue-trend')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getRevenueTrend(@Request() req: any) {
    return this.service.getInvoiceRevenueTrend(req.user.tenantId, req.user.role);
  }

  // Events are strictly server-attributed to the authenticated session.
  // This is not anonymous visitor analytics and must never receive credentials or full URLs.
  @Post('activity/event')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async recordActivity(@Request() req: any, @Body() body: { action?: string; path?: string }) {
    const action = body?.action;
    const path = body?.path;
    if (!['PAGE_VIEW', 'DOWNLOAD_REQUEST'].includes(action || '') ||
        typeof path !== 'string' || !/^\/[a-zA-Z0-9/_-]{0,180}$/.test(path) ||
        !path.startsWith('/dashboard')) {
      throw new BadRequestException('Invalid activity event');
    }
    await prisma.auditLog.create({
      data: {
        tenantId: req.user.tenantId ?? null,
        userId: req.user.userId,
        action: action!,
        entityType: 'SITE_ACTIVITY',
        httpMethod: 'EVENT',
        httpPath: path,
        ipAddress: typeof req.ip === 'string' ? req.ip : null,
        userAgent: typeof req.headers?.['user-agent'] === 'string'
          ? req.headers['user-agent'].slice(0, 256) : null,
      },
    });
    return { recorded: true };
  }

  private activityScope(req: any, from?: string, to?: string) {
    if (!['SUPER_ADMIN', 'ADMIN', 'AUDITOR'].includes(req.user.role)) {
      throw new ForbiddenException('Activity monitoring requires administrator or auditor access');
    }
    const parse = (input: string | undefined) => {
      if (!input) return undefined;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) throw new BadRequestException('Invalid date');
      const d = new Date(input + 'T00:00:00.000Z');
      if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== input)
        throw new BadRequestException('Invalid date');
      return d;
    };
    if (req.user.role !== 'SUPER_ADMIN' && !req.user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    const start = parse(from);
    const end = parse(to);
    if (end) end.setUTCDate(end.getUTCDate() + 1);
    if (start && end && start >= end) throw new BadRequestException('Invalid date range');
    const createdAt = { ...(start ? { gte: start } : {}), ...(end ? { lt: end } : {}) };
    // A tenant administrator/auditor may never see another tenant.
    return {
      tenantId: req.user.role === 'SUPER_ADMIN' ? undefined : req.user.tenantId,
      createdAt,
    };
  }

  private async activityRows(req: any, from?: string, to?: string) {
    const scope = this.activityScope(req, from, to);
    const tenantWhere = scope.tenantId ? { tenantId: scope.tenantId } : {};
    const events = await prisma.auditLog.findMany({
      where: { ...tenantWhere, createdAt: scope.createdAt },
      select: {
        id: true, action: true, httpPath: true, responseStatus: true,
        createdAt: true, userId: true, ipAddress: true,
        user: { select: { email: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });
    return { events, scope, tenantWhere };
  }

  @Get('activity')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getActivity(@Request() req: any, @Query('from') from?: string, @Query('to') to?: string) {
    const { events, scope, tenantWhere } = await this.activityRows(req, from, to);
    const [sessions, logins] = await Promise.all([
      prisma.session.findMany({
        where: { ...tenantWhere, createdAt: scope.createdAt },
        select: {
          id: true, createdAt: true, lastActiveAt: true, revokedAt: true,
          expiresAt: true, ipAddress: true,
          user: { select: { email: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.loginAttempt.findMany({
        where: { ...tenantWhere, createdAt: scope.createdAt },
        select: { id: true, email: true, success: true, createdAt: true, failureReason: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);
    return {
      summary: {
        recordedEvents: events.length,
        pageViews: events.filter(e => e.action === 'PAGE_VIEW').length,
        downloadRequests: events.filter(e => e.action === 'DOWNLOAD_REQUEST').length,
        reportExports: events.filter(e => e.action === 'REPORT_EXPORTED').length,
        sessions: sessions.length,
        failedLogins: logins.filter(l => !l.success).length,
      },
      events, sessions, logins,
      limited: events.length === 1000 || sessions.length === 100 || logins.length === 100,
    };
  }

  @Get('activity/export')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async exportActivity(@Request() req: any, @Res() res: any,
    @Query('from') from?: string, @Query('to') to?: string) {
    const { events } = await this.activityRows(req, from, to);
    const safe = (value: unknown): string => {
      let str = String(value ?? '').replace(/[\r\n]+/g, ' ').slice(0, 500);
      if (/^[\s]*[=+@-]/.test(str)) str = "'" + str;
      return '"' + str.replace(/"/g, '""') + '"';
    };
    const columns = ['UTC time', 'User', 'Email', 'Action', 'Path', 'HTTP status', 'IP'];
    const rows = events.map(e => [
      e.createdAt.toISOString(),
      [e.user?.firstName, e.user?.lastName].filter(Boolean).join(' '),
      e.user?.email ?? '', e.action, e.httpPath ?? '', e.responseStatus ?? '', e.ipAddress ?? '',
    ]);
    const csv = '\uFEFF' + [columns, ...rows].map(row => row.map(safe).join(',')).join('\r\n');
    await prisma.auditLog.create({
      data: {
        tenantId: req.user.tenantId ?? null,
        userId: req.user.userId,
        action: 'REPORT_EXPORTED',
        entityType: 'SITE_ACTIVITY',
        httpMethod: 'GET',
        httpPath: '/analytics/activity/export',
      },
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="scc380-activity.csv"');
    res.setHeader('Cache-Control', 'no-store');
    res.send(csv);
  }

  @Get('alerts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getAlerts(@Request() req: any) {
    return this.alertsService.getAlerts(req.user.tenantId, req.user.role);
  }
}
