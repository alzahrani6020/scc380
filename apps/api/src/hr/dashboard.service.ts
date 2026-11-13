import { Injectable, Logger } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

function riyadhDayRange(now = new Date()) {
  const riyadh = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const year = riyadh.getUTCFullYear();
  const month = riyadh.getUTCMonth();
  const day = riyadh.getUTCDate();
  const start = new Date(Date.UTC(year, month, day) - 3 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end, year, month: month + 1 };
}

@Injectable()
export class HrDashboardService {
  async getSummary(req: any) {
    const tenantId = req.user?.tenantId;
    const tenant = tenantWhere(tenantId);
    const { start, end, year, month } = riyadhDayRange();

    const settled = await Promise.allSettled([
      prisma.employee.count({ where: tenant }),
      prisma.employee.count({ where: { ...tenant, status: 'ACTIVE' } }),
      prisma.employee.count({ where: { ...tenant, status: 'ON_LEAVE' } }),
      prisma.employee.count({ where: { ...tenant, status: 'SUSPENDED' } }),
      prisma.employee.count({ where: { ...tenant, status: 'TERMINATED' } }),
      prisma.attendance.count({ where: { ...tenant, date: { gte: start, lt: end }, status: 'PRESENT' } }),
      prisma.attendance.count({ where: { ...tenant, date: { gte: start, lt: end }, status: 'ABSENT' } }),
      prisma.attendance.count({ where: { ...tenant, date: { gte: start, lt: end }, status: 'LATE' } }),
      prisma.attendance.count({ where: { ...tenant, date: { gte: start, lt: end }, status: 'REMOTE' } }),
      prisma.leave.count({ where: { ...tenant, status: 'PENDING' } }),
      prisma.department.count({ where: tenant }),
      prisma.shift.count({ where: tenant }),
      prisma.payroll.aggregate({
        where: { ...tenant, month, year },
        _sum: { netSalary: true },
        _count: { _all: true },
      }),
      prisma.payroll.count({ where: { ...tenant, month, year, status: 'DRAFT' } }),
      prisma.payroll.count({ where: { ...tenant, month, year, status: 'APPROVED' } }),
      prisma.payroll.count({ where: { ...tenant, month, year, status: 'PAID' } }),
      prisma.payrollRun.findFirst({ where: { ...tenant, month, year }, select: { id: true, status: true, employeeCount: true, grossTotal: true, deductionTotal: true, netTotal: true } }),
      prisma.employeeDocument.count({
        where: {
          ...tenant,
          expiresAt: { not: null, lte: new Date(Date.now() + 30 * 86400000) },
        },
      }),
      prisma.employeeContract.count({
        where: {
          ...tenant,
          status: 'ACTIVE',
          endDate: { not: null, lte: new Date(Date.now() + 30 * 86400000) },
        },
      }),
      prisma.employeeContract.count({
        where: {
          ...tenant,
          status: 'ACTIVE',
          probationEndDate: { not: null, lte: new Date(Date.now() + 30 * 86400000) },
        },
      }),
    ]);
    const metricNames = ["totalEmployees","activeEmployees","onLeaveEmployees","suspendedEmployees","terminatedEmployees","presentToday","absentToday","lateToday","remoteToday","pendingLeaves","departments","shifts","payrollAggregate","draftPayrolls","approvedPayrolls","paidPayrolls","currentPayrollRun","expiringDocuments","expiringContracts","expiringProbations"];
    const unavailableMetrics = settled.flatMap((result, index) =>
      result.status === 'rejected' ? [metricNames[index]] : [],
    );
    if (unavailableMetrics.length > 0) {
      Logger.warn('HR dashboard query failures: ' + unavailableMetrics.join(', '), HrDashboardService.name);
    }
    const [

      totalEmployees,
      activeEmployees,
      onLeaveEmployees,
      suspendedEmployees,
      terminatedEmployees,
      presentToday,
      absentToday,
      lateToday,
      remoteToday,
      pendingLeaves,
      departments,
      shifts,
      payrollAggregate,
      draftPayrolls,
      approvedPayrolls,
      paidPayrolls,
      currentPayrollRun,
      expiringDocuments,
      expiringContracts,
      expiringProbations,
    ] = settled.map((result) => result.status === 'fulfilled' ? result.value : null) as any[];

    return {
      generatedAt: new Date().toISOString(),
      timezone: 'Asia/Riyadh',
      unavailableMetrics,
      workforce: {
        total: totalEmployees,
        active: activeEmployees,
        onLeave: onLeaveEmployees,
        suspended: suspendedEmployees,
        terminated: terminatedEmployees,
      },
      attendanceToday: {
        present: presentToday,
        absent: absentToday,
        late: lateToday,
        remote: remoteToday,
      },
      pendingLeaves,
      departments,
      shifts,
      expiries: {
        documents: expiringDocuments,
        contracts: expiringContracts,
        probation: expiringProbations,
        horizonDays: 30,
      },
      payroll: {
        month,
        year,
        records: payrollAggregate?._count?._all ?? null,
        netTotal: payrollAggregate ? Number(payrollAggregate._sum.netSalary || 0) : null,
        draft: draftPayrolls,
        approved: approvedPayrolls,
        paid: paidPayrolls,
        run: currentPayrollRun ? {
          id: currentPayrollRun.id,
          status: currentPayrollRun.status,
          employeeCount: currentPayrollRun.employeeCount,
          grossTotal: Number(currentPayrollRun.grossTotal),
          deductionTotal: Number(currentPayrollRun.deductionTotal),
          netTotal: Number(currentPayrollRun.netTotal),
        } : null,
      },
    };
  }
}
