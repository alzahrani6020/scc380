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
    if (['COMPLETED', 'CANCELLED'].includes(lifecycle.status)) {
      throw new ConflictException('Lifecycle case is closed');
    }
    const incomplete = lifecycle.tasks.filter((task) => !['DONE','SKIPPED'].includes(task.status));
    if (incomplete.length) throw new ConflictException('All lifecycle tasks must be done or skipped');

    if (lifecycle.type === 'ONBOARDING') {
      const readiness = await this.getOnboardingReadiness(tenantId, lifecycle.employeeId);
      if (!readiness.ready) {
        throw new ConflictException(readiness.reason);
      }
    }

    if (lifecycle.type === 'OFFBOARDING') {
      const readiness = await this.getOffboardingReadiness(tenantId, lifecycle.employeeId);
      if (!readiness.ready) {
        throw new ConflictException(readiness.reason);
      }
    }

    const scope = { ...tenantWhere(tenantId), id };
    const updated = await prisma.hrLifecycleCase.updateMany({
      where: { ...scope, status: { in: ['OPEN', 'IN_PROGRESS'] } },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
    if (updated.count !== 1) throw new ConflictException('Lifecycle case is closed');
    return prisma.hrLifecycleCase.findFirstOrThrow({ where: scope });
  }

  async finalizeExit(req: any, id: string, dto: {
    confirmation: string; lastWorkingDate: string; reason: string;
  }) {
    const tenantId=req.user?.tenantId;
    const actor=req.user?.userId || req.user?.sub || req.user?.id;
    if(!tenantId || !actor)throw new BadRequestException('Authenticated tenant operator required');
    if(dto?.confirmation!=='FINALIZE_EMPLOYMENT_EXIT') {
      throw new BadRequestException('Explicit finalization confirmation required');
    }
    const reason=dto.reason?.trim()||'';
    const dateText=dto.lastWorkingDate||'';
    if(reason.length<10 || reason.length>1000 || !/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
      throw new BadRequestException('Documented termination reason and ISO date are required');
    }
    const terminationDate=new Date(dateText+'T00:00:00.000Z');
    if(!Number.isFinite(terminationDate.valueOf()) ||
       terminationDate.toISOString().slice(0,10)!==dateText ||
       dateText>new Date().toISOString().slice(0,10)) {
      throw new BadRequestException('Termination date cannot be invalid or in the future');
    }
    return prisma.$transaction(async tx=>{
      const lifecycle=await tx.hrLifecycleCase.findFirst({
        where:{tenantId,id,type:'OFFBOARDING',status:{in:['OPEN','IN_PROGRESS']}},
        include:{tasks:true},
      });
      if(!lifecycle)throw new NotFoundException('Open offboarding lifecycle case not found');
      if(!lifecycle.tasks.length || lifecycle.tasks.some(task=>task.status!=='DONE')) {
        throw new ConflictException('All offboarding tasks must be explicitly completed before finalization');
      }
      const employee=await tx.employee.findFirst({
        where:{tenantId,id:lifecycle.employeeId},
        select:{id:true,userId:true,status:true,terminationDate:true,hireDate:true},
      });
      if(!employee || employee.status==='TERMINATED') {
        throw new ConflictException('Employee must exist and not already be terminated');
      }
      if(terminationDate<employee.hireDate)throw new BadRequestException('Last working date precedes hire date');
      const custody=await tx.assetCustodyAssignment.count({
        where:{tenantId,employeeId:employee.id,status:'ACTIVE'},
      });
      if(custody>0)throw new ConflictException('Active custody assignments must be returned first');
      if(employee.userId===actor)throw new ConflictException('Cannot deactivate the operator own account');
      if(employee.userId) {
        const target=await tx.user.findFirst({
          where:{tenantId,id:employee.userId},
          select:{id:true,role:true},
        });
        if(!target)throw new ConflictException('Employee account must belong to the same tenant');
        if(['ADMIN','SUPER_ADMIN'].includes(target.role)) {
          throw new ConflictException('Administrative account exit requires separate identity-governance approval');
        }
        await tx.user.updateMany({
          where:{tenantId,id:target.id},data:{status:'INACTIVE'},
        });
        await tx.session.updateMany({
          where:{userId:target.id,revokedAt:null},data:{revokedAt:new Date()},
        });
      }
      await tx.employee.updateMany({
        where:{tenantId,id:employee.id,status:{not:'TERMINATED'}},
        data:{status:'TERMINATED',terminationDate},
      });
      await tx.employeeContract.updateMany({
        where:{tenantId,employeeId:employee.id,status:'ACTIVE'},
        data:{status:'TERMINATED',terminatedAt:terminationDate,terminationReason:reason},
      });
      const changed=await tx.hrLifecycleCase.updateMany({
        where:{tenantId,id,status:{in:['OPEN','IN_PROGRESS']}},
        data:{status:'COMPLETED',completedAt:new Date()},
      });
      if(changed.count!==1)throw new ConflictException('Offboarding case changed concurrently');
      const operator=await tx.user.findFirst({
        where:{tenantId,id:actor},select:{id:true},
      });
      await tx.auditLog.create({
        data:{
          tenantId,userId:operator?.id||null,action:'HR_EMPLOYMENT_EXIT_FINALIZED',
          entityType:'EMPLOYEE',entityId:employee.id,
          oldValues:{status:employee.status,terminationDate:employee.terminationDate?.toISOString()||null},
          newValues:{status:'TERMINATED',terminationDate:dateText,reason,
            lifecycleCaseId:id,actorUserId:actor,accessRevoked:!!employee.userId},
        },
      });
      return tx.hrLifecycleCase.findFirstOrThrow({where:{tenantId,id},include:{tasks:true}});
    },{isolationLevel:'Serializable'});
  }

  async cancel(req: any, id: string) {
    const scope = { ...tenantWhere(req.user?.tenantId), id };
    const updated = await prisma.hrLifecycleCase.updateMany({
      where: { ...scope, status: { in: ['OPEN', 'IN_PROGRESS'] } },
      data: { status: 'CANCELLED', completedAt: null },
    });
    if (updated.count !== 1) {
      const item = await prisma.hrLifecycleCase.findFirst({ where: scope, select: { id: true } });
      if (!item) throw new NotFoundException('HR lifecycle case not found');
      throw new ConflictException('Lifecycle case is closed');
    }
    return prisma.hrLifecycleCase.findFirstOrThrow({ where: scope });
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
      if (lifecycle?.type === 'ONBOARDING') {
        const readiness = await this.getOnboardingReadiness(tenantId, lifecycle.employeeId);
        canComplete = readiness.ready;
      }
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

  private async getOnboardingReadiness(tenantId: string, employeeId: string) {
    const employee = await prisma.employee.findFirst({
      where: { ...tenantWhere(tenantId), id: employeeId },
      select: { status: true, terminationDate: true, userId: true },
    });
    if (!employee || employee.status !== 'ACTIVE' || employee.terminationDate) {
      return { ready: false, reason: 'Employee must be active before onboarding completion' };
    }

    const contract = await prisma.employeeContract.findFirst({
      where: { tenantId, employeeId, status: 'ACTIVE' },
      orderBy: { startDate: 'desc' },
      select: { id: true, signedAt: true },
    });
    if (!contract || !contract.signedAt) {
      return { ready: false, reason: 'Active signed employment contract is required before onboarding completion' };
    }

    if (!employee.userId) {
      return { ready: false, reason: 'Employee must be linked to an active tenant user before onboarding completion' };
    }
    const user = await prisma.user.findFirst({
      where: { id: employee.userId, tenantId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!user) {
      return { ready: false, reason: 'Linked employee user must be active in the same tenant' };
    }

    return { ready: true, reason: '' };
  }

  private async getOffboardingReadiness(tenantId: string, employeeId: string) {
    // Administrative clearance and payroll settlement are independent workflows.
    // Never assert that employee entitlements were paid merely to finish offboarding.
    const [activeCustody, employee, activeContracts] = await Promise.all([
      prisma.assetCustodyAssignment.count({
        where: { ...tenantWhere(tenantId), employeeId, status: 'ACTIVE' },
      }),
      prisma.employee.findFirst({
        where: { ...tenantWhere(tenantId), id: employeeId },
        select: { status: true, terminationDate: true, userId: true },
      }),
      prisma.employeeContract.count({
        where: { tenantId, employeeId, status: 'ACTIVE' },
      }),
    ]);

    if (activeCustody > 0) {
      return { ready: false, reason: 'Employee still has active asset custody assignments' };
    }
    if (!employee || employee.status !== 'TERMINATED' || !employee.terminationDate) {
      return { ready: false, reason: 'Employee must be terminated before offboarding completion' };
    }
    if (activeContracts > 0) {
      return { ready: false, reason: 'Active employment contracts must be terminated before offboarding completion' };
    }

    if (employee.userId) {
      const [activeUser, activeSessions] = await Promise.all([
        prisma.user.count({ where: { id: employee.userId, tenantId, status: 'ACTIVE' } }),
        prisma.session.count({
          where: { userId: employee.userId, revokedAt: null, expiresAt: { gt: new Date() } },
        }),
      ]);
      if (activeUser > 0) {
        return { ready: false, reason: 'Active employee user must be deactivated before offboarding completion' };
      }
      if (activeSessions > 0) {
        return { ready: false, reason: 'Employee login sessions must be revoked before offboarding completion' };
      }
    }

    return { ready: true, reason: '' };
  }

  private async assertAssignedUser(tenantId: string, userId?: string) {
    if (!userId) return;
    const user = await prisma.user.findFirst({ where: { id: userId, tenantId, status: 'ACTIVE' } });
    if (!user) throw new BadRequestException('Assigned user must be active in the same tenant');
  }
}
