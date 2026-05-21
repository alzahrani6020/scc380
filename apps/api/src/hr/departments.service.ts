import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class DepartmentsService {
  async findAll(req: any, search?: string) {
    const where: any = { ...tenantWhere(req) };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [data, count] = await Promise.all([
      prisma.department.findMany({ where, orderBy: { name: 'asc' } }),
      prisma.department.count({ where }),
    ]);
    return { data, count };
  }

  async findOne(req: any, id: string) {
    const where = { ...tenantWhere(req), id };
    const dept = await prisma.department.findFirst({ where });
    if (!dept) throw new NotFoundException('Department not found');
    return dept;
  }

  async create(req: any, dto: any) {
    return prisma.department.create({
      data: { ...dto, tenantId: req.tenantId || req.user?.tenantId },
    });
  }

  async update(req: any, id: string, dto: any) {
    const where = { ...tenantWhere(req), id };
    const existing = await prisma.department.findFirst({ where });
    if (!existing) throw new NotFoundException('Department not found');
    return prisma.department.update({ where: { id }, data: dto });
  }

  async remove(req: any, id: string) {
    const where = { ...tenantWhere(req), id };
    const existing = await prisma.department.findFirst({ where });
    if (!existing) throw new NotFoundException('Department not found');
    return prisma.department.delete({ where: { id } });
  }
}
