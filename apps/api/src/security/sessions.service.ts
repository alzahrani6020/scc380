import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@scc/database';

@Injectable()
export class SessionsService {
  async findAll(req: any, userId?: string) {
    // Session listing is restricted to the authenticated user and tenant.
    // Do not expose other users' sessions via a client-supplied userId.
    if (userId && userId !== req.user?.userId) {
      throw new NotFoundException('Session not found');
    }
    const where = {
      userId: req.user?.userId,
      tenantId: req.user?.tenantId ?? null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    };
    const [data, count] = await Promise.all([
      prisma.session.findMany({
        where,
        select: {
          id: true, userAgent: true, deviceInfo: true, ipAddress: true,
          lastActiveAt: true, createdAt: true, expiresAt: true,
        },
        orderBy: { lastActiveAt: 'desc' }, take: 200,
      }),
      prisma.session.count({ where }),
    ]);
    return { data, count };
  }

  async revoke(req: any, id: string) {
    const session = await prisma.session.findFirst({
      where: { id, userId: req.user?.userId, tenantId: req.user?.tenantId ?? null },
      select: { id: true },
    });
    if (!session) throw new NotFoundException('Session not found');
    const result = await prisma.session.updateMany({
      where: { id, userId: req.user?.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { revoked: result.count };
  }

  async revokeAll(req: any) {
    const userId = req.user?.userId;
    const result = await prisma.session.updateMany({
      where: { userId, tenantId: req.user?.tenantId ?? null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { revoked: result.count };
  }
}
