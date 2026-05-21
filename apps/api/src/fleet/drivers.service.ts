import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class DriversService {
  async findAll(req: any, search?: string, status?: string) {
    const where: any = { ...tenantWhere(req) };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { licenseNumber: { contains: search } },
      ];
    }
    const [data, count] = await Promise.all([
      prisma.driver.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 }),
      prisma.driver.count({ where }),
    ]);
    return { data, count };
  }

  async findOne(req: any, id: string) {
    const where = { ...tenantWhere(req), id };
    const item = await prisma.driver.findFirst({ where });
    if (!item) throw new NotFoundException('Driver not found');
    return item;
  }

  async create(req: any, dto: any) {
    const data: any = { ...dto, tenantId: req.tenantId || req.user?.tenantId };
    if (dto.licenseExpiry) data.licenseExpiry = new Date(dto.licenseExpiry);
    return prisma.driver.create({ data });
  }

  async update(req: any, id: string, dto: any) {
    const where = { ...tenantWhere(req), id };
    const existing = await prisma.driver.findFirst({ where });
    if (!existing) throw new NotFoundException('Driver not found');
    const data: any = { ...dto };
    if (dto.licenseExpiry) data.licenseExpiry = new Date(dto.licenseExpiry);
    return prisma.driver.update({ where: { id }, data });
  }

  async remove(req: any, id: string) {
    const where = { ...tenantWhere(req), id };
    const existing = await prisma.driver.findFirst({ where });
    if (!existing) throw new NotFoundException('Driver not found');
    return prisma.driver.delete({ where: { id } });
  }
}
