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
    if (req.user.role !== 'SUPER_ADMIN' && !req.activityOwnerAuthorized && !req.user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    const start = parse(from);
    const end = parse(to);
    if (end) end.setUTCDate(end.getUTCDate() + 1);
    if (start && end && start >= end) throw new BadRequestException('Invalid date range');
    const createdAt = { ...(start ? { gte: start } : {}), ...(end ? { lt: end } : {}) };
    // A tenant administrator/auditor may never see another tenant.
    return {
      tenantId: (req.user.role === 'SUPER_ADMIN' || req.activityOwnerAuthorized === true) ? undefined : req.user.tenantId,
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
    await this.requireOwner(req);
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
        auditedHttpErrors: events.filter(e => typeof e.responseStatus === 'number' && e.responseStatus >= 400).length,
      },
      events, sessions, logins,
      limited: events.length === 1000 || sessions.length === 100 || logins.length === 100,
    };
  }

  // Download entitlements live in append-only audit events, preserving owner decisions.
  // A paid invoice is never accepted unless both the customer and an exact product SKU match.
  private readonly reportPartialSku = 'SCC380-ACTIVITY-REPORT-PARTIAL';
  private readonly reportFullSku = 'SCC380-ACTIVITY-REPORT-FULL';

  // Delegation is intentionally limited to this console, not a general SUPER_ADMIN elevation.
  // Fail closed when no explicit owner identity is configured on the service.
  private async canManageOwnerConsole(req: any): Promise<boolean> {
    const configured = (process.env.SCC380_ACTIVITY_OWNER_EMAIL || '').trim().toLowerCase();
    // This console has exactly one configured owner identity: not every SUPER_ADMIN.
    if (!configured || !['ADMIN', 'SUPER_ADMIN'].includes(req.user?.role) ||
        !req.user?.userId || req.user?.email?.toLowerCase() !== configured ||
        !req.user?.sessionId) return false;
    const account = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { email: true, status: true, role: true },
    });
    // JWT guard has already verified the access token, active session and database role.
    // This is a deliberate operator-configured delegation to ONE exact existing ADMIN,
    // not a global role elevation. Email verification is not independently usable for
    // the existing password-login accounts, so do not silently lock the approved owner out.
    return !!account && account.status === 'ACTIVE' &&
      account.role === req.user.role && account.email.toLowerCase() === configured;
  }

  private async requireOwner(req: any) {
    if (!(await this.canManageOwnerConsole(req))) {
      throw new ForbiddenException('Owner authorization required');
    }
    req.activityOwnerAuthorized = true;
  }

  @Get('activity/owner/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async ownerStatus(@Request() req: any) {
    return {
      authorized: await this.canManageOwnerConsole(req),
      accountRole: req.user.role,
      email: req.user.email,
    };
  }

  private async latestOwnerDecision(userId: string, tenantId: string | null,
    requestedScope?: string, from?: string, to?: string) {
    // A request-specific partial approval never expands to a different date range.
    // A later revocation supersedes all earlier approvals.
    const rows = await prisma.auditLog.findMany({
      where: {
        entityType: 'ACTIVITY_REPORT_ACCESS',
        entityId: userId,
        action: { in: ['DOWNLOAD_ACCESS_APPROVED', 'DOWNLOAD_ACCESS_REVOKED'] },
        tenantId,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { action: true, newValues: true },
      take: 200,
    });
    for (const row of rows) {
      if (row.action === 'DOWNLOAD_ACCESS_REVOKED') return null;
      const values = row.newValues as {
        scope?: string; requestId?: string; from?: string | null; to?: string | null
      } | null;
      if (!values || !['FULL', 'PARTIAL'].includes(values.scope || '')) continue;
      if (!values.requestId) return values.scope;
      if (values.scope === 'FULL') return 'FULL';
      if (requestedScope === 'PARTIAL' && from === values.from && to === values.to)
        return 'PARTIAL';
    }
    return null;
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

  private async requireExportAccess(req: any, requested: string, invoiceNumber?: string, from?: string, to?: string) {
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
    if (await this.canManageOwnerConsole(req)) {
      req.activityOwnerAuthorized = true;
      return 'OWNER';
    }
    if (!['ADMIN', 'AUDITOR'].includes(req.user.role) || !req.user.tenantId) {
      throw new ForbiddenException('Download access unavailable');
    }
    const [ownerDecision, paid] = await Promise.all([
      this.latestOwnerDecision(req.user.userId, req.user.tenantId, requested, from, to),
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
  async downloadAccess(@Request() req: any, @Query('invoiceNumber') invoiceNumber?: string,
    @Query('scope') requestedScope?: string, @Query('from') from?: string, @Query('to') to?: string) {
    if (await this.canManageOwnerConsole(req)) return { scope: 'FULL', source: 'OWNER' };
    if (!['ADMIN', 'AUDITOR'].includes(req.user.role) || !req.user.tenantId) {
      return { scope: null, source: null };
    }
    const [approved, paid] = await Promise.all([
      this.latestOwnerDecision(req.user.userId, req.user.tenantId, requestedScope, from, to),
      this.verifiedPaidScope(req, invoiceNumber),
    ]);
    const scope = approved === 'FULL' || paid === 'FULL'
      ? 'FULL' : approved === 'PARTIAL' || paid === 'PARTIAL' ? 'PARTIAL' : null;
    return { scope, source: approved === scope ? 'OWNER_APPROVED' : paid === scope ? 'PAID' : null };
  }


  // A download approval request is created by the authenticated applicant.
  // No email or tenant from the browser is trusted. This request alone NEVER grants access.
  @Post('activity/download-request')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async createDownloadRequest(@Request() req: any,
    @Body() body: { scope?: string; from?: string; to?: string; reason?: string }) {
    if (!['ADMIN', 'AUDITOR'].includes(req.user?.role) ||
        !req.user?.tenantId || !req.user?.userId) {
      throw new ForbiddenException('An active tenant administrator or auditor is required');
    }
    const scope = body?.scope;
    if (scope !== 'PARTIAL' && scope !== 'FULL') {
      throw new BadRequestException('Scope must be PARTIAL or FULL');
    }
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
    if (reason.length > 300 || (body?.reason !== undefined && typeof body.reason !== 'string')) {
      throw new BadRequestException('Invalid request reason');
    }
    let from: string | null = null;
    let to: string | null = null;
    if (scope === 'PARTIAL') {
      if (typeof body?.from !== 'string' || typeof body?.to !== 'string') {
        throw new BadRequestException('Partial request requires date range');
      }
      // Validate both dates against the same policy used for the export.
      const parsed = this.activityScope(req, body.from, body.to);
      if (!parsed.createdAt.gte || !parsed.createdAt.lt) {
        throw new BadRequestException('Invalid partial date range');
      }
      const days = (Date.parse(body.to + 'T00:00:00Z') - Date.parse(body.from + 'T00:00:00Z')) / 86400000;
      if (!Number.isFinite(days) || days < 0 || days > 31) {
        throw new BadRequestException('Partial date range exceeds 31 days');
      }
      from = body.from;
      to = body.to;
    } else if (body?.from || body?.to) {
      throw new BadRequestException('Full request must not contain date filters');
    }
    const last = await prisma.auditLog.findFirst({
      where: {
        entityType: 'ACTIVITY_REPORT_REQUEST',
        action: 'DOWNLOAD_APPROVAL_REQUESTED',
        userId: req.user.userId,
        tenantId: req.user.tenantId,
        createdAt: { gte: new Date(Date.now() - 60_000) },
      },
      select: { id: true },
    });
    if (last) throw new BadRequestException('Please avoid repeated requests within one minute');
    const request = await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        tenantId: req.user.tenantId,
        action: 'DOWNLOAD_APPROVAL_REQUESTED',
        entityType: 'ACTIVITY_REPORT_REQUEST',
        entityId: req.user.userId,
        newValues: { scope, from, to, reason, resourceType: 'ACTIVITY_REPORT' },
      },
      select: { id: true, createdAt: true },
    });
    return { requestId: request.id, status: 'PENDING', createdAt: request.createdAt };
  }

  @Get('activity/my-requests')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async myDownloadRequests(@Request() req: any) {
    if (!req.user?.tenantId || !req.user?.userId) {
      throw new ForbiddenException('Tenant session required');
    }
    const rows = await prisma.auditLog.findMany({
      where: {
        entityType: 'ACTIVITY_REPORT_REQUEST',
        action: 'DOWNLOAD_APPROVAL_REQUESTED',
        tenantId: req.user.tenantId,
        userId: req.user.userId,
      },
      select: { id: true, createdAt: true, newValues: true },
      take: 40,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    const ids = rows.map(r => r.id);
    const decisions = ids.length ? await prisma.auditLog.findMany({
      where: {
        entityType: 'ACTIVITY_REPORT_ACCESS',
        action: { in: ['DOWNLOAD_ACCESS_APPROVED', 'DOWNLOAD_REQUEST_REJECTED'] },
        tenantId: req.user.tenantId,
        entityId: req.user.userId,
      },
      select: { newValues: true, action: true, createdAt: true, id: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 500,
    }) : [];
    return rows.map(row => {
      const decision = decisions.find(d => (d.newValues as any)?.requestId === row.id);
      return {
        id: row.id, createdAt: row.createdAt, details: row.newValues,
        status: decision?.action === 'DOWNLOAD_ACCESS_APPROVED' ? 'APPROVED'
          : decision?.action === 'DOWNLOAD_REQUEST_REJECTED' ? 'REJECTED' : 'PENDING',
      };
    });
  }

  @Get('activity/owner/requests')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async ownerDownloadRequests(@Request() req: any) {
    await this.requireOwner(req);
    const rows = await prisma.auditLog.findMany({
      where: { entityType: 'ACTIVITY_REPORT_REQUEST', action: 'DOWNLOAD_APPROVAL_REQUESTED' },
      select: {
        id: true, tenantId: true, userId: true, createdAt: true, newValues: true,
        user: { select: { email: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });
    const decisions = await prisma.auditLog.findMany({
      where: {
        entityType: 'ACTIVITY_REPORT_ACCESS',
        action: { in: ['DOWNLOAD_ACCESS_APPROVED', 'DOWNLOAD_REQUEST_REJECTED'] },
      },
      select: { action: true, newValues: true, createdAt: true, id: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 500,
    });
    return rows.map(row => {
      const decision = decisions.find(d => (d.newValues as any)?.requestId === row.id);
      return {
        id: row.id, email: row.user?.email, tenantId: row.tenantId,
        createdAt: row.createdAt, details: row.newValues,
        status: decision?.action === 'DOWNLOAD_ACCESS_APPROVED' ? 'APPROVED'
          : decision?.action === 'DOWNLOAD_REQUEST_REJECTED' ? 'REJECTED' : 'PENDING',
      };
    });
  }

  @Post('activity/owner/resolve-request')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async resolveDownloadRequest(@Request() req: any,
    @Body() body: { requestId?: string; decision?: string; reason?: string }) {
    await this.requireOwner(req);
    if (typeof body?.requestId !== 'string' || !/^[a-zA-Z0-9_-]{10,48}$/.test(body.requestId) ||
        !['APPROVE', 'REJECT'].includes(body.decision || '')) {
      throw new BadRequestException('Valid request and decision required');
    }
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (reason.length > 300 || (body.reason !== undefined && typeof body.reason !== 'string')) {
      throw new BadRequestException('Invalid reason');
    }
    const row = await prisma.auditLog.findFirst({
      where: {
        id: body.requestId,
        action: 'DOWNLOAD_APPROVAL_REQUESTED',
        entityType: 'ACTIVITY_REPORT_REQUEST',
      },
      select: { id: true, userId: true, tenantId: true, newValues: true },
    });
    if (!row?.userId || !row.tenantId) throw new BadRequestException('Request does not exist');
    const requested = row.newValues as { scope?: string; from?: string | null; to?: string | null } | null;
    if (!['PARTIAL', 'FULL'].includes(requested?.scope || '')) {
      throw new BadRequestException('Unsupported request scope');
    }
    const target = await prisma.user.findFirst({
      where: { id: row.userId, tenantId: row.tenantId, status: 'ACTIVE',
        role: { in: ['ADMIN', 'AUDITOR'] } },
      select: { email: true },
    });
    if (!target) throw new BadRequestException('Requester is no longer eligible');

    // One writer per request ID; use an advisory PostgreSQL transaction lock so
    // two concurrent owner actions cannot approve and reject the same request.
    return prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${row.id}))`;
      const prior = await tx.auditLog.findFirst({
        where: {
          entityType: 'ACTIVITY_REPORT_ACCESS',
          action: { in: ['DOWNLOAD_ACCESS_APPROVED', 'DOWNLOAD_REQUEST_REJECTED'] },
          tenantId: row.tenantId,
          entityId: row.userId,
          // JSON path lookup ensures no decision is made twice on the same request.
          newValues: { path: ['requestId'], equals: row.id },
        },
        select: { id: true, action: true },
      });
      if (prior) return { recorded: false, status: 'ALREADY_RESOLVED' };
      const approval = body.decision === 'APPROVE';
      await tx.auditLog.create({
        data: {
          tenantId: row.tenantId,
          userId: req.user.userId,
          entityType: 'ACTIVITY_REPORT_ACCESS',
          entityId: row.userId,
          action: approval ? 'DOWNLOAD_ACCESS_APPROVED' : 'DOWNLOAD_REQUEST_REJECTED',
          newValues: {
            requestId: row.id, scope: requested!.scope, subjectEmail: target.email,
            from: requested?.from || null, to: requested?.to || null,
            reason, decidedBy: req.user.userId,
          },
        },
      });
      return { recorded: true, status: approval ? 'APPROVED' : 'REJECTED' };
    });
  }


  // Owner-only operational overview. Counts are computed from the full database,
  // not the 1000-row interactive activity preview. No new data collection is implied.
  @Get('activity/owner/insights')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async ownerInsights(@Request() req: any, @Query('days') daysInput?: string) {
    await this.requireOwner(req);
    const days = daysInput === undefined ? 30 : Number(daysInput);
    if (!Number.isInteger(days) || days < 1 || days > 90) {
      throw new BadRequestException('days must be between 1 and 90');
    }
    const since = new Date(Date.now() - days * 86400000);
    const now = new Date();
    const period = { createdAt: { gte: since, lte: now } };
    const views = { ...period, entityType: 'SITE_ACTIVITY', action: 'PAGE_VIEW' };
    const errorWhere = { ...period, responseStatus: { gte: 400 } };
    const [
      recordedEvents, pageViews, downloadRequests, streamedExports,
      downloadApprovalRequests, grantedApprovals, rejectedRequests,
      auditedHttpErrors, recentErrors, activeSessions, loginFailures,
      successfulLogins, authenticatedUsers, topPages, topActors,
      hrDocumentDeliveryStarts, storedHrDocuments,
    ] = await Promise.all([
      prisma.auditLog.count({ where: period }),
      prisma.auditLog.count({ where: views }),
      prisma.auditLog.count({
        where: { ...period, action: 'DOWNLOAD_REQUEST' },
      }),
      prisma.auditLog.count({
        where: { ...period, action: 'REPORT_EXPORT_STREAMED' },
      }),
      prisma.auditLog.count({
        where: { ...period, entityType: 'ACTIVITY_REPORT_REQUEST', action: 'DOWNLOAD_APPROVAL_REQUESTED' },
      }),
      prisma.auditLog.count({
        where: { ...period, entityType: 'ACTIVITY_REPORT_ACCESS', action: 'DOWNLOAD_ACCESS_APPROVED' },
      }),
      prisma.auditLog.count({
        where: { ...period, entityType: 'ACTIVITY_REPORT_ACCESS', action: 'DOWNLOAD_REQUEST_REJECTED' },
      }),
      prisma.auditLog.count({ where: errorWhere }),
      prisma.auditLog.findMany({
        where: errorWhere,
        select: {
          id: true, createdAt: true, httpPath: true, httpMethod: true,
          responseStatus: true, action: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.session.count({
        where: { revokedAt: null, expiresAt: { gt: now } },
      }),
      prisma.loginAttempt.count({
        where: { ...period, success: false },
      }),
      prisma.loginAttempt.count({
        where: { ...period, success: true },
      }),
      prisma.auditLog.groupBy({
        by: ['userId'],
        where: { ...period, userId: { not: null } },
        _count: { _all: true },
      }),
      prisma.auditLog.groupBy({
        by: ['httpPath'],
        where: { ...views, httpPath: { not: null } },
        _count: { _all: true },
      }),
      prisma.auditLog.groupBy({
        by: ['userId'],
        where: { ...period, userId: { not: null } },
        _count: { _all: true },
      }),
      prisma.auditLog.count({
        where: { ...period, entityType: 'HR_EMPLOYEE_DOCUMENT', action: 'FILE_DELIVERY_STARTED' },
      }),
      prisma.employeeDocument.count(),
    ]);

    const actorRows = topActors
      .filter(item => item.userId)
      .sort((a, b) => b._count._all - a._count._all)
      .slice(0, 10);
    const users = await prisma.user.findMany({
      where: { id: { in: actorRows.map(item => item.userId!).filter(Boolean) } },
      select: { id: true, email: true, firstName: true, lastName: true, tenantId: true },
    });
    const userMap = new Map(users.map(user => [user.id, user]));
    return {
      period: { since: since.toISOString(), until: now.toISOString(), days },
      summary: {
        recordedEvents, pageViews, downloadRequests, streamedExports,
        downloadApprovalRequests, grantedApprovals, rejectedRequests,
        auditedHttpErrors, activeSessions, loginFailures, successfulLogins,
        identifiedActiveUsers: authenticatedUsers.length,
        hrDocumentDeliveryStarts, storedHrDocuments,
      },
      pages: topPages
        .filter(item => item.httpPath)
        .sort((a, b) => b._count._all - a._count._all)
        .slice(0, 15)
        .map(item => ({ path: item.httpPath, visits: item._count._all })),
      actors: actorRows.map(item => ({
        userId: item.userId,
        email: userMap.get(item.userId!)?.email ?? 'unknown',
        tenantId: userMap.get(item.userId!)?.tenantId ?? null,
        events: item._count._all,
      })),
      recentErrors,
      resourceInventory: [
        {
          type: 'ACTIVITY_REPORT',
          route: '/analytics/activity/export',
          availability: 'AVAILABLE',
          downloadPolicy: 'OWNER_APPROVAL_OR_VERIFIED_PAYMENT',
          supportedScopes: ['PARTIAL', 'FULL'],
        },
        {
          type: 'HR_EMPLOYEE_DOCUMENT',
          route: '/hr/employee-documents/:id/download',
          availability: 'AVAILABLE',
          downloadPolicy: 'HR_DOCUMENT_READ_PERMISSION',
          supportedScopes: ['FULL'],
          documentCount: storedHrDocuments,
          deliveriesLoggedInPeriod: hrDocumentDeliveryStarts,
        },
        {
          type: 'ANONYMOUS_SITE_FILES',
          availability: 'NOT_INSTRUMENTED',
          downloadPolicy: 'NOT_AUDITED_BY_OWNER_CENTER',
          supportedScopes: [],
        },
      ],
      coverage: {
        pageViews: 'Authenticated dashboard navigation events only',
        anonymousVisitors: 'NOT_COLLECTED',
        fileDownloads: 'Activity report exports, server-side HR document delivery attempts, and instrumented same-origin file links',
        deviceDownloadCompletion: 'NOT_VERIFIABLE',
        periodCounts: 'Complete database counts; the event preview remains capped',
      },
    };
  }

  @Get('activity/owner/approvals')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async ownerApprovals(@Request() req: any) {
    await this.requireOwner(req);
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
    await this.requireOwner(req);
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
    const grantedBy = await this.requireExportAccess(req, scope, invoiceNumber, from, to);
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
      let str = String(value ?? '').replace(/[\r\n]+/g, ' ').slice(0, 500);
      if (/^[\s]*[=+@-]/.test(str)) str = "'" + str;
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
    res.write('\uFEFF' + ['UTC time', 'User', 'Email', 'Action', 'Path', 'HTTP status', 'IP'].map(safe).join(',') + '\r\n');
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
        ].map(safe).join(',')).join('\r\n') + '\r\n';
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
