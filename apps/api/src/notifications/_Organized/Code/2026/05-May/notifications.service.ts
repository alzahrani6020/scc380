import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class NotificationsService {
  async findAll(req: any, query: any) {
    const where: any = { ...tenantWhere(req) };
    if (req.user?.role !== 'SUPER_ADMIN') where.userId = req.user?.userId;
    else if (query.userId) where.userId = query.userId;
    if (query.unread === 'true') where.readAt = null;
    if (query.type) where.type = query.type;
    const [data, count] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.notification.count({ where }),
    ]);
    return { data, count };
  }

  async getUnreadCount(req: any) {
    const where: any = { ...tenantWhere(req), userId: req.user?.userId, readAt: null };
    const count = await prisma.notification.count({ where });
    return { count };
  }

  async create(req: any, dto: any) {
    return prisma.notification.create({
      data: {
        ...dto,
        tenantId: req.tenantId || req.user?.tenantId,
        channel: dto.channel || 'IN_APP',
        status: 'PENDING',
      },
    });
  }

  async markAsRead(req: any, id: string) {
    const where: any = { id };
    if (req.user?.role !== 'SUPER_ADMIN') where.userId = req.user?.userId;
    const existing = await prisma.notification.findFirst({ where });
    if (!existing) throw new NotFoundException('Notification not found');
    return prisma.notification.update({
      where: { id },
      data: { readAt: new Date(), status: 'READ' },
    });
  }

  async markAllAsRead(req: any) {
    const result = await prisma.notification.updateMany({
      where: {
        userId: req.user?.userId,
        readAt: null,
      },
      data: { readAt: new Date(), status: 'READ' },
    });
    return { updated: result.count };
  }

  async remove(req: any, id: string) {
    const where: any = { id };
    if (req.user?.role !== 'SUPER_ADMIN') where.userId = req.user?.userId;
    const existing = await prisma.notification.findFirst({ where });
    if (!existing) throw new NotFoundException('Notification not found');
    return prisma.notification.delete({ where: { id } });
  }
}
