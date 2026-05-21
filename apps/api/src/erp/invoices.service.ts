import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma, withTenant } from '@scc/database';

@Injectable()
export class InvoicesService {
  async findAll(tenantId: string, filters?: { status?: string; search?: string }) {
    const where = withTenant({}, tenantId);
    if (filters?.status) where.status = filters.status;
    if (filters?.search) {
      where.OR = [
        { invoiceNumber: { contains: filters.search, mode: 'insensitive' } },
        { notes: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    return prisma.invoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
  }

  async findOne(tenantId: string, id: string) {
    const invoice = await prisma.invoice.findFirst({
      where: withTenant({ id }, tenantId),
      include: { items: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async create(tenantId: string, data: any) {
    const { items, ...invoiceData } = data;
    return prisma.invoice.create({
      data: {
        ...invoiceData,
        tenantId,
        items: items?.length ? { create: items.map((item: any) => ({ ...item, tenantId })) } : undefined,
      },
      include: { items: true },
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const invoice = await prisma.invoice.findFirst({ where: withTenant({ id }, tenantId) });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return prisma.invoice.update({ where: { id }, data, include: { items: true } });
  }

  async delete(tenantId: string, id: string) {
    const invoice = await prisma.invoice.findFirst({ where: withTenant({ id }, tenantId) });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return prisma.invoice.delete({ where: { id } });
  }
}
