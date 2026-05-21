import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class ProjectsService {
  async findAll(req: any, query: any) {
    const where: any = { ...tenantWhere(req) };
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const [data, count] = await Promise.all([
      prisma.project.findMany({
        where,
        include: { tasks: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.project.count({ where }),
    ]);
    return { data, count };
  }

  async findOne(req: any, id: string) {
    const where = { ...tenantWhere(req), id };
    const project = await prisma.project.findFirst({ where, include: { tasks: true } });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async create(req: any, dto: any) {
    const data: any = { ...dto, tenantId: req.tenantId || req.user?.tenantId };
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);
    return prisma.project.create({ data });
  }

  async update(req: any, id: string, dto: any) {
    const where = { ...tenantWhere(req), id };
    const existing = await prisma.project.findFirst({ where });
    if (!existing) throw new NotFoundException('Project not found');
    const data: any = { ...dto };
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);
    return prisma.project.update({ where: { id }, data });
  }

  async remove(req: any, id: string) {
    const where = { ...tenantWhere(req), id };
    const existing = await prisma.project.findFirst({ where });
    if (!existing) throw new NotFoundException('Project not found');
    return prisma.project.delete({ where: { id } });
  }
}
