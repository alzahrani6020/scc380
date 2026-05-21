import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma, withTenant } from '@scc/database';

@Injectable()
export class VehiclesService {
  async findAll(tenantId: string, filters?: { status?: string; search?: string }) {
    const where = withTenant({}, tenantId);
    if (filters?.status) where.status = filters.status;
    if (filters?.search) {
      where.OR = [
        { plateNumber: { contains: filters.search, mode: 'insensitive' } },
        { make: { contains: filters.search, mode: 'insensitive' } },
        { model: { contains: filters.search, mode: 'insensitive' } },
        { vin: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    return prisma.vehicle.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async findOne(tenantId: string, id: string) {
    const vehicle = await prisma.vehicle.findFirst({ where: withTenant({ id }, tenantId) });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return vehicle;
  }

  async create(tenantId: string, data: any) {
    return prisma.vehicle.create({ data: { ...data, tenantId } });
  }

  async update(tenantId: string, id: string, data: any) {
    const vehicle = await prisma.vehicle.findFirst({ where: withTenant({ id }, tenantId) });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return prisma.vehicle.update({ where: { id }, data });
  }

  async delete(tenantId: string, id: string) {
    const vehicle = await prisma.vehicle.findFirst({ where: withTenant({ id }, tenantId) });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return prisma.vehicle.delete({ where: { id } });
  }
}
