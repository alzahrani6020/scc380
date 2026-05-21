import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class SupplierService {
  async findAll(tenantId: string, userRole: string) {
    const where = userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);
    return prisma.supplier.findMany({
      where,
      include: {
        _count: { select: { products: true, purchaseOrders: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, tenantId: string, userRole: string) {
    const where = userRole === 'SUPER_ADMIN' ? { id } : { id, tenantId };
    const supplier = await prisma.supplier.findFirst({
      where,
      include: {
        products: { select: { id: true, name: true, sku: true, currentStock: true } },
        purchaseOrders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, poNumber: true, status: true, total: true, createdAt: true },
        },
      },
    });
    if (!supplier) throw new NotFoundException('المورد غير موجود');
    return supplier;
  }

  async create(tenantId: string, data: any) {
    return prisma.supplier.create({
      data: { ...data, tenantId },
    });
  }

  async update(id: string, tenantId: string, userRole: string, data: any) {
    const where = userRole === 'SUPER_ADMIN' ? { id } : { id, tenantId };
    const exists = await prisma.supplier.findFirst({ where });
    if (!exists) throw new NotFoundException('المورد غير موجود');
    return prisma.supplier.update({ where: { id }, data });
  }

  async remove(id: string, tenantId: string, userRole: string) {
    const where = userRole === 'SUPER_ADMIN' ? { id } : { id, tenantId };
    const exists = await prisma.supplier.findFirst({ where });
    if (!exists) throw new NotFoundException('المورد غير موجود');
    return prisma.supplier.delete({ where: { id } });
  }

  async getStatement(id: string, tenantId: string, userRole: string) {
    const where = userRole === 'SUPER_ADMIN' ? { id } : { id, tenantId };
    const supplier = await prisma.supplier.findFirst({ where });
    if (!supplier) throw new NotFoundException('المورد غير موجود');

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: { vendorId: id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, poNumber: true, total: true, status: true, createdAt: true },
    });

    const totalPurchases = purchaseOrders.reduce((sum, po) => sum + Number(po.total), 0);

    return {
      supplier,
      purchaseOrders,
      totalPurchases,
      outstandingBalance: Number(supplier.balance),
    };
  }
}
