import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class LeaveBalancesService {
  async findAll(req: any, query: any) {
    const where: any = { ...tenantWhere(req.user?.tenantId) };
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.type) where.type = query.type;
    if (query.year) where.year = Number(query.year);

    const data = await prisma.leaveBalance.findMany({
      where,
      include: {
        employee: { select: { firstName: true, lastName: true, employeeCode: true } },
        adjustments: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
      orderBy: [{ year: 'desc' }, { type: 'asc' }],
    });
    return {
      data: data.map((row) => ({
        ...row,
        available: row.entitlement + row.carriedForward + row.adjustment - row.used - row.pending,
      })),
      count: data.length,
    };
  }

  async initialize(req: any, employeeId: string, year: number) {
    const tenantId = req.user?.tenantId;
    await this.assertEmployee(tenantId, employeeId);
    const policies = await prisma.leavePolicy.findMany({
      where: { ...tenantWhere(tenantId), isActive: true },
    });
    if (policies.length === 0) throw new BadRequestException('No active leave policies configured');

    return prisma.$transaction(async (tx) => {
      const balances = [];
      for (const policy of policies) {
        let carriedForward = 0;
        const previous = await tx.leaveBalance.findUnique({
          where: {
            tenantId_employeeId_type_year: {
              tenantId,
              employeeId,
              type: policy.type,
              year: year - 1,
            },
          },
        });
        if (previous) {
          const previousAvailable =
            previous.entitlement + previous.carriedForward + previous.adjustment - previous.used - previous.pending;
          carriedForward = Math.min(policy.maxCarryForward, Math.max(0, previousAvailable));
        }

        const balance = await tx.leaveBalance.upsert({
          where: {
            tenantId_employeeId_type_year: { tenantId, employeeId, type: policy.type, year },
          },
          create: {
            tenantId,
            employeeId,
            type: policy.type,
            year,
            entitlement: policy.annualEntitlement,
            carriedForward,
          },
          update: {},
        });
        balances.push(balance);
      }
      return balances;
    });
  }

  async adjust(req: any, id: string, amount: number, reason: string) {
    if (!amount) throw new BadRequestException('Adjustment amount must not be zero');
    const tenantId = req.user?.tenantId;
    const balance = await prisma.leaveBalance.findFirst({
      where: { ...tenantWhere(tenantId), id },
    });
    if (!balance) throw new NotFoundException('Leave balance not found');

    const nextAdjustment = balance.adjustment + amount;
    const nextAvailable =
      balance.entitlement + balance.carriedForward + nextAdjustment - balance.used - balance.pending;
    if (nextAvailable < 0) throw new BadRequestException('Adjustment would make leave balance negative');

    return prisma.$transaction(async (tx) => {
      await tx.leaveBalanceAdjustment.create({
        data: {
          tenantId,
          balanceId: id,
          amount,
          reason,
          createdById: req.user?.userId || req.user?.sub || req.user?.id || null,
        },
      });
      return tx.leaveBalance.update({
        where: { id },
        data: { adjustment: { increment: amount } },
      });
    });
  }

  private async assertEmployee(tenantId: string, employeeId: string) {
    const employee = await prisma.employee.findFirst({ where: { ...tenantWhere(tenantId), id: employeeId } });
    if (!employee) throw new NotFoundException('Employee not found');
  }
}
