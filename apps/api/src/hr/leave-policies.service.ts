import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class LeavePoliciesService {
  async findAll(req: any) {
    const where = { ...tenantWhere(req.user?.tenantId) };
    const data = await prisma.leavePolicy.findMany({ where, orderBy: [{ isActive: 'desc' }, { type: 'asc' }] });
    return { data, count: data.length };
  }

  async create(req: any, dto: any) {
    const tenantId = req.user?.tenantId;
    const existing = await prisma.leavePolicy.findFirst({
      where: { ...tenantWhere(tenantId), type: dto.type },
    });
    if (existing) throw new ConflictException('Leave policy already exists for this type');
    return prisma.leavePolicy.create({ data: { ...dto, tenantId } });
  }

  async update(req: any, id: string, dto: any) {
    const existing = await prisma.leavePolicy.findFirst({
      where: { ...tenantWhere(req.user?.tenantId), id },
    });
    if (!existing) throw new NotFoundException('Leave policy not found');
    return prisma.leavePolicy.update({ where: { id }, data: dto });
  }
}
