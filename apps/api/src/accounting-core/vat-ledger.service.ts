import { Injectable } from '@nestjs/common';
import { Prisma } from '@scc/database';
import { AccountMappingService } from './account-mapping.service';

export type VatLedgerSnapshot = {
  outputVat: Prisma.Decimal;
  inputVat: Prisma.Decimal;
  netVat: Prisma.Decimal;
};

@Injectable()
export class VatLedgerService {
  constructor(private readonly accountMapping: AccountMappingService) {}

  async snapshot(
    tx: Prisma.TransactionClient,
    tenantId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<VatLedgerSnapshot> {
    const accounts = await this.accountMapping.resolveInTransaction(
      tx,
      tenantId,
      ['VAT_PAYABLE', 'VAT_RECEIVABLE'],
    );
    const accountIds = [accounts.VAT_PAYABLE.id, accounts.VAT_RECEIVABLE.id];

    const [modern, legacy] = await Promise.all([
      tx.journalEntryLine.groupBy({
        by: ['accountId'],
        where: {
          tenantId,
          accountId: { in: accountIds },
          journalEntry: {
            status: 'POSTED',
            date: { gte: periodStart, lte: periodEnd },
            OR: [
              { sourceType: null },
              { sourceType: { notIn: ['VAT_SETTLEMENT', 'VAT_SETTLEMENT_REVERSAL'] } },
            ],
          },
        },
        _sum: { debitAmount: true, creditAmount: true },
      }),
      tx.journalEntry.groupBy({
        by: ['accountId'],
        where: {
          tenantId,
          accountId: { in: accountIds },
          status: 'POSTED',
          date: { gte: periodStart, lte: periodEnd },
          NOT: { entryNumber: { startsWith: 'LEG-' } },
        },
        _sum: { debitAmount: true, creditAmount: true },
      }),
    ]);

    const totals = new Map<string, { debit: Prisma.Decimal; credit: Prisma.Decimal }>();
    const add = (accountId: string | null, debit: unknown, credit: unknown) => {
      if (!accountId) return;
      const current = totals.get(accountId) || {
        debit: new Prisma.Decimal(0),
        credit: new Prisma.Decimal(0),
      };
      current.debit = current.debit.add(new Prisma.Decimal((debit as any) || 0));
      current.credit = current.credit.add(new Prisma.Decimal((credit as any) || 0));
      totals.set(accountId, current);
    };

    for (const row of modern) add(row.accountId, row._sum.debitAmount, row._sum.creditAmount);
    for (const row of legacy) add(row.accountId, row._sum.debitAmount, row._sum.creditAmount);

    const output = totals.get(accounts.VAT_PAYABLE.id) || {
      debit: new Prisma.Decimal(0),
      credit: new Prisma.Decimal(0),
    };
    const input = totals.get(accounts.VAT_RECEIVABLE.id) || {
      debit: new Prisma.Decimal(0),
      credit: new Prisma.Decimal(0),
    };

    const outputVat = output.credit.sub(output.debit).toDecimalPlaces(2);
    const inputVat = input.debit.sub(input.credit).toDecimalPlaces(2);
    const netVat = outputVat.sub(inputVat).toDecimalPlaces(2);

    return { outputVat, inputVat, netVat };
  }
}
