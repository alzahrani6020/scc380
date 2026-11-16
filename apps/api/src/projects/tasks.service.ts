import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class TasksService {
  // Prevent cross-tenant project/assignee/parent references, including on
  // BONDS-scoped writes. The record's tenant is always taken from the JWT.
  private async verifyReferences(tenantId: string | undefined, dto: any) {
    if (!tenantId) throw new NotFoundException('Tenant context required');
    if (dto.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: dto.projectId, tenantId }, select: { id: true },
      });
      if (!project) throw new NotFoundException('Project not found');
    }
    if (dto.assignedToId) {
      const assignee = await prisma.user.findFirst({
        where: { id: dto.assignedToId, tenantId, deletedAt: null, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!assignee) throw new NotFoundException('Assignee not found');
    }
    if (dto.parentId) {
      const parent = await prisma.task.findFirst({
        where: { id: dto.parentId, tenantId }, select: { id: true },
      });
      if (!parent) throw new NotFoundException('Parent task not found');
    }
  }

  async findAll(req: any, query: any) {
    const where: any = { ...tenantWhere(req.user?.tenantId) };
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
    const where = { ...tenantWhere(req.user?.tenantId), id };
    const task = await prisma.task.findFirst({ where });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async create(req: any, dto: any) {
    const tenantId: string | undefined = req.user?.tenantId;
    await this.verifyReferences(tenantId, dto);
    // Never trust tenantId, ID or relations injected by an HTTP payload.
    const { title, description, projectId, status, priority, assignedToId,
      dueDate, estimatedHours, parentId } = dto;
    const data: any = { tenantId, title, description, projectId, status, priority,
      assignedToId, dueDate, estimatedHours, parentId };
    if (dueDate) data.dueDate = new Date(dueDate);
    return prisma.task.create({ data });
  }

  async update(req: any, id: string, dto: any) {
    const where = { ...tenantWhere(req.user?.tenantId), id };
    const existing = await prisma.task.findFirst({ where });
    if (!existing) throw new NotFoundException('Task not found');
    await this.verifyReferences(req.user?.tenantId, dto);
    const { title, description, status, priority, assignedToId, dueDate,
      completedAt, actualHours, boardColumn } = dto;
    const data: any = { title, description, status, priority, assignedToId,
      dueDate, completedAt, actualHours, boardColumn };
    if (dueDate) data.dueDate = new Date(dueDate);
    if (completedAt) data.completedAt = new Date(completedAt);
    if (status === 'DONE' && !completedAt) data.completedAt = new Date();
    return prisma.task.update({ where: { id }, data });
  }

  async remove(req: any, id: string) {
    const where = { ...tenantWhere(req.user?.tenantId), id };
    const existing = await prisma.task.findFirst({ where });
    if (!existing) throw new NotFoundException('Task not found');
    return prisma.task.delete({ where: { id } });
  }

  async getKanban(req: any, projectId?: string) {
    const where: any = { ...tenantWhere(req.user?.tenantId) };
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
