import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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
      include: { supplier: true, items: true, payments: true },
    });
    if (!inv) throw new NotFoundException('فاتورة المورد غير موجودة');
    return inv;
  }

  async create(tenantId: string, data: any) {
    if (!tenantId) throw new BadRequestException('Tenant is required');
    const { items, ...invoiceData } = data;
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('يجب إضافة بند واحد على الأقل للفاتورة');
    }

    const subtotal = items.reduce(
      (sum: number, item: any) => sum + Number(item.quantity) * Number(item.unitPrice),
      0,
    );
    const taxAmount = invoiceData.taxAmount ?? subtotal * 0.15;
    if (Number(taxAmount) < 0) throw new BadRequestException('قيمة الضريبة لا يمكن أن تكون سالبة');
    const total = subtotal + Number(taxAmount);

    return prisma.supplierInvoice.create({
      data: {
        ...invoiceData,
        tenantId,
        subtotal,
        taxAmount,
        total,
        items: {
          create: items.map((item: any) => ({
            tenantId,
            description: item.description,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            total: Number(item.quantity) * Number(item.unitPrice),
          })),
        },
      },
      include: { items: true, supplier: true },
    });
  }

  async addPayment(id: string, tenantId: string, userRole: string, data: any) {
    const where = userRole === 'SUPER_ADMIN' ? { id } : { id, tenantId };
    const inv = await prisma.supplierInvoice.findFirst({ where, include: { payments: true } });
    if (!inv) throw new NotFoundException('فاتورة المورد غير موجودة');

    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('قيمة الدفعة يجب أن تكون أكبر من صفر');
    }

    const currentPaid = Number(inv.paidAmount);
    const remaining = Number(inv.total) - currentPaid;
    if (amount > remaining + 0.001) {
      throw new BadRequestException('قيمة الدفعة تتجاوز الرصيد المتبقي للفاتورة');
    }

    const totalPaid = currentPaid + amount;
    const status = Math.abs(totalPaid - Number(inv.total)) < 0.01 ? 'PAID' : 'PARTIAL';

    const [payment] = await prisma.$transaction([
      prisma.supplierPayment.create({
        data: {
          tenantId,
          supplierId: inv.supplierId,
          supplierInvoiceId: id,
          amount,
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
    const exists = await prisma.supplierInvoice.findFirst({
      where,
      include: { payments: { select: { id: true }, take: 1 } },
    });
    if (!exists) throw new NotFoundException('فاتورة المورد غير موجودة');
    if (exists.payments.length > 0 || Number(exists.paidAmount) > 0) {
      throw new BadRequestException('لا يمكن حذف فاتورة مورد عليها دفعات');
    }
    return prisma.supplierInvoice.delete({ where: { id } });
  }
}
