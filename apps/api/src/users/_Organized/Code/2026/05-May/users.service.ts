import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { prisma } from '@scc/database';

@Injectable()
export class UsersService {
  async findAll(req: any, query: any) {
    const where: any = {};
    if (req.user?.role !== 'SUPER_ADMIN') {
      where.tenantId = req.tenantId || req.user?.tenantId;
    } else if (query.tenantId) {
      where.tenantId = query.tenantId;
    }
    if (query.role) where.role = query.role;
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const [data, count] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, email: true, phone: true, firstName: true, lastName: true,
          role: true, status: true, emailVerified: true, lastLoginAt: true,
          tenantId: true, createdAt: true, updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      prisma.user.count({ where }),
    ]);
    return { data, count };
  }

  async findOne(req: any, id: string) {
    const where: any = { id };
    if (req.user?.role !== 'SUPER_ADMIN' && id !== req.user?.userId) {
      where.tenantId = req.tenantId || req.user?.tenantId;
    }
    const user = await prisma.user.findFirst({
      where,
      select: {
        id: true, email: true, phone: true, firstName: true, lastName: true,
        role: true, status: true, emailVerified: true, phoneVerified: true,
        lastLoginAt: true, preferences: true, tenantId: true, createdAt: true, updatedAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(req: any, id: string, dto: any) {
    const where: any = { id };
    if (req.user?.role !== 'SUPER_ADMIN' && id !== req.user?.userId) {
      throw new ForbiddenException('Not authorized');
    }
    const existing = await prisma.user.findFirst({ where });
    if (!existing) throw new NotFoundException('User not found');
    if (dto.role && req.user?.role !== 'SUPER_ADMIN' && req.user?.role !== 'ADMIN') {
      delete dto.role;
    }
    const data: any = { ...dto };
    if (dto.preferences) data.preferences = JSON.parse(dto.preferences);
    return prisma.user.update({ where: { id }, data });
  }

  async remove(req: any, id: string) {
    if (req.user?.role !== 'SUPER_ADMIN') throw new ForbiddenException('Super admin only');
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('User not found');
    return prisma.user.delete({ where: { id } });
  }
}
