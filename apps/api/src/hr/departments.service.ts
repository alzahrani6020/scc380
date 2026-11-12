import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class DepartmentsService {
  async findAll(req: any, search?: string) {
    const where: any = { ...tenantWhere(req.user?.tenantId) };
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
    const where = { ...tenantWhere(req.user?.tenantId), id };
    const dept = await prisma.department.findFirst({ where });
    if (!dept) throw new NotFoundException('Department not found');
    return dept;
  }

  async create(req: any, dto: any) {
    const tenantId = req.user?.tenantId;
    await this.validateRelations(tenantId, dto);
    return prisma.department.create({
      data: { ...dto, tenantId },
    });
  }

  async update(req: any, id: string, dto: any) {
    const tenantId = req.user?.tenantId;
    const where = { ...tenantWhere(tenantId), id };
    const existing = await prisma.department.findFirst({ where });
    if (!existing) throw new NotFoundException('Department not found');
    await this.validateRelations(tenantId, dto, id);
    return prisma.department.update({ where: { id }, data: dto });
  }

  async remove(req: any, id: string) {
    const where = { ...tenantWhere(req.user?.tenantId), id };
    const existing = await prisma.department.findFirst({ where });
    if (!existing) throw new NotFoundException('Department not found');
    return prisma.department.delete({ where: { id } });
  }

  private async validateRelations(tenantId: string, dto: any, currentId?: string) {
    if (dto.parentId) {
      if (dto.parentId === currentId) throw new NotFoundException('Parent department is invalid');
      const parent = await prisma.department.findFirst({ where: { ...tenantWhere(tenantId), id: dto.parentId } });
      if (!parent) throw new NotFoundException('Parent department not found');
    }
    if (dto.managerId) {
      const manager = await prisma.employee.findFirst({ where: { ...tenantWhere(tenantId), id: dto.managerId } });
      if (!manager) throw new NotFoundException('Department manager not found');
    }
  }
}
