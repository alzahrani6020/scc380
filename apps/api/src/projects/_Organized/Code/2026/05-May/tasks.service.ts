import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class TasksService {
  async findAll(req: any, query: any) {
    const where: any = { ...tenantWhere(req) };
    if (query.projectId) where.projectId = query.projectId;
    if (query.status) where.status = query.status;
    if (query.assignedToId) where.assignedToId = query.assignedToId;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const [data, count] = await Promise.all([
      prisma.task.findMany({ where, orderBy: { order: 'asc' }, take: 200 }),
      prisma.task.count({ where }),
    ]);
    return { data, count };
  }

  async findOne(req: any, id: string) {
    const where = { ...tenantWhere(req), id };
    const task = await prisma.task.findFirst({ where });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async create(req: any, dto: any) {
    const data: any = { ...dto, tenantId: req.tenantId || req.user?.tenantId };
    if (dto.dueDate) data.dueDate = new Date(dto.dueDate);
    return prisma.task.create({ data });
  }

  async update(req: any, id: string, dto: any) {
    const where = { ...tenantWhere(req), id };
    const existing = await prisma.task.findFirst({ where });
    if (!existing) throw new NotFoundException('Task not found');
    const data: any = { ...dto };
    if (dto.dueDate) data.dueDate = new Date(dto.dueDate);
    if (dto.completedAt) data.completedAt = new Date(dto.completedAt);
    if (dto.status === 'DONE' && !dto.completedAt) data.completedAt = new Date();
    return prisma.task.update({ where: { id }, data });
  }

  async remove(req: any, id: string) {
    const where = { ...tenantWhere(req), id };
    const existing = await prisma.task.findFirst({ where });
    if (!existing) throw new NotFoundException('Task not found');
    return prisma.task.delete({ where: { id } });
  }

  async getKanban(req: any, projectId?: string) {
    const where: any = { ...tenantWhere(req) };
    if (projectId) where.projectId = projectId;
    const tasks = await prisma.task.findMany({ where, orderBy: { order: 'asc' } });
    const columns = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];
    const board: Record<string, any[]> = {};
    columns.forEach(col => { board[col] = []; });
    tasks.forEach((t: any) => {
      const col = t.boardColumn || t.status || 'TODO';
      if (!board[col]) board[col] = [];
      board[col].push(t);
    });
    return { columns, board };
  }
}
