import { Injectable } from '@nestjs/common';
import { prisma } from '@scc/database';

@Injectable()
export class LoginAttemptsService {
  async findAll(req: any, query: any) {
    if (req.user?.role !== 'SUPER_ADMIN') {
      return { data: [], count: 0, message: 'Super admin only' };
    }
    const where: any = {};
    if (query.success !== undefined) where.success = query.success === 'true';
    if (query.ipAddress) where.ipAddress = query.ipAddress;
    if (query.from && query.to) {
      where.createdAt = { gte: new Date(query.from), lte: new Date(query.to) };
    }
    const [data, count] = await Promise.all([
      prisma.loginAttempt.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      prisma.loginAttempt.count({ where }),
    ]);
    return { data, count };
  }
}
