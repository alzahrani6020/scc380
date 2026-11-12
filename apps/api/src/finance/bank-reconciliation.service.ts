import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class BankReconciliationService {
  private parseDate(value: string | Date, field: string) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException(`Invalid ${field}`);
    return date;
  }

  private async getBankAccount(tenantId: string, bankAccountId: string) {
    const account = await prisma.bankAccount.findFirst({
      where: { ...tenantWhere(tenantId), id: bankAccountId, isActive: true },
      include: { chartAccount: true },
    });
    if (!account) throw new NotFoundException('Active bank account not found');
    if (!account.chartAccountId || !account.chartAccount) {
      throw new ConflictException('Bank account must be linked to an active GL account before reconciliation');
    }
    if (!account.chartAccount.isActive || account.chartAccount.tenantId !== tenantId) {
      throw new ConflictException('Bank GL account is inactive or outside tenant');
    }
    if (account.chartAccount.type !== 'ASSET') {
      throw new ConflictException('Bank GL account must be an ASSET account');
    }
    return account;
  }

  private async getReconciliation(tenantId: string, id: string) {
    const item = await prisma.bankReconciliation.findFirst({
      where: { ...tenantWhere(tenantId), id },
      include: {
        bankAccount: true,
        lines: { orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }] },
      },
    });
    if (!item) throw new NotFoundException('Bank reconciliation not found');
    return item;
  }

  private signedAmount(debit: unknown, credit: unknown) {
    return Number(debit || 0) - Number(credit || 0);
  }

  async findAll(req: any, bankAccountId?: string) {
    const tenantId = req.user?.tenantId;
    const where: any = { ...tenantWhere(tenantId) };
    if (bankAccountId) where.bankAccountId = bankAccountId;
    const [data, count] = await Promise.all([
      prisma.bankReconciliation.findMany({
        where,
        include: {
          bankAccount: {
            select: {
              id: true,
              bankName: true,
              accountName: true,
              accountNumber: true,
              chartAccountId: true,
            },
          },
          _count: { select: { lines: true } },
        },
        orderBy: { endDate: 'desc' },
      }),
      prisma.bankReconciliation.count({ where }),
    ]);
    return { data, count };
  }

  async findOne(req: any, id: string) {
    return this.getReconciliation(req.user?.tenantId, id);
  }

  async create(req: any, dto: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant is required');
    await this.getBankAccount(tenantId, dto.bankAccountId);

    const startDate = this.parseDate(dto.startDate, 'startDate');
    const endDate = this.parseDate(dto.endDate, 'endDate');
    if (startDate > endDate) throw new BadRequestException('startDate must be before endDate');

    const overlap = await prisma.bankReconciliation.findFirst({
      where: {
        tenantId,
        bankAccountId: dto.bankAccountId,
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: { id: true },
    });
    if (overlap) throw new ConflictException('Bank reconciliation period overlaps an existing reconciliation');

    return prisma.bankReconciliation.create({
      data: {
        tenantId,
        bankAccountId: dto.bankAccountId,
        startDate,
        endDate,
        openingBalance: dto.openingBalance,
        endingBalance: dto.endingBalance,
      },
    });
  }

  async addLines(req: any, id: string, lines: any[]) {
    const tenantId = req.user?.tenantId;
    const reconciliation = await this.getReconciliation(tenantId, id);
    if (reconciliation.status === 'COMPLETED') {
      throw new ConflictException('Completed reconciliation is immutable; reopen it first');
    }
    if (!Array.isArray(lines) || lines.length === 0) {
      throw new BadRequestException('At least one statement line is required');
    }

    const data = lines.map((line) => {
      const transactionDate = this.parseDate(line.transactionDate, 'transactionDate');
      if (transactionDate < reconciliation.startDate || transactionDate > reconciliation.endDate) {
        throw new BadRequestException('Statement line date is outside reconciliation period');
      }
      const amount = Number(line.amount);
      if (!Number.isFinite(amount) || Math.abs(amount) < 0.005) {
        throw new BadRequestException('Statement line amount must be non-zero');
      }
      return {
        tenantId,
        reconciliationId: reconciliation.id,
        bankAccountId: reconciliation.bankAccountId,
        transactionDate,
        amount,
        reference: line.reference || null,
        description: line.description || null,
        externalId: line.externalId || null,
      };
    });

    await prisma.bankStatementLine.createMany({ data });
    return this.getReconciliation(tenantId, id);
  }

  private async assertTargetAvailable(
    tenantId: string,
    modernId?: string,
    legacyId?: string,
    excludingLineId?: string,
  ) {
    const used = await prisma.bankStatementLine.findFirst({
      where: {
        tenantId,
        ...(excludingLineId ? { NOT: { id: excludingLineId } } : {}),
        status: 'MATCHED',
        OR: [
          ...(modernId ? [{ matchedJournalEntryLineId: modernId }] : []),
          ...(legacyId ? [{ matchedLegacyJournalEntryId: legacyId }] : []),
        ],
      },
      select: { id: true },
    });
    if (used) throw new ConflictException('Ledger item is already matched to another statement line');
  }

  async getMatchCandidates(req: any, reconciliationId: string, lineId: string) {
    const tenantId = req.user?.tenantId;
    const reconciliation = await this.getReconciliation(tenantId, reconciliationId);
    const line = reconciliation.lines.find((x) => x.id === lineId);
    if (!line) throw new NotFoundException('Statement line not found');

    const bank = await this.getBankAccount(tenantId, reconciliation.bankAccountId);
    const from = new Date(line.transactionDate);
    from.setUTCDate(from.getUTCDate() - 14);
    const to = new Date(line.transactionDate);
    to.setUTCDate(to.getUTCDate() + 14);
    const amount = Number(line.amount);

    const [modern, legacy] = await Promise.all([
      prisma.journalEntryLine.findMany({
        where: {
          tenantId,
          accountId: bank.chartAccountId!,
          journalEntry: { tenantId, status: 'POSTED', date: { gte: from, lte: to } },
        },
        include: {
          journalEntry: {
            select: { date: true, description: true, reference: true, entryNumber: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.journalEntry.findMany({
        where: {
          tenantId,
          accountId: bank.chartAccountId!,
          status: 'POSTED',
          NOT: { entryNumber: { startsWith: 'LEG-' } },
          date: { gte: from, lte: to },
        },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);

    const candidates: any[] = [];
    for (const item of modern) {
      const signed = this.signedAmount(item.debitAmount, item.creditAmount);
      if (Math.abs(signed - amount) >= 0.01) continue;
      try {
        await this.assertTargetAvailable(tenantId, item.id, undefined, line.id);
        candidates.push({
          kind: 'MODERN',
          id: item.id,
          date: item.journalEntry.date,
          entryNumber: item.journalEntry.entryNumber,
          description: item.description || item.journalEntry.description,
          reference: item.journalEntry.reference,
          amount: signed,
        });
      } catch (error) {
        if (!(error instanceof ConflictException)) throw error;
      }
    }

    for (const item of legacy) {
      const signed = this.signedAmount(item.debitAmount, item.creditAmount);
      if (Math.abs(signed - amount) >= 0.01) continue;
      try {
        await this.assertTargetAvailable(tenantId, undefined, item.id, line.id);
        candidates.push({
          kind: 'LEGACY',
          id: item.id,
          date: item.date,
          entryNumber: item.entryNumber,
          description: item.description,
          reference: item.reference,
          amount: signed,
        });
      } catch (error) {
        if (!(error instanceof ConflictException)) throw error;
      }
    }

    return { statementLine: line, candidates };
  }

  async matchLine(req: any, reconciliationId: string, lineId: string, dto: any) {
    const tenantId = req.user?.tenantId;
    const reconciliation = await this.getReconciliation(tenantId, reconciliationId);
    if (reconciliation.status === 'COMPLETED') {
      throw new ConflictException('Completed reconciliation is immutable; reopen it first');
    }
    const line = reconciliation.lines.find((x) => x.id === lineId);
    if (!line) throw new NotFoundException('Statement line not found');

    const modernId = dto.journalEntryLineId as string | undefined;
    const legacyId = dto.legacyJournalEntryId as string | undefined;
    if ((modernId ? 1 : 0) + (legacyId ? 1 : 0) !== 1) {
      throw new BadRequestException('Provide exactly one ledger match target');
    }

    const bank = await this.getBankAccount(tenantId, reconciliation.bankAccountId);
    await this.assertTargetAvailable(tenantId, modernId, legacyId, line.id);

    let ledgerAmount = 0;
    if (modernId) {
      const target = await prisma.journalEntryLine.findFirst({
        where: {
          id: modernId,
          tenantId,
          accountId: bank.chartAccountId!,
          journalEntry: { tenantId, status: 'POSTED' },
        },
        select: { debitAmount: true, creditAmount: true },
      });
      if (!target) throw new BadRequestException('Eligible modern ledger line not found');
      ledgerAmount = this.signedAmount(target.debitAmount, target.creditAmount);
    } else {
      const target = await prisma.journalEntry.findFirst({
        where: {
          id: legacyId,
          tenantId,
          accountId: bank.chartAccountId!,
          status: 'POSTED',
          NOT: { entryNumber: { startsWith: 'LEG-' } },
        },
        select: { debitAmount: true, creditAmount: true },
      });
      if (!target) throw new BadRequestException('Eligible legacy ledger entry not found');
      ledgerAmount = this.signedAmount(target.debitAmount, target.creditAmount);
    }

    if (Math.abs(ledgerAmount - Number(line.amount)) >= 0.01) {
      throw new ConflictException(
        `Statement amount ${Number(line.amount).toFixed(2)} does not equal ledger amount ${ledgerAmount.toFixed(2)}`,
      );
    }

    return prisma.bankStatementLine.update({
      where: { id: line.id },
      data: {
        status: 'MATCHED',
        matchedJournalEntryLineId: modernId || null,
        matchedLegacyJournalEntryId: legacyId || null,
      },
    });
  }

  async unmatchLine(req: any, reconciliationId: string, lineId: string) {
    const tenantId = req.user?.tenantId;
    const reconciliation = await this.getReconciliation(tenantId, reconciliationId);
    if (reconciliation.status === 'COMPLETED') {
      throw new ConflictException('Completed reconciliation is immutable; reopen it first');
    }
    const line = reconciliation.lines.find((x) => x.id === lineId);
    if (!line) throw new NotFoundException('Statement line not found');
    return prisma.bankStatementLine.update({
      where: { id: line.id },
      data: {
        status: 'UNMATCHED',
        matchedJournalEntryLineId: null,
        matchedLegacyJournalEntryId: null,
      },
    });
  }

  async autoMatch(req: any, id: string) {
    const tenantId = req.user?.tenantId;
    const reconciliation = await this.getReconciliation(tenantId, id);
    if (reconciliation.status === 'COMPLETED') {
      throw new ConflictException('Completed reconciliation is immutable; reopen it first');
    }
    const bank = await this.getBankAccount(tenantId, reconciliation.bankAccountId);
    let matched = 0;

    for (const line of reconciliation.lines.filter((x) => x.status === 'UNMATCHED')) {
      const from = new Date(line.transactionDate);
      from.setUTCDate(from.getUTCDate() - 3);
      const to = new Date(line.transactionDate);
      to.setUTCDate(to.getUTCDate() + 3);
      const amount = Number(line.amount);

      const [modern, legacy] = await Promise.all([
        prisma.journalEntryLine.findMany({
          where: {
            tenantId,
            accountId: bank.chartAccountId!,
            journalEntry: { tenantId, status: 'POSTED', date: { gte: from, lte: to } },
          },
          select: { id: true, debitAmount: true, creditAmount: true },
        }),
        prisma.journalEntry.findMany({
          where: {
            tenantId,
            accountId: bank.chartAccountId!,
            status: 'POSTED',
            NOT: { entryNumber: { startsWith: 'LEG-' } },
            date: { gte: from, lte: to },
          },
          select: { id: true, debitAmount: true, creditAmount: true },
        }),
      ]);

      const candidates: Array<{ modernId?: string; legacyId?: string }> = [
        ...modern
          .filter((x) => Math.abs(this.signedAmount(x.debitAmount, x.creditAmount) - amount) < 0.01)
          .map((x) => ({ modernId: x.id })),
        ...legacy
          .filter((x) => Math.abs(this.signedAmount(x.debitAmount, x.creditAmount) - amount) < 0.01)
          .map((x) => ({ legacyId: x.id })),
      ];

      const available: Array<{ modernId?: string; legacyId?: string }> = [];
      for (const candidate of candidates) {
        try {
          await this.assertTargetAvailable(tenantId, candidate.modernId, candidate.legacyId, line.id);
          available.push(candidate);
        } catch (error) {
          if (!(error instanceof ConflictException)) throw error;
        }
      }

      if (available.length === 1) {
        const candidate = available[0];
        await prisma.bankStatementLine.update({
          where: { id: line.id },
          data: {
            status: 'MATCHED',
            matchedJournalEntryLineId: candidate.modernId || null,
            matchedLegacyJournalEntryId: candidate.legacyId || null,
          },
        });
        matched += 1;
      }
    }

    const result = await this.getReconciliation(tenantId, id);
    return { ...result, autoMatched: matched };
  }

  private async ledgerBalance(tenantId: string, accountId: string, endDate: Date) {
    const [legacy, modern] = await Promise.all([
      prisma.journalEntry.aggregate({
        where: {
          tenantId,
          accountId,
          status: 'POSTED',
          NOT: { entryNumber: { startsWith: 'LEG-' } },
          date: { lte: endDate },
        },
        _sum: { debitAmount: true, creditAmount: true },
      }),
      prisma.journalEntryLine.aggregate({
        where: {
          tenantId,
          accountId,
          journalEntry: { tenantId, status: 'POSTED', date: { lte: endDate } },
        },
        _sum: { debitAmount: true, creditAmount: true },
      }),
    ]);
    return (
      Number(legacy._sum.debitAmount || 0) -
      Number(legacy._sum.creditAmount || 0) +
      Number(modern._sum.debitAmount || 0) -
      Number(modern._sum.creditAmount || 0)
    );
  }

  async complete(req: any, id: string) {
    const tenantId = req.user?.tenantId;
    const reconciliation = await this.getReconciliation(tenantId, id);
    if (reconciliation.status === 'COMPLETED') {
      throw new ConflictException('Bank reconciliation is already completed');
    }
    const bank = await this.getBankAccount(tenantId, reconciliation.bankAccountId);

    const unmatched = reconciliation.lines.filter((x) => x.status !== 'MATCHED').length;
    if (unmatched > 0) {
      throw new ConflictException(`Cannot complete reconciliation with ${unmatched} unmatched statement lines`);
    }

    const statementMovement = reconciliation.lines.reduce((sum, line) => sum + Number(line.amount), 0);
    const calculatedEnding = Number(reconciliation.openingBalance) + statementMovement;
    if (Math.abs(calculatedEnding - Number(reconciliation.endingBalance)) >= 0.01) {
      throw new ConflictException(
        `Statement arithmetic mismatch: calculated=${calculatedEnding.toFixed(2)} ending=${Number(reconciliation.endingBalance).toFixed(2)}`,
      );
    }

    const ledgerBalance = await this.ledgerBalance(tenantId, bank.chartAccountId!, reconciliation.endDate);
    const difference = ledgerBalance - Number(reconciliation.endingBalance);
    if (Math.abs(difference) >= 0.01) {
      throw new ConflictException(
        `Bank reconciliation difference must be zero: ledger=${ledgerBalance.toFixed(2)} statement=${Number(reconciliation.endingBalance).toFixed(2)}`,
      );
    }

    return prisma.bankReconciliation.update({
      where: { id: reconciliation.id },
      data: {
        status: 'COMPLETED',
        ledgerBalance,
        difference,
        completedAt: new Date(),
      },
    });
  }

  async reopen(req: any, id: string) {
    const tenantId = req.user?.tenantId;
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user?.role)) {
      throw new ForbiddenException('Only ADMIN or SUPER_ADMIN can reopen a bank reconciliation');
    }
    const reconciliation = await this.getReconciliation(tenantId, id);
    if (reconciliation.status !== 'COMPLETED') {
      throw new ConflictException('Bank reconciliation is already open');
    }
    return prisma.bankReconciliation.update({
      where: { id },
      data: { status: 'DRAFT', completedAt: null },
    });
  }

  async remove(req: any, id: string) {
    const tenantId = req.user?.tenantId;
    const reconciliation = await this.getReconciliation(tenantId, id);
    if (reconciliation.status === 'COMPLETED') {
      throw new ConflictException('Completed reconciliation cannot be deleted; reopen it first');
    }
    return prisma.bankReconciliation.delete({ where: { id } });
  }
}
