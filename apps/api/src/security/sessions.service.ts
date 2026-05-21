import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@scc/database';

@Injectable()
export class SessionsService {
  async findAll(req: any, userId?: string) {
    const where: any = {};
    if (userId) where.userId = userId;
    else if (req.user?.role !== 'SUPER_ADMIN') where.userId = req.user?.userId;
    const [data, count] = await Promise.all([
      prisma.session.findMany({ where, orderBy: { lastActiveAt: 'desc' }, take: 200 }),
      prisma.session.count({ where }),
    ]);
    return { data, count };
  }

  async revoke(req: any, id: string) {
    const session = await prisma.session.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Session not found');
    if (req.user?.role !== 'SUPER_ADMIN' && session.userId !== req.user?.userId) {
      throw new NotFoundException('Session not found');
    }
    return prisma.session.update({ where: { id }, data: { revokedAt: new Date() } });
  }

  async revokeAll(req: any) {
    const userId = req.user?.userId;
    const result = await prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { revoked: result.count };
  }
}
