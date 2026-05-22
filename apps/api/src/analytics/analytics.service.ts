import { Injectable } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';
import { PayrollStatus } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  async getDashboardStats(tenantId: string | undefined, userRole: string) {
    const tw = userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);
    const [contacts, deals, employees, vehicles, invoices] = await Promise.all([
      prisma.contact.count({ where: tw }),
      prisma.deal.count({ where: tw }),
      prisma.employee.count({ where: tw }),
      prisma.vehicle.count({ where: tw }),
      prisma.invoice.count({ where: tw }),
    ]);

    const dealValue = await prisma.deal.aggregate({
      _sum: { value: true },
      where: { ...tw, stage: 'CLOSED_WON' },
    });

    const invoiceRevenue = await prisma.invoice.aggregate({
      _sum: { total: true },
      where: { ...tw, status: 'PAID' },
    });

    return {
      counts: { contacts, deals, employees, vehicles, invoices },
      revenue: {
        deals: dealValue._sum.value || 0,
        invoices: invoiceRevenue._sum.total || 0,
      },
    };
  }

  async getCrmStats(tenantId: string | undefined, userRole: string, from?: string, to?: string) {
    const tw = userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);
    const dateFilter: any = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);
    const dateWhere = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};

    const [byStage, bySource] = await Promise.all([
      prisma.deal.groupBy({ by: ['stage'], _count: { id: true }, where: { ...tw, ...dateWhere } }),
      prisma.contact.groupBy({ by: ['source'], _count: { id: true }, where: { ...tw, ...dateWhere } }),
    ]);

    return { byStage, bySource };
  }

  async getErpStats(tenantId: string | undefined, userRole: string, from?: string, to?: string) {
    const tw = userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);
    const dateFilter: any = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);
    const dateWhere = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};

    const [byStatus, totalRevenue, overdue] = await Promise.all([
      prisma.invoice.groupBy({ by: ['status'], _count: { id: true }, where: { ...tw, ...dateWhere } }),
      prisma.invoice.aggregate({ _sum: { total: true }, where: { ...tw, status: 'PAID', ...dateWhere } }),
      prisma.invoice.count({ where: { ...tw, status: 'OVERDUE' } }),
    ]);

    return { byStatus, totalRevenue: totalRevenue._sum.total || 0, overdue };
  }

  async getFleetStats(tenantId: string | undefined, userRole: string) {
    const tw = userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);
    const [byStatus, inMaintenance, activeTrips] = await Promise.all([
      prisma.vehicle.groupBy({ by: ['status'], _count: { id: true }, where: tw }),
      prisma.vehicle.count({ where: { ...tw, status: 'IN_MAINTENANCE' } }),
      prisma.fleetTrip.count({ where: { ...tw, status: 'IN_PROGRESS' } }),
    ]);

    return { byStatus, inMaintenance, activeTrips };
  }

  async getHrStats(tenantId: string | undefined, userRole: string) {
    const tw = userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);
    const [byStatus, byDepartment, avgSalary, totalPayroll, pendingLeaves] = await Promise.all([
      prisma.employee.groupBy({ by: ['status'], _count: { id: true }, where: tw }),
      prisma.employee.groupBy({ by: ['departmentId'], _count: { id: true }, where: tw }),
      prisma.employee.aggregate({ _avg: { basicSalary: true }, where: tw }),
      prisma.payroll.aggregate({
        _sum: { netSalary: true },
        where: { ...tw, status: PayrollStatus.PAID },
      }),
      prisma.leave.count({ where: { ...tw, status: 'PENDING' } }),
    ]);

    const deptIds = byDepartment.filter(d => d.departmentId).map(d => d.departmentId!);
    const departments = deptIds.length > 0
      ? await prisma.department.findMany({ where: { id: { in: deptIds } }, select: { id: true, name: true } })
      : [];

    const byDepartmentNamed = byDepartment.map(d => ({
      departmentId: d.departmentId,
      name: departments.find(dept => dept.id === d.departmentId)?.name || 'غير محدد',
      count: d._count.id,
    }));

    return {
      byStatus,
      byDepartment: byDepartmentNamed,
      avgSalary: avgSalary._avg.basicSalary || 0,
      totalPayroll: totalPayroll._sum.netSalary || 0,
      pendingLeaves,
    };
  }

  async getProjectStats(tenantId: string | undefined, userRole: string) {
    const tw = userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);
    const [byStatus, byPriority, taskByStatus, avgProgress, overdueTasks] = await Promise.all([
      prisma.project.groupBy({ by: ['status'], _count: { id: true }, where: tw }),
      prisma.project.groupBy({ by: ['priority'], _count: { id: true }, where: tw }),
      prisma.task.groupBy({ by: ['status'], _count: { id: true }, where: tw }),
      prisma.project.aggregate({ _avg: { progress: true }, where: tw }),
      prisma.task.count({ where: { ...tw, status: { not: 'DONE' }, dueDate: { lt: new Date() } } }),
    ]);

    return {
      byStatus,
      byPriority,
      taskByStatus,
      avgProgress: Math.round(avgProgress._avg.progress || 0),
      overdueTasks,
    };
  }

  async getFinanceStats(tenantId: string | undefined, userRole: string) {
    const tw = userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);
    const now = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(now.getMonth() - 5);
    sixMonthsAgo.setDate(1);

    const [byCategory, monthlyPayments, totalBankBalance, totalExpenses, totalPayments] = await Promise.all([
      prisma.expense.groupBy({ by: ['category'], _sum: { amount: true }, where: tw }),
      prisma.payment.findMany({
        where: { ...tw, paidAt: { gte: sixMonthsAgo } },
        select: { amount: true, paidAt: true },
        orderBy: { paidAt: 'asc' },
      }),
      prisma.bankAccount.aggregate({ _sum: { balance: true }, where: tw }),
      prisma.expense.aggregate({ _sum: { amount: true }, where: tw }),
      prisma.payment.aggregate({ _sum: { amount: true }, where: { ...tw, status: 'COMPLETED' } }),
    ]);

    // Group monthly payments
    const monthlyData: Record<string, number> = {};
    for (const p of monthlyPayments) {
      const key = `${p.paidAt.getFullYear()}-${String(p.paidAt.getMonth() + 1).padStart(2, '0')}`;
      monthlyData[key] = (monthlyData[key] || 0) + Number(p.amount);
    }

    return {
      byCategory: byCategory.map(c => ({ category: c.category, amount: c._sum.amount || 0 })),
      monthlyPayments: Object.entries(monthlyData).map(([month, amount]) => ({ month, amount })).sort((a, b) => a.month.localeCompare(b.month)),
      totalBankBalance: totalBankBalance._sum.balance || 0,
      totalExpenses: totalExpenses._sum.amount || 0,
      totalPayments: totalPayments._sum.amount || 0,
    };
  }

  async getInvoiceRevenueTrend(tenantId: string | undefined, userRole: string) {
    const tw = userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);
    const now = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(now.getMonth() - 5);
    sixMonthsAgo.setDate(1);

    const invoices = await prisma.invoice.findMany({
      where: { ...tw, status: 'PAID', createdAt: { gte: sixMonthsAgo } },
      select: { total: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const monthlyData: Record<string, number> = {};
    for (const inv of invoices) {
      const key = `${inv.createdAt.getFullYear()}-${String(inv.createdAt.getMonth() + 1).padStart(2, '0')}`;
      monthlyData[key] = (monthlyData[key] || 0) + Number(inv.total);
    }

    return Object.entries(monthlyData)
      .map(([month, revenue]) => ({ month, revenue }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }
}
