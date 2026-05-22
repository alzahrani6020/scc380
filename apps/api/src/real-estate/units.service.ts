import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma, withTenant } from '@scc/database';

@Injectable()
export class UnitsService {
  async findAll(tenantId: string, filters?: { propertyId?: string; status?: string; search?: string }) {
    const where = withTenant({}, tenantId);
    if (filters?.propertyId) where.propertyId = filters.propertyId;
    if (filters?.status) where.status = filters.status;
    if (filters?.search) {
      where.OR = [
        { unitNumber: { contains: filters.search, mode: 'insensitive' } },
        { property: { name: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }
    const [data, count] = await Promise.all([
      prisma.unit.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { property: { select: { id: true, name: true } } },
      }),
      prisma.unit.count({ where }),
    ]);
    return { data, count };
  }

  async findOne(tenantId: string, id: string) {
    const unit = await prisma.unit.findFirst({
      where: withTenant({ id }, tenantId),
      include: {
        property: true,
        leases: { orderBy: { startDate: 'desc' }, take: 5 },
      },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    return unit;
  }

  async create(tenantId: string, data: any) {
    return prisma.unit.create({ data: { ...data, tenantId } });
  }

  async update(tenantId: string, id: string, data: any) {
    const unit = await prisma.unit.findFirst({ where: withTenant({ id }, tenantId) });
    if (!unit) throw new NotFoundException('Unit not found');
    return prisma.unit.update({ where: { id }, data });
  }

  async delete(tenantId: string, id: string) {
    const unit = await prisma.unit.findFirst({ where: withTenant({ id }, tenantId) });
    if (!unit) throw new NotFoundException('Unit not found');
    return prisma.unit.delete({ where: { id } });
  }
}
