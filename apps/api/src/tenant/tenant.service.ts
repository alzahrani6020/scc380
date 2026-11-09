import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@scc/database';

@Injectable()
export class TenantService {
  async findAll(user: any) {
    if (user.role === 'SUPER_ADMIN') {
      return prisma.tenant.findMany();
    }
    return prisma.tenant.findMany({ where: { id: user.tenantId } });
  }

  async findOne(user: any, id: string) {
    if (user.role !== 'SUPER_ADMIN' && user.tenantId !== id) {
      throw new ForbiddenException('Not authorized for this tenant');
    }
    const tenant = await prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async create(user: any, data: any) {
    if (user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Super admin only');
    }
    return prisma.tenant.create({ data });
  }

  async update(user: any, id: string, data: any) {
    if (user.role !== 'SUPER_ADMIN') {
      if (user.role !== 'ADMIN' || user.tenantId !== id) {
        throw new ForbiddenException('Not authorized for this tenant');
      }
      const { status, plan, type, slug, domain, ...safeData } = data || {};
      data = safeData;
    }
    return prisma.tenant.update({ where: { id }, data });
  }

  async remove(user: any, id: string) {
    if (user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Super admin only');
    }
    return prisma.tenant.delete({ where: { id } });
  }
}
