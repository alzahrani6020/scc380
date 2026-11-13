import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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
    const parent = await prisma.property.findFirst({
      where: withTenant({ id: data.propertyId }, tenantId),
      select: { id: true },
    });
    if (!parent) throw new NotFoundException('Property not found in this tenant');
    return prisma.unit.create({ data: { ...data, tenantId } });
  }

  async update(tenantId: string, id: string, data: any) {
    const unit = await prisma.unit.findFirst({ where: withTenant({ id }, tenantId) });
    if (!unit) throw new NotFoundException('Unit not found');
    if (data.propertyId && data.propertyId !== unit.propertyId) {
      const parent = await prisma.property.findFirst({
        where: withTenant({ id: data.propertyId }, tenantId),
        select: { id: true },
      });
      if (!parent) throw new NotFoundException('Property not found in this tenant');
      const leases = await prisma.leaseContract.count({ where: withTenant({ unitId: id }, tenantId) });
      if (leases) throw new ConflictException('Unit cannot move to another property after a lease exists');
    }
    return prisma.unit.update({ where: { id }, data });
  }

  async delete(tenantId: string, id: string) {
    const unit = await prisma.unit.findFirst({ where: withTenant({ id }, tenantId) });
    if (!unit) throw new NotFoundException('Unit not found');
    const leases = await prisma.leaseContract.count({ where: withTenant({ unitId: id }, tenantId) });
    if (leases || unit.currentLeaseId) {
      throw new ConflictException('Unit has lease history or an active lease and cannot be deleted');
    }
    return prisma.unit.delete({ where: { id } });
  }
}
