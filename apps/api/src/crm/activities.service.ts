import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class ActivitiesService {
  async findAll(req: any, query: any) {
    const where: any = { ...tenantWhere(req) };
    if (query.type) where.type = query.type;
    if (query.contactId) where.contactId = query.contactId;
    if (query.dealId) where.dealId = query.dealId;
    if (query.assignedToId) where.assignedToId = query.assignedToId;
    const [data, count] = await Promise.all([
      prisma.activity.findMany({ where, orderBy: { scheduledAt: 'asc' }, take: 200 }),
      prisma.activity.count({ where }),
    ]);
    return { data, count };
  }

  async findOne(req: any, id: string) {
    const where = { ...tenantWhere(req), id };
    const activity = await prisma.activity.findFirst({ where });
    if (!activity) throw new NotFoundException('Activity not found');
    return activity;
  }

  async create(req: any, dto: any) {
    const data = { ...dto, tenantId: req.tenantId || req.user?.tenantId };
    if (dto.scheduledAt) data.scheduledAt = new Date(dto.scheduledAt);
    return prisma.activity.create({ data });
  }

  async update(req: any, id: string, dto: any) {
    const where = { ...tenantWhere(req), id };
    const existing = await prisma.activity.findFirst({ where });
    if (!existing) throw new NotFoundException('Activity not found');
    const data = { ...dto };
    if (dto.scheduledAt) data.scheduledAt = new Date(dto.scheduledAt);
    if (dto.completedAt) data.completedAt = new Date(dto.completedAt);
    return prisma.activity.update({ where: { id }, data });
  }

  async remove(req: any, id: string) {
    const where = { ...tenantWhere(req), id };
    const existing = await prisma.activity.findFirst({ where });
    if (!existing) throw new NotFoundException('Activity not found');
    return prisma.activity.delete({ where: { id } });
  }
}
