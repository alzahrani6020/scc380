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
    if (user.role !== 'SUPER_ADMIN' && user.tenantId !== id) {
      throw new ForbiddenException('Not authorized for this tenant');
    }

    const existing = await prisma.tenant.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Tenant not found');

    if (user.role !== 'SUPER_ADMIN') {
      const protectedFields = ['plan', 'status', 'type', 'features', 'deletedAt'];
      if (protectedFields.some((key) => data?.[key] !== undefined)) {
        throw new ForbiddenException('Protected tenant fields require super admin');
      }
      const allowed = ['name', 'vatNumber', 'crNumber', 'settings', 'logoUrl', 'primaryColor'];
      data = Object.fromEntries(Object.entries(data || {}).filter(([key]) => allowed.includes(key)));
    }

    return prisma.tenant.update({ where: { id }, data });
  }

  async remove(user: any, id: string) {
    if (user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Super admin only');
    }
    const existing = await prisma.tenant.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Tenant not found');
    return prisma.tenant.delete({ where: { id } });
  }
}
