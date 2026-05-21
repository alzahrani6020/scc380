import { Injectable } from '@nestjs/common';
import { prisma } from '@scc/database';

@Injectable()
export class TenantService {
  async findAll(user: any) {
    if (user.role === 'SUPER_ADMIN') {
      return prisma.tenant.findMany();
    }
    return prisma.tenant.findMany({ where: { id: user.tenantId } });
  }

  async findOne(id: string) {
    return prisma.tenant.findUnique({ where: { id } });
  }

  async create(data: any) {
    return prisma.tenant.create({ data });
  }

  async update(id: string, data: any) {
    return prisma.tenant.update({ where: { id }, data });
  }

  async remove(id: string) {
    return prisma.tenant.delete({ where: { id } });
  }
}
