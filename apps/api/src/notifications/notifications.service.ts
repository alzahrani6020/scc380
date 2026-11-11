import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class NotificationsService {
  private tenantIdFor(req: any) {
    return req.user?.role === 'SUPER_ADMIN' ? req.tenantId : req.user?.tenantId;
  }

  private scopedWhere(req: any) {
    return tenantWhere(this.tenantIdFor(req));
  }

  async findAll(req: any, query: any) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const where: any = { ...this.scopedWhere(req) };

    if (req.user?.role !== 'SUPER_ADMIN') where.userId = req.user?.userId;
    else if (query.userId) where.userId = query.userId;

    if (query.unread === 'true') where.readAt = null;
    if (query.type) where.type = query.type;

    const [data, count] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);
    return { data, count, page, limit };
  }

  async getUnreadCount(req: any) {
    const where: any = { ...this.scopedWhere(req), userId: req.user?.userId, readAt: null };
    const count = await prisma.notification.count({ where });
    return { count };
  }

  async create(req: any, dto: any) {
    const tenantId = this.tenantIdFor(req);
    if (!tenantId) throw new BadRequestException('Tenant context is required');

    const target = await prisma.user.findFirst({
      where: { id: dto.userId, tenantId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!target) throw new BadRequestException('Notification target not found in your tenant');

    return prisma.notification.create({
      data: {
        ...dto,
        tenantId,
        channel: dto.channel || 'IN_APP',
        status: 'PENDING',
      },
    });
  }

  async markAsRead(req: any, id: string) {
    const where: any = { id, ...this.scopedWhere(req) };
    if (req.user?.role !== 'SUPER_ADMIN') where.userId = req.user?.userId;
    const existing = await prisma.notification.findFirst({ where });
    if (!existing) throw new NotFoundException('Notification not found');
    return prisma.notification.update({ where: { id }, data: { readAt: new Date(), status: 'READ' } });
  }

  async markAllAsRead(req: any) {
    const result = await prisma.notification.updateMany({
      where: { ...this.scopedWhere(req), userId: req.user?.userId, readAt: null },
      data: { readAt: new Date(), status: 'READ' },
    });
    return { updated: result.count };
  }

  async remove(req: any, id: string) {
    const where: any = { id, ...this.scopedWhere(req) };
    if (req.user?.role !== 'SUPER_ADMIN') where.userId = req.user?.userId;
    const existing = await prisma.notification.findFirst({ where });
    if (!existing) throw new NotFoundException('Notification not found');
    return prisma.notification.delete({ where: { id } });
  }
}
