import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class SubscriptionsService {
  async findAll(req: any, query: any) {
    const where: any = { ...tenantWhere(req) };
    if (query.status) where.status = query.status;
    if (query.plan) where.plan = query.plan;
    if (query.userId) where.userId = query.userId;
    if (req.user?.role !== 'SUPER_ADMIN') where.userId = req.user?.userId;
    const [data, count] = await Promise.all([
      prisma.subscription.findMany({
        where,
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.subscription.count({ where }),
    ]);
    return { data, count };
  }

  async findOne(req: any, id: string) {
    const where = { ...tenantWhere(req), id };
    const item = await prisma.subscription.findFirst({ where, include: { user: { select: { firstName: true, lastName: true, email: true } } } });
    if (!item) throw new NotFoundException('Subscription not found');
    return item;
  }

  async create(req: any, dto: any) {
    const data: any = {
      ...dto,
      tenantId: req.tenantId || req.user?.tenantId,
    };
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);
    if (dto.trialEndsAt) data.trialEndsAt = new Date(dto.trialEndsAt);
    return prisma.subscription.create({ data });
  }

  async update(req: any, id: string, dto: any) {
    const where = { ...tenantWhere(req), id };
    const existing = await prisma.subscription.findFirst({ where });
    if (!existing) throw new NotFoundException('Subscription not found');
    const data: any = { ...dto };
    if (dto.cancelledAt) data.cancelledAt = new Date(dto.cancelledAt);
    if (dto.status === 'CANCELLED' && !dto.cancelledAt) data.cancelledAt = new Date();
    return prisma.subscription.update({ where: { id }, data });
  }

  async remove(req: any, id: string) {
    const where = { ...tenantWhere(req), id };
    const existing = await prisma.subscription.findFirst({ where });
    if (!existing) throw new NotFoundException('Subscription not found');
    return prisma.subscription.delete({ where: { id } });
  }
}
