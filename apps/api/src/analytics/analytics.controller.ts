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
    this.requireOwner(req);
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

  // Download entitlements live in append-only audit events, preserving owner decisions.
  // A paid invoice is never accepted unless both the customer and an exact product SKU match.
  private readonly reportPartialSku = 'SCC380-ACTIVITY-REPORT-PARTIAL';
  private readonly reportFullSku = 'SCC380-ACTIVITY-REPORT-FULL';

  private requireOwner(req: any) {
    if (req.user?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Owner authorization required');
    }
  }

  private async latestOwnerDecision(userId: string, tenantId: string | null) {
    const row = await prisma.auditLog.findFirst({
      where: {
        entityType: 'ACTIVITY_REPORT_ACCESS',
        entityId: userId,
        action: { in: ['DOWNLOAD_ACCESS_APPROVED', 'DOWNLOAD_ACCESS_REVOKED'] },
        tenantId,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { action: true, newValues: true },
    });
    const values = row?.newValues as { scope?: string } | null;
    return row?.action === 'DOWNLOAD_ACCESS_APPROVED'
      ? values?.scope === 'FULL' ? 'FULL' : 'PARTIAL'
      : null;
  }

  private async verifiedPaidScope(req: any, invoiceNumber?: string) {
    if (!invoiceNumber) return null;
    if (typeof invoiceNumber !== 'string' || invoiceNumber.length > 80) {
      throw new BadRequestException('Invalid invoice reference');
    }
    if (!req.user.tenantId || !req.user.email) return null;
    const purchaser = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { emailVerified: true },
    });
    if (!purchaser?.emailVerified) return null;
    const contactIds = (await prisma.contact.findMany({
      where: { tenantId: req.user.tenantId, email: { equals: req.user.email, mode: 'insensitive' } },
      select: { id: true },
    })).map(c => c.id);
    if (!contactIds.length) return null;
    const invoice = await prisma.invoice.findFirst({
      where: {
        tenantId: req.user.tenantId,
        invoiceNumber,
        contactId: { in: contactIds },
        status: 'PAID',
        // The paid product must be the specific downloadable report.
        items: {
          some: { product: { sku: { in: [this.reportPartialSku, this.reportFullSku] } } },
        },
      },
      select: {
        total: true,
        payments: { select: { amount: true, status: true } },
        items: { select: { product: { select: { sku: true } } } },
      },
    });
    if (!invoice) return null;
    const settled = invoice.payments
      .filter(p => p.status === 'COMPLETED')
      .reduce((sum, p) => sum + Number(p.amount), 0);
    if (!(Number(invoice.total) > 0) || settled + 0.009 < Number(invoice.total)) return null;
    return invoice.items.some(i => i.product?.sku === this.reportFullSku) ? 'FULL' : 'PARTIAL';
  }

  private async requireExportAccess(req: any, requested: string, invoiceNumber?: string) {
    if (!['FULL', 'PARTIAL'].includes(requested)) {
      throw new BadRequestException('scope must be FULL or PARTIAL');
    }
    // Log all authenticated attempts before an entitlement check, including denials.
    await prisma.auditLog.create({
      data: {
        tenantId: req.user.tenantId ?? null,
        userId: req.user.userId,
        action: 'DOWNLOAD_REQUEST',
        entityType: 'SITE_ACTIVITY',
        httpMethod: 'GET',
        httpPath: '/analytics/activity/export',
        newValues: { scope: requested },
      },
    });
    if (req.user.role === 'SUPER_ADMIN') return 'OWNER';
    if (!['ADMIN', 'AUDITOR'].includes(req.user.role) || !req.user.tenantId) {
      throw new ForbiddenException('Download access unavailable');
    }
    const [ownerDecision, paid] = await Promise.all([
      this.latestOwnerDecision(req.user.userId, req.user.tenantId),
      this.verifiedPaidScope(req, invoiceNumber),
    ]);
    if (ownerDecision === 'FULL' || paid === 'FULL') return ownerDecision === 'FULL' ? 'OWNER_APPROVED' : 'PAID';
    if (requested === 'PARTIAL' && (ownerDecision === 'PARTIAL' || paid === 'PARTIAL')) {
      return ownerDecision === 'PARTIAL' ? 'OWNER_APPROVED' : 'PAID';
    }
    throw new ForbiddenException('Payment verification or owner approval required for this download scope');
  }

  @Get('activity/download-access')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async downloadAccess(@Request() req: any, @Query('invoiceNumber') invoiceNumber?: string) {
    if (req.user.role === 'SUPER_ADMIN') return { scope: 'FULL', source: 'OWNER' };
    if (!['ADMIN', 'AUDITOR'].includes(req.user.role) || !req.user.tenantId) {
      return { scope: null, source: null };
    }
    const [approved, paid] = await Promise.all([
      this.latestOwnerDecision(req.user.userId, req.user.tenantId),
      this.verifiedPaidScope(req, invoiceNumber),
    ]);
    const scope = approved === 'FULL' || paid === 'FULL'
      ? 'FULL' : approved === 'PARTIAL' || paid === 'PARTIAL' ? 'PARTIAL' : null;
    return { scope, source: approved === scope ? 'OWNER_APPROVED' : paid === scope ? 'PAID' : null };
  }

  @Get('activity/owner/approvals')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async ownerApprovals(@Request() req: any) {
    this.requireOwner(req);
    return prisma.auditLog.findMany({
      where: {
        entityType: 'ACTIVITY_REPORT_ACCESS',
        action: { in: ['DOWNLOAD_ACCESS_APPROVED', 'DOWNLOAD_ACCESS_REVOKED'] },
      },
      select: {
        id: true, entityId: true, tenantId: true, action: true, newValues: true, createdAt: true,
        user: { select: { email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  @Post('activity/owner/approve')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async approveExport(@Request() req: any, @Body() body: { email?: string; scope?: string; revoke?: boolean }) {
    this.requireOwner(req);
    if (typeof body?.email !== 'string' || body.email.length > 254 || !body.email.includes('@') ||
        !['FULL', 'PARTIAL'].includes(body?.scope || '')) {
      throw new BadRequestException('Email and valid scope are required');
    }
    const user = await prisma.user.findUnique({
      where: { email: body.email.trim().toLowerCase() },
      select: { id: true, email: true, tenantId: true },
    });
    if (!user || !user.tenantId) throw new BadRequestException('Eligible account not found');
    const action = body.revoke === true ? 'DOWNLOAD_ACCESS_REVOKED' : 'DOWNLOAD_ACCESS_APPROVED';
    await prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: req.user.userId,
        entityType: 'ACTIVITY_REPORT_ACCESS',
        entityId: user.id,
        action,
        newValues: { scope: body.scope, subjectEmail: user.email },
      },
    });
    return { recorded: true, action, scope: body.scope, email: user.email };
  }

  @Get('activity/export')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async exportActivity(@Request() req: any, @Res() res: any,
    @Query('from') from?: string, @Query('to') to?: string,
    @Query('scope') requestedScope?: string, @Query('invoiceNumber') invoiceNumber?: string) {
    const scope = requestedScope || 'PARTIAL';
    const grantedBy = await this.requireExportAccess(req, scope, invoiceNumber);
    if (scope === 'PARTIAL' && (!from || !to)) {
      throw new BadRequestException('Partial download requires from and to dates');
    }
    if (scope === 'PARTIAL' && from && to) {
      const days = (Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000;
      if (!Number.isFinite(days) || days < 0 || days > 31)
        throw new BadRequestException('Partial date range must be at most 31 days');
    }
    const selected = this.activityScope(req, scope === 'FULL' ? undefined : from, scope === 'FULL' ? undefined : to);
    const where = {
      ...(selected.tenantId ? { tenantId: selected.tenantId } : {}),
      createdAt: selected.createdAt,
    };
    const safe = (value: unknown): string => {
      let str = String(value ?? '').replace(/[\\r\\n]+/g, ' ').slice(0, 500);
      if (/^[\\s]*[=+@-]/.test(str)) str = "'" + str;
      return '"' + str.replace(/"/g, '""') + '"';
    };
    await prisma.auditLog.create({
      data: {
        tenantId: req.user.tenantId ?? null,
        userId: req.user.userId,
        action: 'REPORT_EXPORT_STARTED',
        entityType: 'SITE_ACTIVITY',
        httpMethod: 'GET',
        httpPath: '/analytics/activity/export',
        newValues: { scope, grantedBy },
      },
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="scc380-activity-' + scope.toLowerCase() + '.csv"');
    res.setHeader('Cache-Control', 'no-store');
    res.write('\\uFEFF' + ['UTC time', 'User', 'Email', 'Action', 'Path', 'HTTP status', 'IP'].map(safe).join(',') + '\\r\\n');
    let count = 0;
    let cursor: string | undefined;
    try {
      while (!res.destroyed) {
        const rows = await prisma.auditLog.findMany({
          where,
          select: {
            id: true, action: true, httpPath: true, responseStatus: true,
            createdAt: true, ipAddress: true,
            user: { select: { email: true, firstName: true, lastName: true } },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 500,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        });
        if (!rows.length) break;
        const csv = rows.map(e => [
          e.createdAt.toISOString(),
          [e.user?.firstName, e.user?.lastName].filter(Boolean).join(' '),
          e.user?.email ?? '', e.action, e.httpPath ?? '', e.responseStatus ?? '', e.ipAddress ?? '',
        ].map(safe).join(',')).join('\\r\\n') + '\\r\\n';
        if (!res.write(csv)) {
          await new Promise<void>((resolve) => res.once('drain', resolve));
        }
        count += rows.length;
        cursor = rows[rows.length - 1].id;
        if (rows.length < 500) break;
      }
      if (!res.destroyed) {
        res.end();
        await prisma.auditLog.create({
          data: {
            tenantId: req.user.tenantId ?? null,
            userId: req.user.userId,
            action: 'REPORT_EXPORT_STREAMED',
            entityType: 'SITE_ACTIVITY',
            httpMethod: 'GET',
            httpPath: '/analytics/activity/export',
            newValues: { scope, grantedBy, records: count },
          },
        });
      }
    } catch (error) {
      res.destroy(error instanceof Error ? error : new Error('Export failed'));
    }
  }

  @Get('alerts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getAlerts(@Request() req: any) {
    return this.alertsService.getAlerts(req.user.tenantId, req.user.role);
  }
}
