import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class FleetTripsService {
  async findAll(req: any, query: any) {
    const where: any = { ...tenantWhere(req) };
    if (query.vehicleId) where.vehicleId = query.vehicleId;
    if (query.status) where.status = query.status;
    if (query.driverId) where.driverId = query.driverId;
    const [data, count] = await Promise.all([
      prisma.fleetTrip.findMany({ where, orderBy: { startedAt: 'desc' }, take: 200 }),
      prisma.fleetTrip.count({ where }),
    ]);
    return { data, count };
  }

  async findOne(req: any, id: string) {
    const where = { ...tenantWhere(req), id };
    const trip = await prisma.fleetTrip.findFirst({ where });
    if (!trip) throw new NotFoundException('Trip not found');
    return trip;
  }

  async create(req: any, dto: any) {
    const data = { ...dto, tenantId: req.tenantId || req.user?.tenantId };
    data.startedAt = new Date(dto.startedAt);
    return prisma.fleetTrip.create({ data });
  }

  async update(req: any, id: string, dto: any) {
    const where = { ...tenantWhere(req), id };
    const existing = await prisma.fleetTrip.findFirst({ where });
    if (!existing) throw new NotFoundException('Trip not found');
    const data = { ...dto };
    if (dto.endedAt) data.endedAt = new Date(dto.endedAt);
    if (dto.status === 'COMPLETED' && !dto.endedAt) data.endedAt = new Date();
    return prisma.fleetTrip.update({ where: { id }, data });
  }

  async remove(req: any, id: string) {
    const where = { ...tenantWhere(req), id };
    const existing = await prisma.fleetTrip.findFirst({ where });
    if (!existing) throw new NotFoundException('Trip not found');
    return prisma.fleetTrip.delete({ where: { id } });
  }
}
