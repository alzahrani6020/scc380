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
    return { data: data.map((session) => ({ ...session, isCurrent: session.id === req.user?.sessionId })), count };
  }

  async revoke(req: any, id: string) {
    const session = await prisma.session.findFirst({
      where: { id, userId: req.user?.userId, tenantId: req.user?.tenantId ?? null },
      select: { id: true },
    });
    if (!session) throw new NotFoundException('Session not found');
    const revoked = await prisma.$transaction(async (tx) => {
      const result = await tx.session.updateMany({
        where: { id, userId: req.user?.userId, tenantId: req.user?.tenantId ?? null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (result.count === 1) {
        await tx.auditLog.create({
          data: {
            tenantId: req.user?.tenantId ?? null,
            userId: req.user?.userId,
            action: 'SESSION_REVOKED',
            entityType: 'Session',
            entityId: id,
            newValues: { sessionId: id },
          },
        });
      }
      return result.count;
    });
    return { revoked };
  }

  async revokeAll(req: any) {
    const userId = req.user?.userId;
    const revoked = await prisma.$transaction(async (tx) => {
      const result = await tx.session.updateMany({
        where: { userId, tenantId: req.user?.tenantId ?? null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (result.count > 0) {
        await tx.auditLog.create({
          data: {
            tenantId: req.user?.tenantId ?? null,
            userId,
            action: 'SESSIONS_REVOKED_ALL',
            entityType: 'Session',
            newValues: { count: result.count },
          },
        });
      }
      return result.count;
    });
    return { revoked };
  }
}
