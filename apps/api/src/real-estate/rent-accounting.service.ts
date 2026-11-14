import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentMethod, Prisma, prisma } from '@scc/database';
import { AccountingDualWriteService } from '../accounting-core/accounting-dual-write.service';
import { AccountMappingService } from '../accounting-core/account-mapping.service';

@Injectable()
export class RentAccountingService {
  constructor(
    private readonly ledger: AccountingDualWriteService,
    private readonly mapping: AccountMappingService,
  ) {}

  // Explicit posting, never called implicitly when a lease is drafted or a payment is recorded.
  // Requires an accrued, due installment; financial policy/recognition remains tenant-controlled.
  async postAccrual(tenantId: string, paymentId: string) {
    return prisma.$transaction(async tx => {
      const rent = await tx.rentPayment.findFirst({
        where: { id: paymentId, tenantId },
        include: { contract: { select: { status: true } } },
      });
      if (!rent) throw new NotFoundException('Rent receivable not found');
      if (!['ACTIVE', 'EXPIRED', 'TERMINATED', 'RENEWED'].includes(rent.contract.status)) {
        throw new ConflictException('Cannot accrue a draft contract');
      }
      if (rent.dueDate > new Date()) throw new ConflictException('Future-dated rent cannot be accrued yet');
      const sourceType = 'RENT_RECEIVABLE';
      const existing = await tx.journalEntryHeader.findFirst({
        where: { tenantId, sourceType, sourceId: paymentId }, include: { lines: true },
      });
      if (existing) return existing;
      const accounts = await this.mapping.resolveInTransaction(tx, tenantId, [
        'ACCOUNTS_RECEIVABLE', 'RENT_REVENUE',
      ]);
      if (accounts.ACCOUNTS_RECEIVABLE.type !== 'ASSET' || accounts.RENT_REVENUE.type !== 'REVENUE') {
        throw new BadRequestException('Rent accounting mapping must use ASSET and REVENUE accounts');
      }
      return this.ledger.postInTransaction(tx, {
        tenantId,
        entryNumber: `RENT-AR-${paymentId}`,
        date: rent.dueDate,
        description: `Rent receivable ${paymentId}`,
        sourceType, sourceId: paymentId,
        transactionCurrency: 'SAR',
        lines: [
          { accountId: accounts.ACCOUNTS_RECEIVABLE.id, debitAmount: rent.amount },
          { accountId: accounts.RENT_REVENUE.id, creditAmount: rent.amount },
        ],
      });
    }, { isolationLevel: 'Serializable' });
  }

  async postCollection(tenantId: string, collectionId: string) {
    return prisma.$transaction(async tx => {
      const receipt = await tx.rentCollection.findFirst({
        where: { id: collectionId, tenantId },
        include: { rentPayment: { select: { id: true } } },
      });
      if (!receipt) throw new NotFoundException('Rent collection not found');
      const sourceType = 'RENT_COLLECTION';
      const existing = await tx.journalEntryHeader.findFirst({
        where: { tenantId, sourceType, sourceId: collectionId }, include: { lines: true },
      });
      if (existing) return existing;
      const accrued = await tx.journalEntryHeader.findFirst({
        where: {
          tenantId, sourceType: 'RENT_RECEIVABLE',
          sourceId: receipt.rentPaymentId, status: 'POSTED',
        },
      });
      if (!accrued) throw new ConflictException('Post the rent receivable accrual before collection');
      const method = receipt.paymentMethod as PaymentMethod | null;
      if (!method || !Object.values(PaymentMethod).includes(method)) {
        throw new BadRequestException('A mapped collection payment method is required');
      }
      const [receivable] = await Promise.all([
        this.mapping.resolveInTransaction(tx, tenantId, ['ACCOUNTS_RECEIVABLE']),
      ]);
      const cashAccount = await this.mapping.resolvePaymentAccountInTransaction(tx, tenantId, method);
      if (cashAccount.type !== 'ASSET' || receivable.ACCOUNTS_RECEIVABLE.type !== 'ASSET') {
        throw new BadRequestException('Both receipt payment account and receivable must be assets');
      }
      return this.ledger.postInTransaction(tx, {
        tenantId,
        entryNumber: `RENT-RC-${collectionId}`,
        date: receipt.collectedAt,
        description: `Rent collection ${collectionId}`,
        sourceType, sourceId: collectionId,
        transactionCurrency: 'SAR',
        lines: [
          { accountId: cashAccount.id, debitAmount: receipt.amount },
          { accountId: receivable.ACCOUNTS_RECEIVABLE.id, creditAmount: receipt.amount },
        ],
      });
    }, { isolationLevel: 'Serializable' });
  }
}
