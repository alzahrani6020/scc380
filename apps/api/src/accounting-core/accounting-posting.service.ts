import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { JournalStatus, JournalType, Prisma, prisma } from '@scc/database';

type PostingLine = {
  accountId: string;
  debitAmount?: Prisma.Decimal.Value;
  creditAmount?: Prisma.Decimal.Value;
  description?: string;
  costCenterId?: string;
  projectId?: string;
  branchId?: string;
};

type PostJournalInput = {
  tenantId: string;
  entryNumber: string;
  date?: Date;
  description: string;
  reference?: string;
  type?: JournalType;
  sourceType?: string;
  sourceId?: string;
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
