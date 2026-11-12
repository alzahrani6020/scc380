import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class JournalEntriesService {
  private validateAmounts(debitAmount: number, creditAmount: number) {
    const debit = Number(debitAmount || 0);
    const credit = Number(creditAmount || 0);
    if (debit < 0 || credit < 0) {
      throw new BadRequestException('Debit and credit amounts cannot be negative');
    }
    if ((debit > 0 && credit > 0) || (debit === 0 && credit === 0)) {
      throw new BadRequestException('Exactly one of debitAmount or creditAmount must be greater than zero');
    }
  }

  private async assertAccount(tenantId: string, accountId: string) {
    const account = await prisma.chartOfAccount.findFirst({
      where: { id: accountId, tenantId, isActive: true },
      select: { id: true },
    });
    if (!account) throw new BadRequestException('Active chart account not found for tenant');
  }

  private async assertPeriodOpen(tenantId: string, date: Date) {
    const closedPeriod = await prisma.financialPeriod.findFirst({
      where: {
        tenantId,
        isClosed: true,
        startDate: { lte: date },
        endDate: { gte: date },
      },
      select: { id: true, name: true },
    });
    if (closedPeriod) {
      throw new ConflictException(`Financial period "${closedPeriod.name}" is closed`);
    }
  }

  async findAll(req: any, query: any) {
    const where: any = { ...tenantWhere(req.user?.tenantId) };
    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;
    if (query.from || query.to) {
      where.date = {};
      if (query.from) where.date.gte = new Date(query.from);
      if (query.to) where.date.lte = new Date(query.to);
    }
    const [data, count] = await Promise.all([
      prisma.journalEntry.findMany({ where, orderBy: { date: 'desc' }, take: 200 }),
      prisma.journalEntry.count({ where }),
    ]);
    return { data, count };
  }

  async findOne(req: any, id: string) {
    const where = { ...tenantWhere(req.user?.tenantId), id };
    const item = await prisma.journalEntry.findFirst({ where });
    if (!item) throw new NotFoundException('Journal entry not found');
    return item;
  }

  async create(req: any, dto: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant is required');

    const existing = await prisma.journalEntry.findFirst({
      where: { tenantId, entryNumber: dto.entryNumber },
    });
    if (existing) throw new ConflictException('Entry number already exists');

    this.validateAmounts(dto.debitAmount, dto.creditAmount);
    await this.assertAccount(tenantId, dto.accountId);

    const date = dto.date ? new Date(dto.date) : new Date();
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Invalid journal date');

    const status = dto.status || 'POSTED';
    if (status === 'POSTED') await this.assertPeriodOpen(tenantId, date);

    return prisma.journalEntry.create({
      data: { ...dto, tenantId, date, status },
    });
  }

  async update(req: any, id: string, dto: any) {
    const tenantId = req.user?.tenantId;
    const where = { ...tenantWhere(tenantId), id };
    const existing = await prisma.journalEntry.findFirst({ where });
    if (!existing) throw new NotFoundException('Journal entry not found');
    if (existing.status === 'POSTED') {
      throw new ConflictException('Posted journal entries are immutable; reverse the entry instead');
    }

    const debitAmount = dto.debitAmount ?? existing.debitAmount;
    const creditAmount = dto.creditAmount ?? existing.creditAmount;
    this.validateAmounts(Number(debitAmount), Number(creditAmount));

    const date = dto.date ? new Date(dto.date) : existing.date;
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Invalid journal date');

    if (dto.accountId) await this.assertAccount(tenantId, dto.accountId);
    if (dto.status === 'POSTED') await this.assertPeriodOpen(tenantId, date);

    return prisma.journalEntry.update({ where: { id }, data: { ...dto, date } });
  }

  async reverse(req: any, id: string, dto: any) {
    const tenantId = req.user?.tenantId;
    const where = { ...tenantWhere(tenantId), id };
    const existing = await prisma.journalEntry.findFirst({ where });
    if (!existing) throw new NotFoundException('Journal entry not found');
    if (existing.status !== 'POSTED') {
      throw new ConflictException('Only posted journal entries can be reversed');
    }
    if (!existing.accountId) {
      throw new ConflictException('Legacy journal entry has no account and cannot be safely reversed');
    }

    const entryNumber = dto.entryNumber;
    if (!entryNumber) throw new BadRequestException('Reversal entry number is required');

    const duplicate = await prisma.journalEntry.findFirst({
      where: { tenantId, entryNumber },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('Entry number already exists');

    const date = dto.date ? new Date(dto.date) : new Date();
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Invalid reversal date');
    await this.assertPeriodOpen(tenantId, date);

    return prisma.journalEntry.create({
      data: {
        tenantId,
        entryNumber,
        date,
        description: dto.description || `Reversal of ${existing.entryNumber}: ${existing.description}`,
        reference: dto.reference || `REV-${existing.entryNumber}`,
        debitAmount: existing.creditAmount,
        creditAmount: existing.debitAmount,
        accountId: existing.accountId,
        type: existing.type,
        status: 'POSTED',
      },
    });
  }

  async remove(req: any, id: string) {
    const where = { ...tenantWhere(req.user?.tenantId), id };
    const existing = await prisma.journalEntry.findFirst({ where });
    if (!existing) throw new NotFoundException('Journal entry not found');
    if (existing.status === 'POSTED') {
      throw new ConflictException('Posted journal entries cannot be deleted; reverse the entry instead');
    }
    return prisma.journalEntry.delete({ where: { id } });
  }
}
