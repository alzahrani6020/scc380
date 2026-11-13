import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, prisma, tenantWhere } from '@scc/database';

@Injectable()
export class BudgetsService {
  private async getPlan(tenantId: string, id: string) {
    const plan = await prisma.budgetPlan.findFirst({
      where: { ...tenantWhere(tenantId), id },
      include: {
        lines: {
          include: {
            account: { select: { id: true, code: true, name: true, type: true } },
            costCenter: { select: { id: true, code: true, name: true } },
          },
          orderBy: [{ month: 'asc' }, { account: { code: 'asc' } }],
        },
      },
    });
    if (!plan) throw new NotFoundException('Budget plan not found');
    return plan;
  }

  async findAll(req: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant is required');
    const data = await prisma.budgetPlan.findMany({
      where: tenantWhere(tenantId),
      include: { _count: { select: { lines: true } } },
      orderBy: { year: 'desc' },
    });
    return { data, count: data.length };
  }

  async findOne(req: any, id: string) {
    return this.getPlan(req.user?.tenantId, id);
  }

  async create(req: any, dto: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant is required');
    const year = Number(dto.year);
    if (!Number.isInteger(year) || year < 2000 || year > 2200) {
      throw new BadRequestException('Invalid budget year');
    }
    const existing = await prisma.budgetPlan.findFirst({
      where: { tenantId, year },
      select: { id: true },
    });
    if (existing) throw new ConflictException('A budget plan already exists for this year');

    return prisma.budgetPlan.create({
      data: {
        tenantId,
        year,
        name: String(dto.name || `Budget ${year}`).trim(),
        notes: dto.notes || null,
      },
    });
  }

  private async validateLineDimensions(
    tenantId: string,
    accountId: string,
    costCenterId?: string | null,
  ) {
    const [account, costCenter] = await Promise.all([
      prisma.chartOfAccount.findFirst({
        where: { tenantId, id: accountId, isActive: true },
        select: { id: true, type: true },
      }),
      costCenterId
        ? prisma.costCenter.findFirst({
            where: { tenantId, id: costCenterId, isActive: true },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);
    if (!account) throw new BadRequestException('Active budget account not found for tenant');
    if (costCenterId && !costCenter) {
      throw new BadRequestException('Active cost center not found for tenant');
    }
  }

  private async assertNoBudgetOverlap(
    planId: string,
    accountId: string,
    month: number,
    costCenterId?: string | null,
    excludeId?: string,
  ) {
    const rows = await prisma.budgetLine.findMany({
      where: {
        planId,
        accountId,
        month,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true, costCenterId: true },
    });

    if (costCenterId) {
      if (rows.some((row) => row.costCenterId === null)) {
        throw new ConflictException(
          'Account/month already has a total budget; remove it before cost-center allocation',
        );
      }
      if (rows.some((row) => row.costCenterId === costCenterId)) {
        throw new ConflictException('Budget line already exists for account/month/cost center');
      }
    } else if (rows.length > 0) {
      throw new ConflictException(
        'Account/month already has cost-center allocations or a total budget',
      );
    }
  }

  async addLine(req: any, planId: string, dto: any) {
    const tenantId = req.user?.tenantId;
    const plan = await this.getPlan(tenantId, planId);
    if (plan.status !== 'DRAFT') {
      throw new ConflictException('Approved budget is immutable; reopen it first');
    }

    const month = Number(dto.month);
    const amount = new Prisma.Decimal(dto.amount);
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new BadRequestException('month must be between 1 and 12');
    }
    if (amount.isNegative()) throw new BadRequestException('Budget amount cannot be negative');

    const costCenterId = dto.costCenterId || null;
    await this.validateLineDimensions(tenantId, dto.accountId, costCenterId);
    await this.assertNoBudgetOverlap(planId, dto.accountId, month, costCenterId);

    return prisma.budgetLine.create({
      data: {
        tenantId,
        planId,
        month,
        accountId: dto.accountId,
        costCenterId,
        amount,
        notes: dto.notes || null,
      },
      include: {
        account: { select: { id: true, code: true, name: true, type: true } },
        costCenter: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async updateLine(req: any, planId: string, lineId: string, dto: any) {
    const tenantId = req.user?.tenantId;
    const plan = await this.getPlan(tenantId, planId);
    if (plan.status !== 'DRAFT') {
      throw new ConflictException('Approved budget is immutable; reopen it first');
    }
    const existing = plan.lines.find((line) => line.id === lineId);
    if (!existing) throw new NotFoundException('Budget line not found');

    const month = dto.month === undefined ? existing.month : Number(dto.month);
    const accountId = dto.accountId || existing.accountId;
    const costCenterId =
      dto.costCenterId === undefined ? existing.costCenterId : dto.costCenterId || null;
    const amount =
      dto.amount === undefined ? new Prisma.Decimal(existing.amount) : new Prisma.Decimal(dto.amount);

    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new BadRequestException('month must be between 1 and 12');
    }
    if (amount.isNegative()) throw new BadRequestException('Budget amount cannot be negative');

    await this.validateLineDimensions(tenantId, accountId, costCenterId);
    await this.assertNoBudgetOverlap(planId, accountId, month, costCenterId, lineId);

    return prisma.budgetLine.update({
      where: { id: lineId },
      data: {
        month,
        accountId,
        costCenterId,
        amount,
        ...(dto.notes !== undefined ? { notes: dto.notes || null } : {}),
      },
    });
  }

  async removeLine(req: any, planId: string, lineId: string) {
    const tenantId = req.user?.tenantId;
    const plan = await this.getPlan(tenantId, planId);
    if (plan.status !== 'DRAFT') {
      throw new ConflictException('Approved budget is immutable; reopen it first');
    }
    const existing = plan.lines.find((line) => line.id === lineId);
    if (!existing) throw new NotFoundException('Budget line not found');
    return prisma.budgetLine.delete({ where: { id: lineId } });
  }

  async approve(req: any, id: string) {
    const tenantId = req.user?.tenantId;
    const plan = await this.getPlan(tenantId, id);
    if (plan.status === 'APPROVED') throw new ConflictException('Budget is already approved');
    if (plan.lines.length === 0) throw new ConflictException('Cannot approve an empty budget');
    return prisma.budgetPlan.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy: req.user?.sub || req.user?.id || null,
      },
    });
  }

  async reopen(req: any, id: string) {
    const tenantId = req.user?.tenantId;
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user?.role)) {
      throw new ForbiddenException('Only ADMIN or SUPER_ADMIN can reopen an approved budget');
    }
    const plan = await this.getPlan(tenantId, id);
    if (plan.status !== 'APPROVED') throw new ConflictException('Budget is already draft');
    return prisma.budgetPlan.update({
      where: { id },
      data: { status: 'DRAFT', approvedAt: null, approvedBy: null },
    });
  }

  private signedActual(type: string, debit: number, credit: number) {
    return ['LIABILITY', 'EQUITY', 'REVENUE'].includes(type)
      ? credit - debit
      : debit - credit;
  }

  private favorableVariance(type: string, budget: number, actual: number) {
    if (type === 'EXPENSE') return budget - actual;
    if (type === 'REVENUE') return actual - budget;
    return budget - actual;
  }

  async report(req: any, id: string) {
    const tenantId = req.user?.tenantId;
    const plan = await this.getPlan(tenantId, id);
    const from = new Date(Date.UTC(plan.year, 0, 1, 0, 0, 0, 0));
    const to = new Date(Date.UTC(plan.year, 11, 31, 23, 59, 59, 999));

    const [modern, legacy] = await Promise.all([
      prisma.journalEntryLine.findMany({
        where: {
          tenantId,
          journalEntry: {
            tenantId,
            status: 'POSTED',
            date: { gte: from, lte: to },
          },
        },
        select: {
          accountId: true,
          costCenterId: true,
          debitAmount: true,
          creditAmount: true,
          chartAccount: { select: { type: true } },
          journalEntry: { select: { date: true } },
        },
      }),
      prisma.journalEntry.findMany({
        where: {
          tenantId,
          status: 'POSTED',
          NOT: { entryNumber: { startsWith: 'LEG-' } },
          accountId: { not: null },
          date: { gte: from, lte: to },
        },
        select: {
          accountId: true,
          debitAmount: true,
          creditAmount: true,
          date: true,
          chartAccount: { select: { type: true } },
        },
      }),
    ]);

    const rows = plan.lines.map((line) => {
      const modernActual = modern
        .filter((entry) => {
          if (entry.accountId !== line.accountId) return false;
          if (entry.journalEntry.date.getUTCMonth() + 1 !== line.month) return false;
          if (line.costCenterId && entry.costCenterId !== line.costCenterId) return false;
          return true;
        })
        .reduce(
          (sum, entry) =>
            sum +
            this.signedActual(
              entry.chartAccount.type,
              Number(entry.debitAmount || 0),
              Number(entry.creditAmount || 0),
            ),
          0,
        );

      const legacyActual = line.costCenterId
        ? 0
        : legacy
            .filter(
              (entry) =>
                entry.accountId === line.accountId &&
                entry.date.getUTCMonth() + 1 === line.month,
            )
            .reduce(
              (sum, entry) =>
                sum +
                this.signedActual(
                  entry.chartAccount?.type || line.account.type,
                  Number(entry.debitAmount || 0),
                  Number(entry.creditAmount || 0),
                ),
              0,
            );

      const budget = Number(line.amount);
      const actual = modernActual + legacyActual;
      return {
        id: line.id,
        month: line.month,
        account: line.account,
        costCenter: line.costCenter,
        budget,
        actual,
        variance: actual - budget,
        favorableVariance: this.favorableVariance(line.account.type, budget, actual),
        usagePct: budget === 0 ? null : Number(((actual / budget) * 100).toFixed(2)),
      };
    });

    const totals = rows.reduce(
      (acc, row) => {
        acc.budget += row.budget;
        acc.actual += row.actual;
        return acc;
      },
      { budget: 0, actual: 0 },
    );

    return {
      plan: {
        id: plan.id,
        year: plan.year,
        name: plan.name,
        status: plan.status,
        approvedAt: plan.approvedAt,
      },
      rows,
      totals: {
        ...totals,
        variance: totals.actual - totals.budget,
        usagePct:
          totals.budget === 0 ? null : Number(((totals.actual / totals.budget) * 100).toFixed(2)),
      },
    };
  }
}
