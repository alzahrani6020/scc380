import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class PurchaseOrdersService {
  async findAll(req: any, query: any) {
    const where: any = { ...tenantWhere(req) };
    if (query.status) where.status = query.status;
    if (query.vendorId) where.vendorId = query.vendorId;
    const [data, count] = await Promise.all([
      prisma.purchaseOrder.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 }),
      prisma.purchaseOrder.count({ where }),
    ]);
    return { data, count };
  }

  async findOne(req: any, id: string) {
    const where = { ...tenantWhere(req), id };
    const item = await prisma.purchaseOrder.findFirst({ where });
    if (!item) throw new NotFoundException('Purchase order not found');
    return item;
  }

  async create(req: any, dto: any) {
    const tenantId = req.tenantId || req.user?.tenantId;
    const existing = await prisma.purchaseOrder.findFirst({
      where: { tenantId, poNumber: dto.poNumber },
    });
    if (existing) throw new ConflictException('PO number already exists');
    const data: any = { ...dto, tenantId };
    if (dto.expectedDelivery) data.expectedDelivery = new Date(dto.expectedDelivery);
    return prisma.purchaseOrder.create({ data });
  }

  async update(req: any, id: string, dto: any) {
    const where = { ...tenantWhere(req), id };
    const existing = await prisma.purchaseOrder.findFirst({ where });
    if (!existing) throw new NotFoundException('Purchase order not found');
    const data: any = { ...dto };
    if (dto.expectedDelivery) data.expectedDelivery = new Date(dto.expectedDelivery);
    return prisma.purchaseOrder.update({ where: { id }, data });
  }

  async remove(req: any, id: string) {
    const where = { ...tenantWhere(req), id };
    const existing = await prisma.purchaseOrder.findFirst({ where });
    if (!existing) throw new NotFoundException('Purchase order not found');
    return prisma.purchaseOrder.delete({ where: { id } });
  }
}
