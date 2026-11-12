import { Injectable } from '@nestjs/common';
import { JournalStatus, JournalType, Prisma, prisma } from '@scc/database';
import { AccountingPostingService, PostJournalInput } from './accounting-posting.service';

@Injectable()
export class AccountingDualWriteService {
  constructor(private readonly posting: AccountingPostingService) {}

  async postInTransaction(tx: Prisma.TransactionClient, input: PostJournalInput) {
    const date = input.date ?? new Date();
    const header = await this.posting.postInTransaction(tx, input);

    await tx.journalEntry.createMany({
      data: input.lines.map((line, index) => ({
        tenantId: input.tenantId,
        entryNumber: `LEG-${input.tenantId}-${input.entryNumber}-L${index + 1}`,
        date,
        description: line.description || input.description,
        reference: input.reference,
        debitAmount: new Prisma.Decimal(line.debitAmount ?? 0),
        creditAmount: new Prisma.Decimal(line.creditAmount ?? 0),
        accountId: line.accountId,
        type: input.type ?? JournalType.GENERAL,
        status: JournalStatus.POSTED,
      })),
    });

    return header;
  }

  async post(input: PostJournalInput) {
    return prisma.$transaction(tx => this.postInTransaction(tx, input));
  }
}
