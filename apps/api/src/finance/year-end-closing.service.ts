import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JournalType, Prisma, prisma } from '@scc/database';
import { AccountingDualWriteService } from '../accounting-core/accounting-dual-write.service';

type DbClient = Prisma.TransactionClient | typeof prisma;

@Injectable()
export class YearEndClosingService {
  constructor(private readonly dualWrite: AccountingDualWriteService) {}

  private assertAdmin(req: any) {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user?.role)) {
      throw new ForbiddenException('Only ADMIN or SUPER_ADMIN can close or reverse a fiscal year');
    }
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant is required');
    return tenantId as string;
  }

  private async loadPeriods(client: DbClient, tenantId: string, year: number) {
    const periods = await client.financialPeriod.findMany({
      where: { tenantId, year },
      orderBy: [{ startDate: 'asc' }, { endDate: 'asc' }],
    });
    if (periods.length === 0) {
      throw new NotFoundException(`No financial periods found for fiscal year ${year}`);
    }
    return {
      periods,
      first: periods[0],
      final: periods[periods.length - 1],
      startDate: periods[0].startDate,
      endDate: periods[periods.length - 1].endDate,
    };
  }

  private async validateRetainedEarnings(
    client: DbClient,
    tenantId: string,
    accountId: string,
  ) {
    const account = await client.chartOfAccount.findFirst({
      where: {
        id: accountId,
        tenantId,
        type: 'EQUITY',
        isActive: true,
      },
      select: { id: true, code: true, name: true, type: true },
    });
    if (!account) {
      throw new BadRequestException(
        'Retained earnings account must be an active EQUITY account for tenant',
      );
    }
    return account;
  }

  private async assertCloseReadiness(
    client: DbClient,
    tenantId: string,
    year: number,
  ) {
    const range = await this.loadPeriods(client, tenantId, year);
    const earlierOpen = range.periods
      .slice(0, -1)
      .filter((period) => !period.isClosed);
    if (earlierOpen.length > 0) {
      throw new ConflictException(
        `Close earlier financial periods first: ${earlierOpen
          .map((period) => period.name)
          .join(', ')}`,
      );
    }
    if (range.final.isClosed) {
      throw new ConflictException(
        'Final financial period is already closed; reopen it before year-end closing',
      );
    }

    const dateRange = { gte: range.startDate, lte: range.endDate };
    const [draftModern, draftLegacy, draftBankReconciliations] =
      await Promise.all([
        client.journalEntryHeader.count({
          where: { tenantId, status: 'DRAFT', date: dateRange },
        }),
        client.journalEntry.count({
          where: { tenantId, status: 'DRAFT', date: dateRange },
        }),
        client.bankReconciliation.count({
          where: {
            tenantId,
            status: 'DRAFT',
            startDate: { lte: range.endDate },
            endDate: { gte: range.startDate },
          },
        }),
      ]);

    const draftJournals = draftModern + draftLegacy;
    if (draftJournals > 0) {
      throw new ConflictException(
        `Cannot close fiscal year with ${draftJournals} draft journal entries`,
      );
    }
    if (draftBankReconciliations > 0) {
      throw new ConflictException(
        `Cannot close fiscal year with ${draftBankReconciliations} incomplete bank reconciliations`,
      );
    }

    return range;
  }

  private async calculate(
    client: DbClient,
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ) {
    const accounts = await client.chartOfAccount.findMany({
      where: {
        tenantId,
        type: { in: ['REVENUE', 'EXPENSE'] },
      },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        isActive: true,
      },
      orderBy: { code: 'asc' },
    });
    const ids = accounts.map((account) => account.id);
    if (ids.length === 0) {
      return {
        accounts: [],
        closingLines: [],
        revenue: 0,
        expenses: 0,
        netIncome: 0,
      };
    }

    const range = { gte: startDate, lte: endDate };
    const [legacy, modern] = await Promise.all([
      client.journalEntry.groupBy({
        by: ['accountId'],
        where: {
          tenantId,
          accountId: { in: ids },
          status: 'POSTED',
          type: { not: 'CLOSING' },
          NOT: { entryNumber: { startsWith: 'LEG-' } },
          date: range,
        },
        _sum: { debitAmount: true, creditAmount: true },
      }),
      client.journalEntryLine.groupBy({
        by: ['accountId'],
        where: {
          tenantId,
          accountId: { in: ids },
          journalEntry: {
            tenantId,
            status: 'POSTED',
            date: range,
            type: { not: 'CLOSING' },
            OR: [
              { sourceType: null },
              {
                sourceType: {
                  notIn: ['YEAR_END_CLOSE', 'YEAR_END_REVERSAL'],
                },
              },
            ],
          },
        },
        _sum: { debitAmount: true, creditAmount: true },
      }),
    ]);

    const totals = new Map<string, { debit: number; credit: number }>();
    for (const row of [...legacy, ...modern]) {
      if (!row.accountId) continue;
      const current = totals.get(row.accountId) || { debit: 0, credit: 0 };
      current.debit += Number(row._sum.debitAmount || 0);
      current.credit += Number(row._sum.creditAmount || 0);
      totals.set(row.accountId, current);
    }

    let revenue = 0;
    let expenses = 0;
    const closingLines: Array<{
      accountId: string;
      accountCode: string;
      accountName: string;
      accountType: 'REVENUE' | 'EXPENSE';
      debitAmount?: number;
      creditAmount?: number;
      balance: number;
      description: string;
    }> = [];

    for (const account of accounts) {
      const total = totals.get(account.id) || { debit: 0, credit: 0 };
      const balance =
        account.type === 'REVENUE'
          ? total.credit - total.debit
          : total.debit - total.credit;
      if (Math.abs(balance) < 0.005) continue;

      if (!account.isActive) {
        throw new ConflictException(
          `Temporary account ${account.code} has a non-zero balance but is inactive`,
        );
      }

      if (account.type === 'REVENUE') revenue += balance;
      else expenses += balance;

      const line: any = {
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        accountType: account.type,
        balance,
        description: `Year-end close - ${account.code} ${account.name}`,
      };

      if (account.type === 'REVENUE') {
        if (balance > 0) line.debitAmount = balance;
        else line.creditAmount = Math.abs(balance);
      } else {
        if (balance > 0) line.creditAmount = balance;
        else line.debitAmount = Math.abs(balance);
      }
      closingLines.push(line);
    }

    return {
      accounts,
      closingLines,
      revenue,
      expenses,
      netIncome: revenue - expenses,
    };
  }

  async preview(req: any, year: number, retainedEarningsAccountId: string) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant is required');
    if (!Number.isInteger(year)) throw new BadRequestException('Invalid fiscal year');

    const retained = await this.validateRetainedEarnings(
      prisma,
      tenantId,
      retainedEarningsAccountId,
    );
    const range = await this.loadPeriods(prisma, tenantId, year);
    const latest = await prisma.yearEndClose.findFirst({
      where: { tenantId, year },
      orderBy: { version: 'desc' },
      include: {
        closingJournal: { select: { id: true, entryNumber: true, status: true } },
        reversalJournal: { select: { id: true, entryNumber: true, status: true } },
      },
    });

    const calculated = await this.calculate(
      prisma,
      tenantId,
      range.startDate,
      range.endDate,
    );

    return {
      year,
      startDate: range.startDate,
      endDate: range.endDate,
      periods: range.periods,
      retainedEarningsAccount: retained,
      latestClose: latest,
      revenue: calculated.revenue,
      expenses: calculated.expenses,
      netIncome: calculated.netIncome,
      closingLines: calculated.closingLines,
      canClose:
        !latest ||
        latest.status === 'REVERSED',
    };
  }

  async close(req: any, dto: any) {
    const tenantId = this.assertAdmin(req);
    const year = Number(dto.year);
    if (!Number.isInteger(year)) throw new BadRequestException('Invalid fiscal year');

    return prisma.$transaction(async (tx) => {
      const activeClose = await tx.yearEndClose.findFirst({
        where: { tenantId, year, status: 'CLOSED' },
        select: { id: true, version: true },
      });
      if (activeClose) {
        throw new ConflictException(
          `Fiscal year ${year} is already closed at version ${activeClose.version}`,
        );
      }

      const range = await this.assertCloseReadiness(tx, tenantId, year);
      const retained = await this.validateRetainedEarnings(
        tx,
        tenantId,
        dto.retainedEarningsAccountId,
      );
      const calculated = await this.calculate(
        tx,
        tenantId,
        range.startDate,
        range.endDate,
      );
      const previous = await tx.yearEndClose.findFirst({
        where: { tenantId, year },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      const version = (previous?.version || 0) + 1;

      const lines: any[] = calculated.closingLines.map((line) => ({
        accountId: line.accountId,
        ...(line.debitAmount ? { debitAmount: line.debitAmount } : {}),
        ...(line.creditAmount ? { creditAmount: line.creditAmount } : {}),
        description: line.description,
      }));

      if (Math.abs(calculated.netIncome) >= 0.005) {
        lines.push(
          calculated.netIncome > 0
            ? {
                accountId: retained.id,
                creditAmount: calculated.netIncome,
                description: `Retained earnings - fiscal year ${year}`,
              }
            : {
                accountId: retained.id,
                debitAmount: Math.abs(calculated.netIncome),
                description: `Retained earnings - fiscal year ${year}`,
              },
        );
      }

      let closingJournal: any = null;
      if (lines.length > 0) {
        closingJournal = await this.dualWrite.postInTransaction(tx, {
          tenantId,
          entryNumber: `YE-CLOSE-${year}-V${version}`,
          date: range.endDate,
          description: `Year-end close for fiscal year ${year} (version ${version})`,
          reference: `YEAR-END-${year}`,
          type: JournalType.CLOSING,
          sourceType: 'YEAR_END_CLOSE',
          sourceId: `${year}:v${version}`,
          lines,
        });
      }

      const record = await tx.yearEndClose.create({
        data: {
          tenantId,
          year,
          version,
          startDate: range.startDate,
          endDate: range.endDate,
          retainedEarningsAccountId: retained.id,
          netIncome: calculated.netIncome,
          status: 'CLOSED',
          closingJournalId: closingJournal?.id || null,
          closedBy: req.user?.id || req.user?.email || null,
        },
      });

      await tx.financialPeriod.update({
        where: { id: range.final.id },
        data: { isClosed: true, closedAt: new Date() },
      });

      return {
        record,
        closingJournal,
        revenue: calculated.revenue,
        expenses: calculated.expenses,
        netIncome: calculated.netIncome,
      };
    });
  }

  async reverse(req: any, year: number) {
    const tenantId = this.assertAdmin(req);
    if (!Number.isInteger(year)) throw new BadRequestException('Invalid fiscal year');

    return prisma.$transaction(async (tx) => {
      const record = await tx.yearEndClose.findFirst({
        where: { tenantId, year, status: 'CLOSED' },
        orderBy: { version: 'desc' },
      });
      if (!record) {
        throw new NotFoundException(`No active year-end close found for ${year}`);
      }

      const laterClose = await tx.yearEndClose.findFirst({
        where: {
          tenantId,
          year: { gt: year },
          status: 'CLOSED',
        },
        select: { id: true, year: true },
      });
      if (laterClose) {
        throw new ConflictException(
          `Cannot reverse ${year} while later fiscal year ${laterClose.year} is closed`,
        );
      }

      const range = await this.loadPeriods(tx, tenantId, year);
      await tx.financialPeriod.update({
        where: { id: range.final.id },
        data: { isClosed: false, closedAt: null },
      });

      let reversalJournal: any = null;
      if (record.closingJournalId) {
        const closing = await tx.journalEntryHeader.findFirst({
          where: {
            id: record.closingJournalId,
            tenantId,
            type: 'CLOSING',
            sourceType: 'YEAR_END_CLOSE',
          },
          include: { lines: true },
        });
        if (!closing) {
          throw new ConflictException('Year-end closing journal is missing or invalid');
        }

        reversalJournal = await this.dualWrite.postInTransaction(tx, {
          tenantId,
          entryNumber: `YE-REV-${year}-V${record.version}`,
          date: range.endDate,
          description: `Reverse year-end close for fiscal year ${year} (version ${record.version})`,
          reference: closing.entryNumber,
          type: JournalType.REVERSING,
          sourceType: 'YEAR_END_REVERSAL',
          sourceId: `${year}:v${record.version}`,
          lines: closing.lines.map((line) => ({
            accountId: line.accountId,
            debitAmount: line.creditAmount,
            creditAmount: line.debitAmount,
            description: `Reverse: ${line.description || closing.description}`,
            costCenterId: line.costCenterId || undefined,
            projectId: line.projectId || undefined,
            branchId: line.branchId || undefined,
          })),
        });

        await tx.journalEntryHeader.update({
          where: { id: closing.id },
          data: { status: 'REVERSED' },
        });
      }

      const updated = await tx.yearEndClose.update({
        where: { id: record.id },
        data: {
          status: 'REVERSED',
          reversalJournalId: reversalJournal?.id || null,
          reversedAt: new Date(),
          reversedBy: req.user?.id || req.user?.email || null,
        },
      });

      return { record: updated, reversalJournal };
    });
  }

  async list(req: any, year?: number) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant is required');
    return prisma.yearEndClose.findMany({
      where: { tenantId, ...(year ? { year } : {}) },
      include: {
        retainedEarningsAccount: {
          select: { id: true, code: true, name: true },
        },
        closingJournal: {
          select: { id: true, entryNumber: true, status: true },
        },
        reversalJournal: {
          select: { id: true, entryNumber: true, status: true },
        },
      },
      orderBy: [{ year: 'desc' }, { version: 'desc' }],
    });
  }
}
