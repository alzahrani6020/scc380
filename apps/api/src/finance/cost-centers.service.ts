import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class CostCentersService {
  private async findTenantCostCenter(tenantId: string, id: string) {
    const item = await prisma.costCenter.findFirst({
      where: { ...tenantWhere(tenantId), id },
    });
    if (!item) throw new NotFoundException('Cost center not found');
    return item;
  }

  async findAll(req: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant is required');
    const where = tenantWhere(tenantId);
    const [data, count] = await Promise.all([
      prisma.costCenter.findMany({
        where,
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      }),
      prisma.costCenter.count({ where }),
    ]);
    return { data, count };
  }

  async findOne(req: any, id: string) {
    return this.findTenantCostCenter(req.user?.tenantId, id);
  }

  async create(req: any, dto: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant is required');

    const name = String(dto.name || '').trim();
    const code = dto.code ? String(dto.code).trim() : null;
    if (!name) throw new BadRequestException('Cost center name is required');

    if (code) {
      const existing = await prisma.costCenter.findFirst({
        where: { tenantId, code },
        select: { id: true },
      });
      if (existing) throw new ConflictException('Cost center code already exists');
    }

    return prisma.costCenter.create({
      data: {
        tenantId,
        name,
        code,
        type: dto.type || 'DEPARTMENT',
        budget: dto.budget ?? null,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(req: any, id: string, dto: any) {
    const tenantId = req.user?.tenantId;
    const existing = await this.findTenantCostCenter(tenantId, id);

    if (dto.code !== undefined && dto.code !== existing.code) {
      const code = dto.code ? String(dto.code).trim() : null;
      if (code) {
        const duplicate = await prisma.costCenter.findFirst({
          where: { tenantId, code, NOT: { id } },
          select: { id: true },
        });
        if (duplicate) throw new ConflictException('Cost center code already exists');
      }
      dto.code = code;
    }

    if (dto.name !== undefined) {
      const name = String(dto.name || '').trim();
      if (!name) throw new BadRequestException('Cost center name is required');
      dto.name = name;
    }

    return prisma.costCenter.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.code !== undefined ? { code: dto.code } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.budget !== undefined ? { budget: dto.budget } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async remove(req: any, id: string) {
    const tenantId = req.user?.tenantId;
    await this.findTenantCostCenter(tenantId, id);

    const journalUsage = await prisma.journalEntryLine.count({
      where: { tenantId, costCenterId: id },
    });
    if (journalUsage > 0) {
      throw new ConflictException(
        'Cost center has journal history and cannot be deleted; deactivate it instead',
      );
    }

    return prisma.costCenter.delete({ where: { id } });
  }

  async report(req: any, id: string, from?: string, to?: string) {
    const tenantId = req.user?.tenantId;
    const costCenter = await this.findTenantCostCenter(tenantId, id);

    const parseDate = (value: string | undefined, endOfDay = false) => {
      if (!value) return undefined;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) throw new BadRequestException('Invalid report date');
      if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        date.setUTCHours(23, 59, 59, 999);
      }
      return date;
    };

    const fromDate = parseDate(from);
    const toDate = parseDate(to, true);
    if (fromDate && toDate && fromDate > toDate) {
      throw new BadRequestException('from must be before to');
    }

    const date =
      fromDate || toDate
        ? {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: toDate } : {}),
          }
        : undefined;

    const lines = await prisma.journalEntryLine.findMany({
      where: {
        tenantId,
        costCenterId: id,
        journalEntry: {
          tenantId,
          status: 'POSTED',
          ...(date ? { date } : {}),
        },
      },
      select: {
        debitAmount: true,
        creditAmount: true,
        accountId: true,
        chartAccount: {
          select: { code: true, name: true, type: true },
        },
      },
      orderBy: [{ accountId: 'asc' }, { createdAt: 'asc' }],
    });

    const accountMap = new Map<string, any>();
    let totalDebit = 0;
    let totalCredit = 0;

    for (const line of lines) {
      const debit = Number(line.debitAmount || 0);
      const credit = Number(line.creditAmount || 0);
      totalDebit += debit;
      totalCredit += credit;
      const current = accountMap.get(line.accountId) || {
        accountId: line.accountId,
        code: line.chartAccount.code,
        name: line.chartAccount.name,
        type: line.chartAccount.type,
        debit: 0,
        credit: 0,
        balance: 0,
      };
      current.debit += debit;
      current.credit += credit;
      current.balance = current.debit - current.credit;
      accountMap.set(line.accountId, current);
    }

    const budget = costCenter.budget == null ? null : Number(costCenter.budget);
    const expenseActual = [...accountMap.values()]
      .filter((row) => row.type === 'EXPENSE')
      .reduce((sum, row) => sum + row.balance, 0);

    return {
      costCenter,
      period: { from: from || null, to: to || null },
      totals: {
        debit: totalDebit,
        credit: totalCredit,
        balance: totalDebit - totalCredit,
        expenseActual,
        budget,
        budgetVariance: budget == null ? null : budget - expenseActual,
        budgetUsagePct:
          budget && budget !== 0 ? Number(((expenseActual / budget) * 100).toFixed(2)) : null,
      },
      accounts: [...accountMap.values()].sort((a, b) => a.code.localeCompare(b.code)),
      lineCount: lines.length,
    };
  }
}
