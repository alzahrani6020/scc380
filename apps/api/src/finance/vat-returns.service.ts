import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JournalType, Prisma, VatReturnStatus, prisma } from '@scc/database';
import { AccountMappingService } from '../accounting-core/account-mapping.service';
import { AccountingPostingService } from '../accounting-core/accounting-posting.service';
import { VatLedgerService } from '../accounting-core/vat-ledger.service';

type VatSnapshot = {
  outputVat: Prisma.Decimal;
  inputVat: Prisma.Decimal;
  netVat: Prisma.Decimal;
};

@Injectable()
export class VatReturnsService {
  constructor(
    private readonly accountMapping: AccountMappingService,
    private readonly posting: AccountingPostingService,
    private readonly vatLedger: VatLedgerService,
  ) {}

  private date(value: string | Date, label: string) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid ${label}`);
    }
    return date;
  }

  private async requireTenant(tenantId: string) {
    if (!tenantId) throw new BadRequestException('Tenant is required');
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        baseCurrency: true,
        vatSettlementPayableAccountId: true,
        vatSettlementReceivableAccountId: true,
      },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async list(tenantId: string) {
    await this.requireTenant(tenantId);
    return prisma.vatReturn.findMany({
      where: { tenantId },
      orderBy: [{ periodStart: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async get(tenantId: string, id: string) {
    const item = await prisma.vatReturn.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('VAT return not found');
    return item;
  }

  async create(tenantId: string, input: { periodStart: string; periodEnd: string }) {
    await this.requireTenant(tenantId);
    const periodStart = this.date(input.periodStart, 'periodStart');
    const periodEnd = this.date(input.periodEnd, 'periodEnd');
    periodStart.setUTCHours(0, 0, 0, 0);
    periodEnd.setUTCHours(23, 59, 59, 999);
    if (periodEnd < periodStart) {
      throw new BadRequestException('VAT period end must be on or after start');
    }

    const overlap = await prisma.vatReturn.findFirst({
      where: {
        tenantId,
        periodStart: { lte: periodEnd },
        periodEnd: { gte: periodStart },
      },
      select: { id: true, periodStart: true, periodEnd: true, status: true },
    });
    if (overlap) {
      throw new ConflictException('VAT period overlaps an existing return');
    }

    return prisma.vatReturn.create({
      data: {
        tenantId,
        periodStart,
        periodEnd,
      },
    });
  }

  async removeDraft(tenantId: string, id: string) {
    const item = await this.get(tenantId, id);
    if (item.status !== VatReturnStatus.DRAFT) {
      throw new ConflictException('Only DRAFT VAT returns can be deleted');
    }
    await prisma.vatReturn.delete({ where: { id } });
    return { deleted: true };
  }

  async getSettlementConfig(tenantId: string) {
    const tenant = await this.requireTenant(tenantId);
    return {
      baseCurrency: tenant.baseCurrency,
      vatSettlementPayableAccountId: tenant.vatSettlementPayableAccountId,
      vatSettlementReceivableAccountId: tenant.vatSettlementReceivableAccountId,
    };
  }

  async setSettlementConfig(
    tenantId: string,
    payableAccountId: string | null | undefined,
    receivableAccountId: string | null | undefined,
  ) {
    await this.requireTenant(tenantId);
    if (!payableAccountId || !receivableAccountId || payableAccountId === receivableAccountId) {
      throw new BadRequestException('Distinct VAT payable and receivable settlement accounts are required');
    }

    const accounts = await prisma.chartOfAccount.findMany({
      where: {
        tenantId,
        id: { in: [payableAccountId, receivableAccountId] },
        isActive: true,
      },
      select: { id: true, type: true, code: true, name: true },
    });
    const payable = accounts.find(account => account.id === payableAccountId);
    const receivable = accounts.find(account => account.id === receivableAccountId);
    if (!payable || payable.type !== 'LIABILITY') {
      throw new BadRequestException('VAT settlement payable account must be an active LIABILITY account');
    }
    if (!receivable || receivable.type !== 'ASSET') {
      throw new BadRequestException('VAT settlement receivable account must be an active ASSET account');
    }

    return prisma.tenant.update({
      where: { id: tenantId },
      data: {
        vatSettlementPayableAccountId: payableAccountId,
        vatSettlementReceivableAccountId: receivableAccountId,
      },
      select: {
        id: true,
        baseCurrency: true,
        vatSettlementPayableAccountId: true,
        vatSettlementReceivableAccountId: true,
      },
    });
  }


  async preview(tenantId: string, id: string) {
    const item = await this.get(tenantId, id);
    if (item.status !== VatReturnStatus.DRAFT) {
      return {
        ...item,
        snapshotLocked: true,
      };
    }
    const snapshot = await prisma.$transaction(tx =>
      this.vatLedger.snapshot(tx, tenantId, item.periodStart, item.periodEnd),
    );
    return {
      ...item,
      outputVat: snapshot.outputVat,
      inputVat: snapshot.inputVat,
      netVat: snapshot.netVat,
      snapshotLocked: false,
    };
  }

  async file(tenantId: string, id: string, userId?: string) {
    return prisma.$transaction(async tx => {
      const item = await tx.vatReturn.findFirst({ where: { id, tenantId } });
      if (!item) throw new NotFoundException('VAT return not found');
      if (item.status !== VatReturnStatus.DRAFT) {
        throw new ConflictException('Only DRAFT VAT returns can be filed');
      }

      const laterSettled = await tx.vatReturn.findFirst({
        where: {
          tenantId,
          status: VatReturnStatus.SETTLED,
          periodStart: { gt: item.periodStart },
        },
        select: { id: true },
      });
      if (laterSettled) {
        throw new ConflictException('Cannot file an earlier VAT return after a later settled return');
      }

      const snapshot = await this.vatLedger.snapshot(
        tx,
        tenantId,
        item.periodStart,
        item.periodEnd,
      );

      return tx.vatReturn.update({
        where: { id },
        data: {
          status: VatReturnStatus.FILED,
          outputVat: snapshot.outputVat,
          inputVat: snapshot.inputVat,
          netVat: snapshot.netVat,
          filedAt: new Date(),
          filedBy: userId || null,
        },
      });
    });
  }

  async settle(tenantId: string, id: string, userId?: string) {
    return prisma.$transaction(async tx => {
      const item = await tx.vatReturn.findFirst({ where: { id, tenantId } });
      if (!item) throw new NotFoundException('VAT return not found');
      if (item.status !== VatReturnStatus.FILED) {
        throw new ConflictException('Only FILED VAT returns can be settled');
      }
      if (item.outputVat === null || item.inputVat === null || item.netVat === null) {
        throw new ConflictException('Filed VAT return snapshot is incomplete');
      }

      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: {
          baseCurrency: true,
          vatSettlementPayableAccountId: true,
          vatSettlementReceivableAccountId: true,
        },
      });
      if (!tenant) throw new NotFoundException('Tenant not found');

      const vatAccounts = await this.accountMapping.resolveInTransaction(
        tx,
        tenantId,
        ['VAT_PAYABLE', 'VAT_RECEIVABLE'],
      );

      const outputVat = new Prisma.Decimal(item.outputVat);
      const inputVat = new Prisma.Decimal(item.inputVat);
      const netVat = new Prisma.Decimal(item.netVat);
      const version = item.settlementVersion + 1;
      let journalId: string | null = null;

      if (!outputVat.isZero() || !inputVat.isZero()) {
        const lines: any[] = [];
        if (outputVat.gt(0)) {
          lines.push({
            accountId: vatAccounts.VAT_PAYABLE.id,
            debitAmount: outputVat,
            description: 'VAT output cleared on filing settlement',
          });
        } else if (outputVat.lt(0)) {
          lines.push({
            accountId: vatAccounts.VAT_PAYABLE.id,
            creditAmount: outputVat.abs(),
            description: 'VAT output adjustment on filing settlement',
          });
        }

        if (inputVat.gt(0)) {
          lines.push({
            accountId: vatAccounts.VAT_RECEIVABLE.id,
            creditAmount: inputVat,
            description: 'VAT input cleared on filing settlement',
          });
        } else if (inputVat.lt(0)) {
          lines.push({
            accountId: vatAccounts.VAT_RECEIVABLE.id,
            debitAmount: inputVat.abs(),
            description: 'VAT input adjustment on filing settlement',
          });
        }

        if (netVat.gt(0)) {
          if (!tenant.vatSettlementPayableAccountId) {
            throw new BadRequestException('VAT settlement payable account is not configured');
          }
          const account = await tx.chartOfAccount.findFirst({
            where: {
              id: tenant.vatSettlementPayableAccountId,
              tenantId,
              type: 'LIABILITY',
              isActive: true,
            },
            select: { id: true },
          });
          if (!account) throw new BadRequestException('Configured VAT settlement payable account is invalid');
          lines.push({
            accountId: account.id,
            creditAmount: netVat,
            description: 'VAT payable after filing',
          });
        } else if (netVat.lt(0)) {
          if (!tenant.vatSettlementReceivableAccountId) {
            throw new BadRequestException('VAT settlement receivable account is not configured');
          }
          const account = await tx.chartOfAccount.findFirst({
            where: {
              id: tenant.vatSettlementReceivableAccountId,
              tenantId,
              type: 'ASSET',
              isActive: true,
            },
            select: { id: true },
          });
          if (!account) throw new BadRequestException('Configured VAT settlement receivable account is invalid');
          lines.push({
            accountId: account.id,
            debitAmount: netVat.abs(),
            description: 'VAT receivable after filing',
          });
        }

        const debit = lines.reduce(
          (sum, line) => sum.add(new Prisma.Decimal(line.debitAmount || 0)),
          new Prisma.Decimal(0),
        );
        const credit = lines.reduce(
          (sum, line) => sum.add(new Prisma.Decimal(line.creditAmount || 0)),
          new Prisma.Decimal(0),
        );
        if (!debit.equals(credit)) {
          throw new BadRequestException(
            `VAT settlement is not balanced: debit=${debit.toFixed(2)} credit=${credit.toFixed(2)}`,
          );
        }

        if (lines.length >= 2) {
          const journal = await this.posting.postInTransaction(tx, {
            tenantId,
            entryNumber: `VAT-SET-${item.id}-V${version}`,
            date: item.periodEnd,
            description: `VAT return settlement ${item.periodStart.toISOString().slice(0, 10)} to ${item.periodEnd.toISOString().slice(0, 10)}`,
            reference: `VAT-RETURN-${item.id}`,
            type: JournalType.ADJUSTING,
            sourceType: 'VAT_SETTLEMENT',
            sourceId: `${item.id}:v${version}`,
            transactionCurrency: tenant.baseCurrency,
            exchangeRate: 1,
            lines,
          });
          journalId = journal.id;
        }
      }

      return tx.vatReturn.update({
        where: { id },
        data: {
          status: VatReturnStatus.SETTLED,
          settlementVersion: version,
          settlementJournalId: journalId,
          settledAt: new Date(),
          settledBy: userId || null,
          reversalJournalId: null,
          reversedAt: null,
          reversedBy: null,
        },
      });
    });
  }

  async reverseSettlement(
    tenantId: string,
    id: string,
    userId?: string,
    role?: string,
  ) {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(String(role || ''))) {
      throw new ConflictException('Only ADMIN or SUPER_ADMIN can reverse a VAT settlement');
    }
    return prisma.$transaction(async tx => {
      const item = await tx.vatReturn.findFirst({ where: { id, tenantId } });
      if (!item) throw new NotFoundException('VAT return not found');
      if (item.status !== VatReturnStatus.SETTLED) {
        throw new ConflictException('Only SETTLED VAT returns can be reversed');
      }

      const laterSettled = await tx.vatReturn.findFirst({
        where: {
          tenantId,
          id: { not: id },
          status: VatReturnStatus.SETTLED,
          periodStart: { gt: item.periodStart },
        },
        select: { id: true },
      });
      if (laterSettled) {
        throw new ConflictException('Reverse later VAT settlements first');
      }

      let reversalJournalId: string | null = null;
      if (item.settlementJournalId) {
        const journal = await tx.journalEntryHeader.findFirst({
          where: { id: item.settlementJournalId, tenantId, status: 'POSTED' },
          include: { lines: true },
        });
        if (!journal) throw new ConflictException('VAT settlement journal not found');

        const reversal = await this.posting.postInTransaction(tx, {
          tenantId,
          entryNumber: `VAT-REV-${item.id}-V${item.settlementVersion}`,
          date: new Date(),
          description: `Reverse VAT settlement for return ${item.id}`,
          reference: `VAT-RETURN-${item.id}`,
          type: JournalType.REVERSING,
          sourceType: 'VAT_SETTLEMENT_REVERSAL',
          sourceId: `${item.id}:v${item.settlementVersion}`,
          lines: journal.lines.map(line => ({
            accountId: line.accountId,
            debitAmount: line.creditAmount,
            creditAmount: line.debitAmount,
            description: `Reversal: ${line.description || journal.description}`,
            costCenterId: line.costCenterId || undefined,
            projectId: line.projectId || undefined,
            branchId: line.branchId || undefined,
          })),
        });
        reversalJournalId = reversal.id;
      }

      return tx.vatReturn.update({
        where: { id },
        data: {
          status: VatReturnStatus.FILED,
          reversalJournalId,
          reversedAt: new Date(),
          reversedBy: userId || null,
          settledAt: null,
          settledBy: null,
          settlementJournalId: null,
        },
      });
    });
  }
}
