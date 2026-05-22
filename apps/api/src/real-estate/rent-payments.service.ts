import { Injectable, NotFoundException } from '@nestjs/common';
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

    const paidAmount = parseFloat(dto.amount);
    const expectedAmount = Number(existing.amount);
    const status = paidAmount >= expectedAmount ? PaymentStatus.COMPLETED : paidAmount > 0 ? PaymentStatus.PENDING : PaymentStatus.PENDING;

    return prisma.rentPayment.update({
      where: { id },
      data: {
        paidDate: new Date(dto.paidDate),
        amount: paidAmount,
        status,
        paymentMethod: dto.paymentMethod,
        transactionRef: dto.transactionRef,
        bankReference: dto.bankReference,
      },
    });
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
