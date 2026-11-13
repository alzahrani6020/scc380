import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { JournalStatus, JournalType, Prisma, prisma } from '@scc/database';

export type PostingLine = {
  accountId: string;
  debitAmount?: Prisma.Decimal.Value;
  creditAmount?: Prisma.Decimal.Value;
  description?: string;
  costCenterId?: string;
  projectId?: string;
  branchId?: string;
  foreignDebitAmount?: Prisma.Decimal.Value;
  foreignCreditAmount?: Prisma.Decimal.Value;
};

export type PostJournalInput = {
  tenantId: string;
  entryNumber: string;
  date?: Date;
  description: string;
  reference?: string;
  type?: JournalType;
  sourceType?: string;
  sourceId?: string;
  transactionCurrency?: string;
  exchangeRate?: Prisma.Decimal.Value;
  lines: PostingLine[];
};

@Injectable()
export class AccountingPostingService {
  private decimal(value: Prisma.Decimal.Value | undefined) {
    return new Prisma.Decimal(value ?? 0);
  }

  private validateBalancedLines(lines: PostingLine[]) {
    if (!Array.isArray(lines) || lines.length < 2) {
      throw new BadRequestException('A journal entry requires at least two lines');
    }

    let debitTotal = new Prisma.Decimal(0);
    let creditTotal = new Prisma.Decimal(0);

    lines.forEach((line, index) => {
      const debit = this.decimal(line.debitAmount);
      const credit = this.decimal(line.creditAmount);

      if (debit.isNegative() || credit.isNegative()) {
        throw new BadRequestException(`Line ${index + 1}: debit and credit cannot be negative`);
      }
      const debitPositive = debit.gt(0);
      const creditPositive = credit.gt(0);
      if (debitPositive === creditPositive) {
        throw new BadRequestException(`Line ${index + 1}: exactly one side must be positive`);
      }

      debitTotal = debitTotal.add(debit);
      creditTotal = creditTotal.add(credit);
    });

    if (!debitTotal.equals(creditTotal)) {
      throw new BadRequestException(
        `Journal is not balanced: debit=${debitTotal.toFixed(2)} credit=${creditTotal.toFixed(2)}`,
      );
    }

    return { debitTotal, creditTotal };
  }

  private async assertPeriodOpen(tx: Prisma.TransactionClient, tenantId: string, date: Date) {
    const closed = await tx.financialPeriod.findFirst({
      where: {
        tenantId,
        isClosed: true,
        startDate: { lte: date },
        endDate: { gte: date },
      },
      select: { id: true, name: true },
    });
    if (closed) throw new ConflictException(`Financial period "${closed.name}" is closed`);
  }

  private async assertVatPeriodOpen(
    tx: Prisma.TransactionClient,
    tenantId: string,
    date: Date,
    lines: PostingLine[],
    sourceType?: string,
  ) {
    if (sourceType === 'VAT_SETTLEMENT' || sourceType === 'VAT_SETTLEMENT_REVERSAL') return;

    const locked = await tx.vatReturn.findFirst({
      where: {
        tenantId,
        status: { in: ['FILED', 'SETTLED'] },
        periodStart: { lte: date },
        periodEnd: { gte: date },
      },
      select: { id: true, periodStart: true, periodEnd: true, status: true },
    });
    if (!locked) return;

    const tenant = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    const settings =
      tenant?.settings && typeof tenant.settings === 'object' && !Array.isArray(tenant.settings)
        ? (tenant.settings as any)
        : {};
    const mapping =
      settings?.accounting?.accountMapping &&
      typeof settings.accounting.accountMapping === 'object'
        ? settings.accounting.accountMapping
        : {};

    const vatCodes = [
      String(mapping.VAT_PAYABLE || '2110'),
      String(mapping.VAT_RECEIVABLE || '1140'),
    ];
    const accountIds = [...new Set(lines.map(line => line.accountId))];
    const vatAccount = await tx.chartOfAccount.findFirst({
      where: {
        tenantId,
        id: { in: accountIds },
        code: { in: vatCodes },
      },
      select: { id: true, code: true },
    });

    if (vatAccount) {
      throw new ConflictException(
        `VAT period ${locked.periodStart.toISOString().slice(0, 10)} to ${locked.periodEnd
          .toISOString()
          .slice(0, 10)} is ${locked.status}; VAT-impacting backdated posting is blocked`,
      );
    }
  }

  private async assertDimensions(
    tx: Prisma.TransactionClient,
    tenantId: string,
    lines: PostingLine[],
  ) {
    const accountIds = [...new Set(lines.map(line => line.accountId))];
    const accounts = await tx.chartOfAccount.findMany({
      where: { tenantId, id: { in: accountIds }, isActive: true },
      select: { id: true },
    });
    if (accounts.length !== accountIds.length) {
      throw new BadRequestException('One or more journal accounts are missing, inactive, or outside tenant');
    }

    const checks: Array<[string[], (ids: string[]) => Promise<{ id: string }[]>]> = [
      [
        [...new Set(lines.map(line => line.costCenterId).filter((id): id is string => Boolean(id)))],
        ids => tx.costCenter.findMany({ where: { tenantId, id: { in: ids }, isActive: true }, select: { id: true } }),
      ],
      [
        [...new Set(lines.map(line => line.projectId).filter((id): id is string => Boolean(id)))],
        ids => tx.project.findMany({ where: { tenantId, id: { in: ids } }, select: { id: true } }),
      ],
      [
        [...new Set(lines.map(line => line.branchId).filter((id): id is string => Boolean(id)))],
        ids => tx.branch.findMany({ where: { tenantId, id: { in: ids }, isActive: true }, select: { id: true } }),
      ],
    ];

    for (const [ids, load] of checks) {
      if (ids.length === 0) continue;
      const found = await load(ids);
      if (found.length !== ids.length) {
        throw new BadRequestException('One or more accounting dimensions are outside tenant or inactive');
      }
    }
  }

  async postInTransaction(tx: Prisma.TransactionClient, input: PostJournalInput) {
    const date = input.date ?? new Date();
    if (!input.tenantId) throw new BadRequestException('Tenant is required');
    if (!input.entryNumber?.trim()) throw new BadRequestException('Entry number is required');
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Invalid journal date');

    this.validateBalancedLines(input.lines);
    await this.assertPeriodOpen(tx, input.tenantId, date);
    await this.assertVatPeriodOpen(tx, input.tenantId, date, input.lines, input.sourceType);
    await this.assertDimensions(tx, input.tenantId, input.lines);

    const duplicate = await tx.journalEntryHeader.findFirst({
      where: {
        tenantId: input.tenantId,
        OR: [
          { entryNumber: input.entryNumber },
          ...(input.sourceType && input.sourceId
            ? [{ sourceType: input.sourceType, sourceId: input.sourceId }]
            : []),
        ],
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException('Journal entry or posting source already exists');
    }

    return tx.journalEntryHeader.create({
      data: {
        tenantId: input.tenantId,
        entryNumber: input.entryNumber,
        date,
        description: input.description,
        reference: input.reference,
        type: input.type ?? JournalType.GENERAL,
        status: JournalStatus.POSTED,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        transactionCurrency: input.transactionCurrency,
        exchangeRate:
          input.exchangeRate === undefined ? undefined : this.decimal(input.exchangeRate),
        postedAt: new Date(),
        lines: {
          create: input.lines.map((line, index) => ({
            tenantId: input.tenantId,
            lineNumber: index + 1,
            accountId: line.accountId,
            debitAmount: this.decimal(line.debitAmount),
            creditAmount: this.decimal(line.creditAmount),
            description: line.description,
            costCenterId: line.costCenterId,
            projectId: line.projectId,
            branchId: line.branchId,
            foreignDebitAmount:
              line.foreignDebitAmount === undefined ? undefined : this.decimal(line.foreignDebitAmount),
            foreignCreditAmount:
              line.foreignCreditAmount === undefined ? undefined : this.decimal(line.foreignCreditAmount),
          })),
        },
      },
      include: { lines: true },
    });
  }

  async post(input: PostJournalInput) {
    return prisma.$transaction(tx => this.postInTransaction(tx, input));
  }
}
