import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class FinancialPeriodsService {
  private parseDate(value: string | Date, field: string) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException(`Invalid ${field}`);
    return date;
  }

  private async findPeriod(tenantId: string, id: string) {
    const period = await prisma.financialPeriod.findFirst({
      where: { ...tenantWhere(tenantId), id },
    });
    if (!period) throw new NotFoundException('Financial period not found');
    return period;
  }

  private async assertNoOverlap(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    excludeId?: string,
  ) {
    const overlap = await prisma.financialPeriod.findFirst({
      where: {
        tenantId,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: { id: true, name: true },
    });
    if (overlap) {
      throw new ConflictException(`Financial period overlaps with "${overlap.name}"`);
    }
  }

  async findAll(req: any) {
    const tenantId = req.user?.tenantId;
    const where = tenantWhere(tenantId);
    const [data, count] = await Promise.all([
      prisma.financialPeriod.findMany({
        where,
        orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.financialPeriod.count({ where }),
    ]);
    return { data, count };
  }

  async create(req: any, dto: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant is required');

    const startDate = this.parseDate(dto.startDate, 'startDate');
    const endDate = this.parseDate(dto.endDate, 'endDate');
    if (startDate > endDate) throw new BadRequestException('startDate must be before endDate');

    await this.assertNoOverlap(tenantId, startDate, endDate);

    return prisma.financialPeriod.create({
      data: {
        tenantId,
        name: dto.name,
        year: dto.year,
        month: dto.month ?? null,
        startDate,
        endDate,
      },
    });
  }

  async update(req: any, id: string, dto: any) {
    const tenantId = req.user?.tenantId;
    const existing = await this.findPeriod(tenantId, id);
    if (existing.isClosed) {
      throw new ConflictException('Closed financial period is immutable; reopen it first');
    }

    const startDate = dto.startDate ? this.parseDate(dto.startDate, 'startDate') : existing.startDate;
    const endDate = dto.endDate ? this.parseDate(dto.endDate, 'endDate') : existing.endDate;
    if (startDate > endDate) throw new BadRequestException('startDate must be before endDate');

    await this.assertNoOverlap(tenantId, startDate, endDate, id);

    return prisma.financialPeriod.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.year !== undefined ? { year: dto.year } : {}),
        ...(dto.month !== undefined ? { month: dto.month } : {}),
        startDate,
        endDate,
      },
    });
  }

  async close(req: any, id: string) {
    const tenantId = req.user?.tenantId;
    const period = await this.findPeriod(tenantId, id);
    if (period.isClosed) throw new ConflictException('Financial period is already closed');

    const range = { gte: period.startDate, lte: period.endDate };

    const [draftHeaders, legacy, modern] = await Promise.all([
      prisma.journalEntryHeader.count({
        where: { tenantId, status: 'DRAFT', date: range },
      }),
      prisma.journalEntry.aggregate({
        where: {
          tenantId,
          status: 'POSTED',
          NOT: { entryNumber: { startsWith: 'LEG-' } },
          date: range,
        },
        _sum: { debitAmount: true, creditAmount: true },
      }),
      prisma.journalEntryLine.aggregate({
        where: {
          tenantId,
          journalEntry: {
            tenantId,
            status: 'POSTED',
            date: range,
          },
        },
        _sum: { debitAmount: true, creditAmount: true },
      }),
    ]);

    if (draftHeaders > 0) {
      throw new ConflictException(`Cannot close period with ${draftHeaders} draft journal entries`);
    }

    const debit = Number(legacy._sum.debitAmount || 0) + Number(modern._sum.debitAmount || 0);
    const credit = Number(legacy._sum.creditAmount || 0) + Number(modern._sum.creditAmount || 0);
    if (Math.abs(debit - credit) >= 0.01) {
      throw new ConflictException(
        `Cannot close unbalanced period: debit=${debit.toFixed(2)} credit=${credit.toFixed(2)}`,
      );
    }

    return prisma.financialPeriod.update({
      where: { id },
      data: { isClosed: true, closedAt: new Date() },
    });
  }

  async reopen(req: any, id: string) {
    const tenantId = req.user?.tenantId;
    const role = req.user?.role;
    if (!['ADMIN', 'SUPER_ADMIN'].includes(role)) {
      throw new ForbiddenException('Only ADMIN or SUPER_ADMIN can reopen a financial period');
    }

    const period = await this.findPeriod(tenantId, id);
    if (!period.isClosed) throw new ConflictException('Financial period is already open');

    return prisma.financialPeriod.update({
      where: { id },
      data: { isClosed: false, closedAt: null },
    });
  }

  async remove(req: any, id: string) {
    const tenantId = req.user?.tenantId;
    const period = await this.findPeriod(tenantId, id);
    if (period.isClosed) throw new ConflictException('Closed financial period cannot be deleted');

    const range = { gte: period.startDate, lte: period.endDate };
    const [legacyCount, modernCount] = await Promise.all([
      prisma.journalEntry.count({ where: { tenantId, date: range } }),
      prisma.journalEntryHeader.count({ where: { tenantId, date: range } }),
    ]);

    if (legacyCount > 0 || modernCount > 0) {
      throw new ConflictException('Financial period has journal activity and cannot be deleted');
    }

    return prisma.financialPeriod.delete({ where: { id } });
  }
}
