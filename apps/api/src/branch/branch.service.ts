import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class BranchService {
  async findAll(tenantId: string, userRole: string) {
    const where = userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);
    return prisma.branch.findMany({
      where,
      include: {
        _count: { select: { warehouses: true, posSessions: true, posOrders: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, tenantId: string, userRole: string) {
    const where = userRole === 'SUPER_ADMIN' ? { id } : { id, tenantId };
    const branch = await prisma.branch.findFirst({
      where,
      include: {
        warehouses: { select: { id: true, name: true, code: true, isActive: true } },
        posSessions: {
          orderBy: { openedAt: 'desc' },
          take: 5,
          select: { id: true, status: true, openedAt: true, posTerminal: true },
        },
        _count: { select: { posOrders: true } },
      },
    });
    if (!branch) throw new NotFoundException('الفرع غير موجود');
    return branch;
  }

  async create(tenantId: string, data: any) {
    return prisma.branch.create({
      data: { ...data, tenantId },
    });
  }

  async update(id: string, tenantId: string, userRole: string, data: any) {
    const where = userRole === 'SUPER_ADMIN' ? { id } : { id, tenantId };
    const exists = await prisma.branch.findFirst({ where });
    if (!exists) throw new NotFoundException('الفرع غير موجود');
    return prisma.branch.update({ where: { id }, data });
  }

  async remove(id: string, tenantId: string, userRole: string) {
    const where = userRole === 'SUPER_ADMIN' ? { id } : { id, tenantId };
    const exists = await prisma.branch.findFirst({ where });
    if (!exists) throw new NotFoundException('الفرع غير موجود');
    return prisma.branch.delete({ where: { id } });
  }

  async getStats(id: string, tenantId: string, userRole: string) {
    const where = userRole === 'SUPER_ADMIN' ? { id } : { id, tenantId };
    const branch = await prisma.branch.findFirst({ where });
    if (!branch) throw new NotFoundException('الفرع غير موجود');

    const [warehouseCount, orderCount, sessionCount, totalSales] = await Promise.all([
      prisma.warehouse.count({ where: { branchId: id } }),
      prisma.posOrder.count({ where: { branchId: id } }),
      prisma.posSession.count({ where: { branchId: id } }),
      prisma.posOrder.aggregate({
        where: { branchId: id, status: 'COMPLETED' },
        _sum: { total: true },
      }),
    ]);

    return {
      branch,
      warehouseCount,
      orderCount,
      sessionCount,
      totalSales: Number(totalSales._sum.total || 0),
    };
  }
}
