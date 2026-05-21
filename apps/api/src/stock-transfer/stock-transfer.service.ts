import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class StockTransferService {
  async findAll(tenantId: string, userRole: string) {
    const where = userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);
    return prisma.stockTransfer.findMany({
      where,
      include: {
        items: { include: { product: { select: { id: true, name: true, sku: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, tenantId: string, userRole: string) {
    const where = userRole === 'SUPER_ADMIN' ? { id } : { id, tenantId };
    const transfer = await prisma.stockTransfer.findFirst({
      where,
      include: {
        items: { include: { product: { select: { id: true, name: true, sku: true } } } },
      },
    });
    if (!transfer) throw new NotFoundException('تحويل المخزون غير موجود');
    return transfer;
  }

  async create(tenantId: string, data: any) {
    const { items, ...transferData } = data;
    const count = await prisma.stockTransfer.count({ where: tenantWhere(tenantId) });
    const transferNumber = `TRF-${String(count + 1).padStart(4, '0')}`;

    return prisma.stockTransfer.create({
      data: {
        ...transferData,
        tenantId,
        transferNumber,
        items: { create: items.map((item: any) => ({
          tenantId,
          productId: item.productId,
          quantity: Number(item.quantity),
          unitCost: Number(item.unitCost) || 0,
          notes: item.notes,
        })) },
      },
      include: { items: { include: { product: true } } },
    });
  }

  async updateStatus(id: string, tenantId: string, userRole: string, status: string) {
    const where = userRole === 'SUPER_ADMIN' ? { id } : { id, tenantId };
    const exists = await prisma.stockTransfer.findFirst({ where, include: { items: true } });
    if (!exists) throw new NotFoundException('تحويل المخزون غير موجود');

    const updateData: any = { status };
    if (status === 'SHIPPED') updateData.shippedAt = new Date();
    if (status === 'RECEIVED') updateData.receivedAt = new Date();

    return prisma.stockTransfer.update({ where: { id }, data: updateData, include: { items: { include: { product: true } } } });
  }

  async remove(id: string, tenantId: string, userRole: string) {
    const where = userRole === 'SUPER_ADMIN' ? { id } : { id, tenantId };
    const exists = await prisma.stockTransfer.findFirst({ where });
    if (!exists) throw new NotFoundException('تحويل المخزون غير موجود');
    return prisma.stockTransfer.delete({ where: { id } });
  }
}
