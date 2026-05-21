import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class SupplierInvoiceService {
  async findAll(tenantId: string, userRole: string) {
    const where = userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);
    return prisma.supplierInvoice.findMany({
      where,
      include: { supplier: { select: { id: true, name: true, code: true } }, _count: { select: { payments: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, tenantId: string, userRole: string) {
    const where = userRole === 'SUPER_ADMIN' ? { id } : { id, tenantId };
    const inv = await prisma.supplierInvoice.findFirst({
      where,
      include: {
        supplier: true,
        items: true,
        payments: true,
      },
    });
    if (!inv) throw new NotFoundException('فاتورة المورد غير موجودة');
    return inv;
  }

  async create(tenantId: string, data: any) {
    const { items, ...invoiceData } = data;
    const subtotal = items.reduce((sum: number, item: any) => sum + (Number(item.quantity) * Number(item.unitPrice)), 0);
    const taxAmount = invoiceData.taxAmount || subtotal * 0.15;
    const total = subtotal + taxAmount;
    return prisma.supplierInvoice.create({
      data: {
        ...invoiceData,
        tenantId,
        subtotal,
        taxAmount,
        total,
        items: { create: items.map((item: any) => ({
          tenantId,
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          total: Number(item.quantity) * Number(item.unitPrice),
        })) },
      },
      include: { items: true, supplier: true },
    });
  }

  async addPayment(id: string, tenantId: string, userRole: string, data: any) {
    const where = userRole === 'SUPER_ADMIN' ? { id } : { id, tenantId };
    const inv = await prisma.supplierInvoice.findFirst({ where, include: { payments: true } });
    if (!inv) throw new NotFoundException('فاتورة المورد غير موجودة');

    const totalPaid = Number(inv.paidAmount) + Number(data.amount);
    const status = totalPaid >= Number(inv.total) ? 'PAID' : totalPaid > 0 ? 'PARTIAL' : inv.status;

    const [payment] = await prisma.$transaction([
      prisma.supplierPayment.create({
        data: {
          tenantId,
          supplierId: inv.supplierId,
          supplierInvoiceId: id,
          amount: Number(data.amount),
          method: data.method || 'BANK_TRANSFER',
          reference: data.reference,
          paymentDate: data.paymentDate ? new Date(data.paymentDate) : new Date(),
          notes: data.notes,
        },
      }),
      prisma.supplierInvoice.update({
        where: { id },
        data: { paidAmount: totalPaid, status },
      }),
    ]);

    return payment;
  }

  async remove(id: string, tenantId: string, userRole: string) {
    const where = userRole === 'SUPER_ADMIN' ? { id } : { id, tenantId };
    const exists = await prisma.supplierInvoice.findFirst({ where });
    if (!exists) throw new NotFoundException('فاتورة المورد غير موجودة');
    return prisma.supplierInvoice.delete({ where: { id } });
  }
}
