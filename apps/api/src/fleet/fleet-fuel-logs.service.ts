import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class FleetFuelLogsService {
  async findAll(req: any, query: any) {
    const where: any = { ...tenantWhere(req) };
    if (query.vehicleId) where.vehicleId = query.vehicleId;
    if (query.driverId) where.driverId = query.driverId;
    if (query.from && query.to) {
      where.fueledAt = { gte: new Date(query.from), lte: new Date(query.to) };
    }
    const [data, count] = await Promise.all([
      prisma.fleetFuelLog.findMany({
        where,
        include: { vehicle: { select: { plateNumber: true, make: true, model: true } } },
        orderBy: { fueledAt: 'desc' },
        take: 200,
      }),
      prisma.fleetFuelLog.count({ where }),
    ]);
    return { data, count };
  }

  async findOne(req: any, id: string) {
    const where = { ...tenantWhere(req), id };
    const item = await prisma.fleetFuelLog.findFirst({ where });
    if (!item) throw new NotFoundException('Fuel log not found');
    return item;
  }

  async create(req: any, dto: any) {
    const data: any = { ...dto, tenantId: req.tenantId || req.user?.tenantId };
    if (dto.fueledAt) data.fueledAt = new Date(dto.fueledAt);
    return prisma.fleetFuelLog.create({ data });
  }

  async update(req: any, id: string, dto: any) {
    const where = { ...tenantWhere(req), id };
    const existing = await prisma.fleetFuelLog.findFirst({ where });
    if (!existing) throw new NotFoundException('Fuel log not found');
    return prisma.fleetFuelLog.update({ where: { id }, data: dto });
  }

  async remove(req: any, id: string) {
    const where = { ...tenantWhere(req), id };
    const existing = await prisma.fleetFuelLog.findFirst({ where });
    if (!existing) throw new NotFoundException('Fuel log not found');
    return prisma.fleetFuelLog.delete({ where: { id } });
  }
}
