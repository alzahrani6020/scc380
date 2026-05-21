import { Injectable } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

export interface AlertItem {
  id: string;
  type: 'invoice' | 'vehicle' | 'deal' | 'task' | 'leave' | 'expense' | 'general';
  severity: 'info' | 'warning' | 'danger';
  title: string;
  message: string;
  link: string;
  count?: number;
}

@Injectable()
export class AlertsService {
  async getAlerts(tenantId: string | undefined, userRole: string): Promise<AlertItem[]> {
    const tw = userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);
    const alerts: AlertItem[] = [];
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // 1. Overdue invoices
    const overdueInvoices = await prisma.invoice.count({
      where: { ...tw, status: 'OVERDUE' },
    });
    if (overdueInvoices > 0) {
      alerts.push({
        id: 'overdue-invoices',
        type: 'invoice',
        severity: 'danger',
        title: 'فواتير متأخرة',
        message: `يوجد ${overdueInvoices} فاتورة متأخرة عن السداد`,
        link: '/dashboard/erp',
        count: overdueInvoices,
      });
    }

    // 2. Pending leaves
    const pendingLeaves = await prisma.leave.count({
      where: { ...tw, status: 'PENDING' },
    });
    if (pendingLeaves > 0) {
      alerts.push({
        id: 'pending-leaves',
        type: 'leave',
        severity: 'warning',
        title: 'إجازات قيد الموافقة',
        message: `${pendingLeaves} طلب إجازة ينتظر الموافقة`,
        link: '/dashboard/hr/leaves',
        count: pendingLeaves,
      });
    }

    // 3. Vehicle expiries
    const expiringVehicles = await prisma.vehicle.count({
      where: {
        ...tw,
        OR: [
          { insuranceExpiry: { lte: thirtyDays, gte: now } },
          { istimaraExpiry: { lte: thirtyDays, gte: now } },
          { periodicInspectionExpiry: { lte: thirtyDays, gte: now } },
        ],
      },
    });
    if (expiringVehicles > 0) {
      alerts.push({
        id: 'vehicle-expiry',
        type: 'vehicle',
        severity: 'warning',
        title: 'رخص مركبات تنتهي قريبًا',
        message: `${expiringVehicles} مركبة بحاجة تجديد رخص خلال 30 يوم`,
        link: '/dashboard/fleet',
        count: expiringVehicles,
      });
    }

    // 4. Stale deals (no activity in 14 days)
    const staleDeals = await prisma.deal.count({
      where: { ...tw, stage: { notIn: ['CLOSED_WON', 'CLOSED_LOST'] }, updatedAt: { lt: fourteenDaysAgo } },
    });
    if (staleDeals > 0) {
      alerts.push({
        id: 'stale-deals',
        type: 'deal',
        severity: 'info',
        title: 'صفقات معلقة',
        message: `${staleDeals} صفقة بدون نشاط منذ أسبوعين`,
        link: '/dashboard/crm/deals',
        count: staleDeals,
      });
    }

    // 5. Overdue tasks
    const overdueTasks = await prisma.task.count({
      where: { ...tw, status: { not: 'DONE' }, dueDate: { lt: now } },
    });
    if (overdueTasks > 0) {
      alerts.push({
        id: 'overdue-tasks',
        type: 'task',
        severity: 'warning',
        title: 'مهام متأخرة',
        message: `${overdueTasks} مهمة تجاوزت تاريخ الاستحقاق`,
        link: '/dashboard/projects',
        count: overdueTasks,
      });
    }

    // 6. Pending expenses
    const pendingExpenses = await prisma.expense.count({
      where: { ...tw, status: 'PENDING' },
    });
    if (pendingExpenses > 0) {
      alerts.push({
        id: 'pending-expenses',
        type: 'expense',
        severity: 'info',
        title: 'مصروفات قيد المراجعة',
        message: `${pendingExpenses} مصروف ينتظر الموافقة`,
        link: '/dashboard/finance',
        count: pendingExpenses,
      });
    }

    // 7. Vehicles in maintenance
    const maintenanceVehicles = await prisma.vehicle.count({
      where: { ...tw, status: 'IN_MAINTENANCE' },
    });
    if (maintenanceVehicles > 0) {
      alerts.push({
        id: 'maintenance-vehicles',
        type: 'vehicle',
        severity: 'info',
        title: 'مركبات في الصيانة',
        message: `${maintenanceVehicles} مركبة حاليًا في الصيانة`,
        link: '/dashboard/fleet/maintenance',
        count: maintenanceVehicles,
      });
    }

    return alerts.sort((a, b) => {
      const severityOrder = { danger: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }
}
