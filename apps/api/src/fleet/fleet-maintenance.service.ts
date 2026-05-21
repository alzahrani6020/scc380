import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class FleetMaintenanceService {
  async findAll(req: any, query: any) {
    const where: any = { ...tenantWhere(req) };
    if (query.vehicleId) where.vehicleId = query.vehicleId;
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    const [data, count] = await Promise.all([
      prisma.fleetMaintenance.findMany({
        where,
        include: { vehicle: { select: { plateNumber: true, make: true, model: true } } },
        orderBy: { serviceDate: 'desc' },
        take: 200,
      }),
      prisma.fleetMaintenance.count({ where }),
    ]);
    return { data, count };
  }

  async findOne(req: any, id: string) {
    const where = { ...tenantWhere(req), id };
    const item = await prisma.fleetMaintenance.findFirst({ where });
    if (!item) throw new NotFoundException('Maintenance record not found');
    return item;
  }

  async create(req: any, dto: any) {
    const data: any = { ...dto, tenantId: req.tenantId || req.user?.tenantId };
    if (dto.serviceDate) data.serviceDate = new Date(dto.serviceDate);
    if (dto.nextServiceDate) data.nextServiceDate = new Date(dto.nextServiceDate);
    return prisma.fleetMaintenance.create({ data });
  }

  async update(req: any, id: string, dto: any) {
    const where = { ...tenantWhere(req), id };
    const existing = await prisma.fleetMaintenance.findFirst({ where });
    if (!existing) throw new NotFoundException('Maintenance record not found');
    const data: any = { ...dto };
    if (dto.nextServiceDate) data.nextServiceDate = new Date(dto.nextServiceDate);
    return prisma.fleetMaintenance.update({ where: { id }, data });
  }

  async remove(req: any, id: string) {
    const where = { ...tenantWhere(req), id };
    const existing = await prisma.fleetMaintenance.findFirst({ where });
    if (!existing) throw new NotFoundException('Maintenance record not found');
    return prisma.fleetMaintenance.delete({ where: { id } });
  }
}
