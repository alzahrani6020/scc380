import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma, withTenant } from '@scc/database';
import { PaymentStatus } from '@prisma/client';

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
        },
      }),
      prisma.rentPayment.count({ where }),
    ]);
    return { data, count };
  }

  async findOne(tenantId: string, id: string) {
    const payment = await prisma.rentPayment.findFirst({
      where: withTenant({ id }, tenantId),
      include: { contract: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  async create(tenantId: string, dto: any) {
    const data = { ...dto, tenantId };
    if (dto.dueDate) data.dueDate = new Date(dto.dueDate);
    if (dto.paidDate) data.paidDate = new Date(dto.paidDate);
    return prisma.rentPayment.create({ data });
  }

  async update(tenantId: string, id: string, dto: any) {
    const existing = await prisma.rentPayment.findFirst({ where: withTenant({ id }, tenantId) });
    if (!existing) throw new NotFoundException('Payment not found');
    const data = { ...dto };
    if (dto.dueDate) data.dueDate = new Date(dto.dueDate);
    if (dto.paidDate) data.paidDate = new Date(dto.paidDate);
    return prisma.rentPayment.update({ where: { id }, data });
  }

  async delete(tenantId: string, id: string) {
    const existing = await prisma.rentPayment.findFirst({ where: withTenant({ id }, tenantId) });
    if (!existing) throw new NotFoundException('Payment not found');
    return prisma.rentPayment.delete({ where: { id } });
  }

  async recordPayment(tenantId: string, id: string, dto: { paidDate: string; amount: string; paymentMethod?: string; transactionRef?: string; bankReference?: string }) {
    const existing = await prisma.rentPayment.findFirst({ where: withTenant({ id }, tenantId) });
    if (!existing) throw new NotFoundException('Payment not found');

    if (existing.status !== PaymentStatus.PENDING) {
      throw new ConflictException('Only pending rent receivables can be settled');
    }
    const paidAmount = Number(dto.amount);
    const expectedAmount = Number(existing.amount);
    if (!Number.isFinite(paidAmount) || paidAmount <= 0 || !Number.isFinite(expectedAmount) || expectedAmount <= 0) {
      throw new BadRequestException('Payment amounts must be finite and positive');
    }
    // RentPayment has no paid-amount ledger. Until a separate collection ledger is
    // introduced, reject partial/overpayments rather than corrupt the receivable.
    if (Math.round(paidAmount * 100) !== Math.round(expectedAmount * 100)) {
      throw new BadRequestException('Partial or excess payments require a payment ledger and cannot be recorded here');
    }
    const paidDate = new Date(dto.paidDate);
    if (Number.isNaN(paidDate.getTime())) throw new BadRequestException('Invalid paid date');
    const result = await prisma.rentPayment.updateMany({
      where: withTenant({ id, status: PaymentStatus.PENDING, amount: existing.amount }, tenantId),
      data: {
        paidDate,
        status: PaymentStatus.COMPLETED,
        paymentMethod: dto.paymentMethod,
        transactionRef: dto.transactionRef,
        bankReference: dto.bankReference,
      },
    });
    if (result.count !== 1) throw new ConflictException('Payment was modified or settled concurrently');
    return prisma.rentPayment.findFirstOrThrow({ where: withTenant({ id }, tenantId) });
  }

  async overdueReport(tenantId: string) {
    const where = withTenant({ status: 'PENDING', dueDate: { lt: new Date() } }, tenantId);
    const [data, totalAmount] = await Promise.all([
      prisma.rentPayment.findMany({
        where,
        orderBy: { dueDate: 'asc' },
        include: {
          contract: { select: { lesseeName: true, propertyId: true, unitId: true } },
        },
      }),
      prisma.rentPayment.aggregate({ where, _sum: { amount: true } }),
    ]);
    return { data, count: data.length, totalOverdue: totalAmount._sum.amount || 0 };
  }
}
