import { Injectable } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';
import { AlertsGateway } from './gateway/alerts.gateway';

export interface AlertItem {
  id: string;
  type: 'LOW_STOCK' | 'OVERDUE_INVOICE' | 'UPCOMING_INVOICE' | 'PENDING_PAYMENT' | 'ASSET_DEPRECIATION' | 'PENDING_LEAVE';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  message: string;
  entityId: string;
  entityType: string;
  actionUrl: string;
  createdAt: Date;
}

@Injectable()
export class SmartAlertsService {
  constructor(private readonly gateway: AlertsGateway) {}

  private async resolveTenantId(tenantId: string | undefined): Promise<string> {
    if (tenantId) return tenantId;
    const tenant = await prisma.tenant.findFirst({ select: { id: true } });
    return tenant?.id || 'default';
  }

  private async saveAlert(tenantId: string | undefined, alert: Omit<AlertItem, 'id' | 'createdAt'>) {
    const resolvedTenantId = await this.resolveTenantId(tenantId);
    const existing = await prisma.alert.findFirst({
      where: {
        tenantId: resolvedTenantId,
        type: alert.type,
        entityId: alert.entityId,
        isRead: false,
      },
    });
    if (existing) return existing;

    const saved = await prisma.alert.create({
      data: {
        tenantId: resolvedTenantId,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        entityId: alert.entityId,
        entityType: alert.entityType,
        actionUrl: alert.actionUrl,
      },
    });

    this.gateway?.sendAlert(resolvedTenantId, saved);
    return saved;
  }

  async generateAndGetAlerts(tenantId: string | undefined, userRole: string): Promise<AlertItem[]> {
    const tw = userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);

    // 1. المخزون المنخفض
    const allProducts = await prisma.product.findMany({
      where: { ...tw, isActive: true },
      include: { category: true },
    });
    const lowStockProducts = allProducts.filter(p => p.currentStock <= p.minStockLevel);
    for (const p of lowStockProducts) {
      await this.saveAlert(tenantId, {
        type: 'LOW_STOCK',
        severity: p.currentStock === 0 ? 'CRITICAL' : 'WARNING',
        title: 'مخزون منخفض',
        message: `${p.name} - المتبقي: ${p.currentStock} (الحد الأدنى: ${p.minStockLevel})`,
        entityId: p.id,
        entityType: 'Product',
        actionUrl: '/dashboard/inventory',
      });
    }

    // 2. فواتير مستحقة (overdue)
    const now = new Date();
    const overdueInvoices = await prisma.invoice.findMany({
      where: { ...tw, status: { in: ['SENT', 'VIEWED', 'PARTIAL'] }, dueDate: { lt: now } },
    });
    for (const inv of overdueInvoices) {
      const days = Math.floor((now.getTime() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24));
      await this.saveAlert(tenantId, {
        type: 'OVERDUE_INVOICE',
        severity: days > 30 ? 'CRITICAL' : days > 7 ? 'WARNING' : 'INFO',
        title: 'فاتورة مستحقة',
        message: `فاتورة #${inv.invoiceNumber} - مستحقة منذ ${days} يوم - المبلغ: ${inv.total} ريال`,
        entityId: inv.id,
        entityType: 'Invoice',
        actionUrl: '/dashboard/erp',
      });
    }

    // 3. فواتير قادمة للاستحقاق (خلال 7 أيام)
    const nextWeek = new Date();
    nextWeek.setDate(now.getDate() + 7);
    const upcomingInvoices = await prisma.invoice.findMany({
      where: { ...tw, status: { in: ['SENT', 'VIEWED', 'PARTIAL'] }, dueDate: { gte: now, lte: nextWeek } },
    });
    for (const inv of upcomingInvoices) {
      const daysLeft = Math.ceil((inv.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      await this.saveAlert(tenantId, {
        type: 'UPCOMING_INVOICE',
        severity: 'INFO',
        title: 'استحقاق قادم',
        message: `فاتورة #${inv.invoiceNumber} - تستحق خلال ${daysLeft} أيام`,
        entityId: inv.id,
        entityType: 'Invoice',
        actionUrl: '/dashboard/erp',
      });
    }

    // 4. مدفوعات معلقة
    const pendingPayments = await prisma.payment.findMany({
      where: { ...tw, status: 'PENDING' },
    });
    for (const pay of pendingPayments) {
      await this.saveAlert(tenantId, {
        type: 'PENDING_PAYMENT',
        severity: 'WARNING',
        title: 'دفع معلق',
        message: `دفع ${pay.amount} ريال - طريقة: ${pay.method} - مرجع: ${pay.reference || 'غير محدد'}`,
        entityId: pay.id,
        entityType: 'Payment',
        actionUrl: '/dashboard/finance',
      });
    }

    // 5. إجازات معلقة
    const pendingLeaves = await prisma.leave.findMany({
      where: { ...tw, status: 'PENDING' },
      include: { employee: true },
    });
    for (const leave of pendingLeaves) {
      await this.saveAlert(tenantId, {
        type: 'PENDING_LEAVE',
        severity: 'INFO',
        title: 'طلب إجازة معلق',
        message: `${leave.employee?.firstName} ${leave.employee?.lastName} - ${leave.type} (${leave.days} أيام)`,
        entityId: leave.id,
        entityType: 'Leave',
        actionUrl: '/dashboard/hr',
      });
    }

    // Broadcast counts
    const resolvedTenantId = await this.resolveTenantId(tenantId);
    const counts = await this.getAlertCounts(tenantId, userRole);
    this.gateway?.sendAlertCount(resolvedTenantId, counts);

    return this.getAllAlerts(tenantId, userRole) as Promise<AlertItem[]>;
  }

  async getAllAlerts(tenantId: string | undefined, userRole: string) {
    const where = userRole === 'SUPER_ADMIN' ? { dismissedAt: null } : { ...tenantWhere(tenantId), dismissedAt: null };
    const alerts = await prisma.alert.findMany({
      where,
      orderBy: [{ isRead: 'asc' }, { severity: 'asc' }, { createdAt: 'desc' }],
    });
    return alerts;
  }

  async getAlertCounts(tenantId: string | undefined, userRole: string) {
    const where = userRole === 'SUPER_ADMIN' ? { dismissedAt: null } : { ...tenantWhere(tenantId), dismissedAt: null };
    const [total, critical, warning, info] = await Promise.all([
      prisma.alert.count({ where }),
      prisma.alert.count({ where: { ...where, severity: 'CRITICAL' } }),
      prisma.alert.count({ where: { ...where, severity: 'WARNING' } }),
      prisma.alert.count({ where: { ...where, severity: 'INFO' } }),
    ]);
    return { total, critical, warning, info };
  }

  async markAsRead(id: string, tenantId: string, userRole: string) {
    const where = userRole === 'SUPER_ADMIN' ? { id } : { id, tenantId };
    return prisma.alert.updateMany({ where, data: { isRead: true } });
  }

  async markAllAsRead(tenantId: string | undefined, userRole: string) {
    const where = userRole === 'SUPER_ADMIN' ? { isRead: false } : { ...tenantWhere(tenantId), isRead: false };
    return prisma.alert.updateMany({ where, data: { isRead: true } });
  }

  async dismiss(id: string, tenantId: string, userRole: string) {
    const where = userRole === 'SUPER_ADMIN' ? { id } : { id, tenantId };
    return prisma.alert.updateMany({ where, data: { dismissedAt: new Date() } });
  }
}
