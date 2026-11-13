import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';
import { defaultLifecycleTasks, HrLifecycleType } from './hr-lifecycle-defaults';

const TYPES = new Set(['ONBOARDING', 'OFFBOARDING']);
const TASK_STATUSES = new Set(['TODO', 'IN_PROGRESS', 'DONE', 'SKIPPED']);

@Injectable()
export class HrLifecycleService {
  async list(req: any, query: any) {
    const tenantId = req.user?.tenantId;
    const where: any = { ...tenantWhere(tenantId) };
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;
    const data = await prisma.hrLifecycleCase.findMany({
      where,
      include: {
        employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true, status: true } },
        tasks: { orderBy: { order: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { data, count: data.length };
  }

  async findOne(req: any, id: string) {
    const item = await prisma.hrLifecycleCase.findFirst({
      where: { ...tenantWhere(req.user?.tenantId), id },
      include: {
        employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true, status: true } },
        tasks: { orderBy: { order: 'asc' } },
      },
    });
    if (!item) throw new NotFoundException('HR lifecycle case not found');
    return item;
  }

  async create(req: any, dto: any) {
    const tenantId = req.user?.tenantId;
    if (!TYPES.has(dto.type)) throw new BadRequestException('Unsupported lifecycle type');
    const employee = await prisma.employee.findFirst({ where: { ...tenantWhere(tenantId), id: dto.employeeId } });
    if (!employee) throw new NotFoundException('Employee not found');

    const existing = await prisma.hrLifecycleCase.findFirst({
      where: {
        ...tenantWhere(tenantId), employeeId: employee.id, type: dto.type,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
    });
    if (existing) throw new ConflictException('Employee already has an open lifecycle case of this type');

    const tasks = defaultLifecycleTasks(dto.type as HrLifecycleType);
    return prisma.hrLifecycleCase.create({
      data: {
        tenantId,
        employeeId: employee.id,
        type: dto.type,
        startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
        targetDate: dto.targetDate ? new Date(dto.targetDate) : null,
        notes: dto.notes || null,
        createdById: req.user?.userId || req.user?.id || null,
        tasks: { create: tasks.map((task) => ({ ...task, tenantId })) },
      },
      include: { tasks: { orderBy: { order: 'asc' } } },
    });
  }

  async addTask(req: any, caseId: string, dto: any) {
    const tenantId = req.user?.tenantId;
    const lifecycle = await prisma.hrLifecycleCase.findFirst({ where: { ...tenantWhere(tenantId), id: caseId } });
    if (!lifecycle) throw new NotFoundException('HR lifecycle case not found');
    if (['COMPLETED', 'CANCELLED'].includes(lifecycle.status)) throw new ConflictException('Lifecycle case is closed');
    await this.assertAssignedUser(tenantId, dto.assignedToId);
    const max = await prisma.hrLifecycleTask.aggregate({ where: { caseId }, _max: { order: true } });
    return prisma.hrLifecycleTask.create({
      data: {
        tenantId, caseId, title: dto.title, description: dto.description || null,
        assignedToId: dto.assignedToId || null, dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        order: dto.order ?? ((max._max.order || 0) + 1),
      },
    });
  }

  async updateTask(req: any, caseId: string, taskId: string, dto: any) {
    const tenantId = req.user?.tenantId;
    const lifecycle = await prisma.hrLifecycleCase.findFirst({ where: { ...tenantWhere(tenantId), id: caseId } });
    if (!lifecycle) throw new NotFoundException('HR lifecycle case not found');
    if (['COMPLETED', 'CANCELLED'].includes(lifecycle.status)) throw new ConflictException('Lifecycle case is closed');
    const task = await prisma.hrLifecycleTask.findFirst({ where: { ...tenantWhere(tenantId), id: taskId, caseId } });
    if (!task) throw new NotFoundException('Lifecycle task not found');
    if (dto.status && !TASK_STATUSES.has(dto.status)) throw new BadRequestException('Unsupported task status');
    await this.assertAssignedUser(tenantId, dto.assignedToId);

    const data: any = {};
    for (const field of ['title','description','status','assignedToId','notes']) {
      if (Object.prototype.hasOwnProperty.call(dto, field)) data[field] = dto[field] || null;
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'dueDate')) data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (Object.prototype.hasOwnProperty.call(dto, 'order')) data.order = dto.order;
    if (dto.status === 'DONE') {
      data.completedAt = new Date();
      data.completedById = req.user?.userId || req.user?.id || null;
    } else if (dto.status && dto.status !== 'DONE') {
      data.completedAt = null;
      data.completedById = null;
    }

    await prisma.hrLifecycleTask.update({ where: { id: taskId }, data });
    await this.recomputeCase(caseId, tenantId);
    return this.findOne(req, caseId);
  }

  async complete(req: any, id: string) {
    const tenantId = req.user?.tenantId;
    const lifecycle = await prisma.hrLifecycleCase.findFirst({
      where: { ...tenantWhere(tenantId), id },
      include: { tasks: true },
    });
    if (!lifecycle) throw new NotFoundException('HR lifecycle case not found');
    const incomplete = lifecycle.tasks.filter((task) => !['DONE','SKIPPED'].includes(task.status));
    if (incomplete.length) throw new ConflictException('All lifecycle tasks must be done or skipped');

    if (lifecycle.type === 'OFFBOARDING') {
      const readiness = await this.getOffboardingReadiness(tenantId, lifecycle.employeeId);
      if (!readiness.ready) {
        throw new ConflictException(readiness.reason);
      }
    }

    return prisma.hrLifecycleCase.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: lifecycle.completedAt || new Date() },
    });
  }

  async cancel(req: any, id: string) {
    const item = await prisma.hrLifecycleCase.findFirst({ where: { ...tenantWhere(req.user?.tenantId), id } });
    if (!item) throw new NotFoundException('HR lifecycle case not found');
    if (item.status === 'COMPLETED') throw new ConflictException('Completed lifecycle case cannot be cancelled');
    return prisma.hrLifecycleCase.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  private async recomputeCase(caseId: string, tenantId: string) {
    const tasks = await prisma.hrLifecycleTask.findMany({ where: { ...tenantWhere(tenantId), caseId } });
    const allClosed = tasks.length > 0 && tasks.every((task) => ['DONE','SKIPPED'].includes(task.status));
    const anyStarted = tasks.some((task) => task.status !== 'TODO');
    let canComplete = allClosed;

    if (allClosed) {
      const lifecycle = await prisma.hrLifecycleCase.findFirst({
        where: { ...tenantWhere(tenantId), id: caseId },
        select: { type: true, employeeId: true },
      });
      if (lifecycle?.type === 'OFFBOARDING') {
        const readiness = await this.getOffboardingReadiness(tenantId, lifecycle.employeeId);
        canComplete = readiness.ready;
      }
    }

    await prisma.hrLifecycleCase.update({
      where: { id: caseId },
      data: canComplete
        ? { status: 'COMPLETED', completedAt: new Date() }
        : { status: anyStarted ? 'IN_PROGRESS' : 'OPEN', completedAt: null },
    });
  }

  private async getOffboardingReadiness(tenantId: string, employeeId: string) {
    const [activeCustody, employee, activeContracts, paidSettlement] = await Promise.all([
      prisma.assetCustodyAssignment.count({
        where: { ...tenantWhere(tenantId), employeeId, status: 'ACTIVE' },
      }),
      prisma.employee.findFirst({
        where: { ...tenantWhere(tenantId), id: employeeId },
        select: { status: true, terminationDate: true },
      }),
      prisma.employeeContract.count({
        where: { tenantId, employeeId, status: 'ACTIVE' },
      }),
      prisma.endServiceSettlement.findFirst({
        where: { ...tenantWhere(tenantId), employeeId, status: 'PAID' },
        orderBy: { paidAt: 'desc' },
        select: { id: true, paidAt: true },
      }),
    ]);

    if (activeCustody > 0) {
      return { ready: false, reason: 'Employee still has active asset custody assignments' };
    }
    if (!paidSettlement) {
      return { ready: false, reason: 'Paid end-service settlement is required before offboarding completion' };
    }
    if (!employee || employee.status !== 'TERMINATED' || !employee.terminationDate) {
      return { ready: false, reason: 'Employee must be terminated before offboarding completion' };
    }
    if (activeContracts > 0) {
      return { ready: false, reason: 'Active employment contracts must be terminated before offboarding completion' };
    }

    return { ready: true, reason: '' };
  }

  private async assertAssignedUser(tenantId: string, userId?: string) {
    if (!userId) return;
    const user = await prisma.user.findFirst({ where: { id: userId, tenantId, status: 'ACTIVE' } });
    if (!user) throw new BadRequestException('Assigned user must be active in the same tenant');
  }
}
