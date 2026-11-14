import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma, withTenant } from '@scc/database';
import { PaymentStatus, Prisma } from '@prisma/client';

@Injectable()
export class RentPaymentsService {
  async findAll(tenantId: string, filters?: { contractId?: string; status?: string; overdue?: boolean; search?: string }) {
    const where = withTenant({}, tenantId);
    if (filters?.contractId) where.contractId = filters.contractId;
    if (filters?.status) where.status = filters.status;
    if (filters?.overdue) {
      where.status = 'PENDING';
      where.dueDate = { lt: new Date() };
    }
    if (filters?.search) {
      where.OR = [
        { transactionRef: { contains: filters.search, mode: 'insensitive' } },
        { contract: { lesseeName: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }
    const [data, count] = await Promise.all([
      prisma.rentPayment.findMany({
        where,
        orderBy: { dueDate: 'asc' },
        include: {
          contract: { select: { id: true, lesseeName: true, propertyId: true, unitId: true } },
          collections: { select: { amount: true } },
        },
      }),
      prisma.rentPayment.count({ where }),
    ]);
    return { data: data.map(payment => this.withCollectionBalance(payment)), count };
  }

  private withCollectionBalance<T extends { amount: Prisma.Decimal; status: PaymentStatus; collections: { amount: Prisma.Decimal }[] }>(payment: T) {
    const recorded = payment.collections.reduce((sum, item) => sum.plus(item.amount), new Prisma.Decimal(0));
    const collected = payment.status === PaymentStatus.COMPLETED && recorded.isZero() ? payment.amount : recorded;
    return {
      ...payment,
      collectedAmount: collected.toFixed(2),
      outstandingAmount: Prisma.Decimal.max(payment.amount.minus(collected), new Prisma.Decimal(0)).toFixed(2),
      collections: undefined,
    };
  }

  async findOne(tenantId: string, id: string) {
    const payment = await prisma.rentPayment.findFirst({
      where: withTenant({ id }, tenantId),
      include: { contract: true, collections: { select: { amount: true } } },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return this.withCollectionBalance(payment);
  }

  async collectionHistory(tenantId: string, id: string) {
    const receivable = await prisma.rentPayment.findFirst({
      where: withTenant({ id }, tenantId), select: { id: true, amount: true },
    });
    if (!receivable) throw new NotFoundException('Rent receivable not found');
    const rows = await prisma.rentCollection.findMany({
      where: { tenantId, rentPaymentId: id },
      orderBy: [{ collectedAt: 'asc' }, { createdAt: 'asc' }],
    });
    const posted = await prisma.journalEntryHeader.findMany({
      where: {
        tenantId, sourceType: 'RENT_COLLECTION',
        sourceId: { in: rows.map(row => row.id) }, status: 'POSTED',
      },
      select: { sourceId: true, id: true },
    });
    const journals = new Map(posted.map(row => [row.sourceId, row.id]));
    const accrued = await prisma.journalEntryHeader.findFirst({
      where: { tenantId, sourceType: 'RENT_RECEIVABLE', sourceId: id, status: 'POSTED' },
      select: { id: true },
    });
    return {
      accrualJournalId: accrued?.id ?? null,
      receivableId: id,
      faceAmount: receivable.amount.toFixed(2),
      count: rows.length,
      data: rows.map(row => ({
        ...row,
        accountingJournalId: journals.get(row.id) ?? null,
      })),
    };
  }

  async create(tenantId: string, dto: any) {
    const contract = await prisma.leaseContract.findFirst({
      where: withTenant({ id: dto.contractId }, tenantId),
      select: { propertyId: true, unitId: true },
    });
    if (!contract) throw new NotFoundException('Contract not found in this tenant');
    if (contract.propertyId !== dto.propertyId || contract.unitId !== dto.unitId) {
      throw new BadRequestException('Rent payment must match the contract property and unit');
    }
    if (dto.status && dto.status !== PaymentStatus.PENDING || dto.paidDate) {
      throw new BadRequestException('New rent receivables must start pending; use recordPayment for settlement');
    }
    if (!Number.isFinite(Number(dto.amount)) || Number(dto.amount) <= 0) {
      throw new BadRequestException('Rent receivable amount must be positive');
    }
    const data = { ...dto, tenantId, status: PaymentStatus.PENDING };
    if (dto.dueDate) data.dueDate = new Date(dto.dueDate);
    return prisma.rentPayment.create({ data });
  }

  async update(tenantId: string, id: string, dto: any) {
    const existing = await prisma.rentPayment.findFirst({ where: withTenant({ id }, tenantId) });
    if (!existing) throw new NotFoundException('Payment not found');
    if (existing.status !== PaymentStatus.PENDING) {
      throw new ConflictException('Settled rent receivables cannot be edited');
    }
    const immutable = ['contractId', 'propertyId', 'unitId', 'amount', 'status', 'paidDate', 'invoiceId', 'ejarPaymentRef'];
    if (immutable.some((key) => dto[key] !== undefined)) {
      throw new BadRequestException('Cannot edit rent receivable identity, amount or settlement state');
    }
    const data = { ...dto };
    if (dto.dueDate) data.dueDate = new Date(dto.dueDate);
    return prisma.rentPayment.update({ where: { id }, data });
  }

  async delete(tenantId: string, id: string) {
    const existing = await prisma.rentPayment.findFirst({ where: withTenant({ id }, tenantId) });
    if (!existing) throw new NotFoundException('Payment not found');
    throw new ConflictException('Rent receivables cannot be deleted without an auditable reversal workflow');
  }

  async recordPayment(
    tenantId: string, id: string,
    dto: { paidDate: string; amount: string; idempotencyKey: string; paymentMethod?: string; transactionRef?: string; bankReference?: string },
  ) {
    if (!dto.idempotencyKey || dto.idempotencyKey.length > 128 || !/^[A-Za-z0-9_-]+$/.test(dto.idempotencyKey)) {
      throw new BadRequestException('A stable idempotency key is required');
    }
    if (!/^\\d+(\\.\\d{1,2})?$/.test(dto.amount)) {
      throw new BadRequestException('Payment amount must have no more than two decimal places');
    }
    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lte(0)) throw new BadRequestException('Payment must be positive');
    const paidDate = new Date(dto.paidDate);
    if (Number.isNaN(paidDate.getTime())) throw new BadRequestException('Invalid paid date');

    return prisma.$transaction(async (tx) => {
      const existing = await tx.rentPayment.findFirst({ where: withTenant({ id }, tenantId) });
      if (!existing) throw new NotFoundException('Payment not found');

      const priorRequest = await tx.rentCollection.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: dto.idempotencyKey } },
      });
      if (priorRequest) {
        if (priorRequest.rentPaymentId !== id || !priorRequest.amount.equals(amount) || priorRequest.collectedAt.getTime() !== paidDate.getTime() || (priorRequest.paymentMethod ?? null) !== (dto.paymentMethod ?? null) || (priorRequest.transactionRef ?? null) !== (dto.transactionRef ?? null) || (priorRequest.bankReference ?? null) !== (dto.bankReference ?? null)) {
          throw new ConflictException('Idempotency key already belongs to a different payment');
        }
        // Retry of the same request is a read, never a second collection.
        return tx.rentPayment.findFirstOrThrow({ where: withTenant({ id }, tenantId) });
      }
      if (existing.status !== PaymentStatus.PENDING) {
        throw new ConflictException('Only pending rent receivables can be settled');
      }
      const collected = await tx.rentCollection.aggregate({
        where: { tenantId, rentPaymentId: id }, _sum: { amount: true },
      });
      const previous = collected._sum.amount ?? new Prisma.Decimal(0);
      const remaining = existing.amount.minus(previous);
      if (remaining.lte(0) || amount.gt(remaining)) {
        throw new ConflictException('Collection exceeds outstanding receivable');
      }
      await tx.rentCollection.create({
        data: {
          tenantId, rentPaymentId: id, amount, collectedAt: paidDate,
          idempotencyKey: dto.idempotencyKey, paymentMethod: dto.paymentMethod,
          transactionRef: dto.transactionRef, bankReference: dto.bankReference,
        },
      });
      const settled = amount.equals(remaining);
      if (settled) {
        const claimed = await tx.rentPayment.updateMany({
          where: withTenant({ id, status: PaymentStatus.PENDING }, tenantId),
          data: {
            status: PaymentStatus.COMPLETED, paidDate,
            paymentMethod: dto.paymentMethod, transactionRef: dto.transactionRef,
            bankReference: dto.bankReference,
          },
        });
        if (claimed.count !== 1) throw new ConflictException('Receivable was settled concurrently');
      }
      return tx.rentPayment.findFirstOrThrow({ where: withTenant({ id }, tenantId) });
    }, { isolationLevel: 'Serializable' });
  }

  async collectionSummary(tenantId: string) {
    const now = new Date();
    const pending = withTenant({ status: PaymentStatus.PENDING }, tenantId);
    const completed = withTenant({ status: PaymentStatus.COMPLETED }, tenantId);
    const overdue = withTenant({ status: PaymentStatus.PENDING, dueDate: { lt: now } }, tenantId);
    const [pendingFace, completedFace, overdueFace, pendingCollected, overdueCollected,
      pendingCount, completedCount, overdueCount] = await Promise.all([
      prisma.rentPayment.aggregate({ where: pending, _sum: { amount: true } }),
      prisma.rentPayment.aggregate({ where: completed, _sum: { amount: true } }),
      prisma.rentPayment.aggregate({ where: overdue, _sum: { amount: true } }),
      prisma.rentCollection.aggregate({
        where: { tenantId, rentPayment: { status: PaymentStatus.PENDING } }, _sum: { amount: true },
      }),
      prisma.rentCollection.aggregate({
        where: { tenantId, rentPayment: { status: PaymentStatus.PENDING, dueDate: { lt: now } } },
        _sum: { amount: true },
      }),
      prisma.rentPayment.count({ where: pending }),
      prisma.rentPayment.count({ where: completed }),
      prisma.rentPayment.count({ where: overdue }),
    ]);
    const partial = pendingCollected._sum.amount ?? new Prisma.Decimal(0);
    const partialOverdue = overdueCollected._sum.amount ?? new Prisma.Decimal(0);
    return {
      asOf: now.toISOString(), currency: 'SAR',
      pendingAmount: (pendingFace._sum.amount ?? new Prisma.Decimal(0)).minus(partial).toFixed(2),
      completedAmount: (completedFace._sum.amount ?? new Prisma.Decimal(0)).plus(partial).toFixed(2),
      overdueAmount: (overdueFace._sum.amount ?? new Prisma.Decimal(0)).minus(partialOverdue).toFixed(2),
      pendingCount, completedCount, overdueCount,
      // Legacy COMPLETED receivables without ledger rows remain counted as fully collected.
    };
  }

  async overdueReport(tenantId: string) {
    const where = withTenant({ status: PaymentStatus.PENDING, dueDate: { lt: new Date() } }, tenantId);
    const data = await prisma.rentPayment.findMany({
      where, orderBy: { dueDate: 'asc' },
      include: {
        contract: { select: { lesseeName: true, propertyId: true, unitId: true } },
        collections: { select: { amount: true } },
      },
    });
    const rows = data.map(payment => this.withCollectionBalance(payment));
    const outstanding = rows.reduce(
      (sum, payment) => sum.plus(payment.outstandingAmount), new Prisma.Decimal(0),
    );
    return { data: rows, count: rows.length, totalOverdue: outstanding.toFixed(2) };
  }
}
