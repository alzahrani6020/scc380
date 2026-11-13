import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma, withTenant } from '@scc/database';

@Injectable()
export class PropertiesService {
  async findAll(tenantId: string, filters?: { status?: string; city?: string; type?: string; search?: string }) {
    const where = withTenant({}, tenantId);
    if (filters?.status) where.status = filters.status;
    if (filters?.city) where.city = filters.city;
    if (filters?.type) where.propertyType = filters.type;
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { address: { contains: filters.search, mode: 'insensitive' } },
        { deedNumber: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    const [data, count] = await Promise.all([
      prisma.property.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { units: true, contracts: true } } },
      }),
      prisma.property.count({ where }),
    ]);
    return { data, count };
  }

  async findOne(tenantId: string, id: string) {
    const property = await prisma.property.findFirst({
      where: withTenant({ id }, tenantId),
      include: {
        units: { orderBy: { unitNumber: 'asc' } },
        contracts: { orderBy: { startDate: 'desc' }, take: 10 },
        expenses: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!property) throw new NotFoundException('Property not found');
    return property;
  }

  async create(tenantId: string, data: any) {
    return prisma.property.create({ data: { ...data, tenantId } });
  }

  async update(tenantId: string, id: string, data: any) {
    const property = await prisma.property.findFirst({ where: withTenant({ id }, tenantId) });
    if (!property) throw new NotFoundException('Property not found');
    return prisma.property.update({ where: { id }, data });
  }

  async delete(tenantId: string, id: string) {
    const property = await prisma.property.findFirst({ where: withTenant({ id }, tenantId) });
    if (!property) throw new NotFoundException('Property not found');
    const [units, contracts, expenses] = await Promise.all([
      prisma.unit.count({ where: withTenant({ propertyId: id }, tenantId) }),
      prisma.leaseContract.count({ where: withTenant({ propertyId: id }, tenantId) }),
      prisma.propertyExpense.count({ where: withTenant({ propertyId: id }, tenantId) }),
    ]);
    if (units || contracts || expenses) {
      throw new ConflictException('Property has dependent units, leases or expenses and cannot be deleted');
    }
    return prisma.property.delete({ where: { id } });
  }

  async summary(tenantId: string) {
    const [total, active, totalUnits, occupiedUnits] = await Promise.all([
      prisma.property.count({ where: withTenant({}, tenantId) }),
      prisma.property.count({ where: withTenant({ status: 'ACTIVE' }, tenantId) }),
      prisma.unit.count({ where: withTenant({}, tenantId) }),
      prisma.unit.count({ where: withTenant({ status: 'OCCUPIED' }, tenantId) }),
    ]);
    return { total, active, totalUnits, occupiedUnits, vacantUnits: totalUnits - occupiedUnits };
  }
}
