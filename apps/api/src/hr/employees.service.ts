import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma, withTenant } from '@scc/database';
import { pagedResult, parsePagination } from './pagination';
import { defaultLifecycleTasks } from './hr-lifecycle-defaults';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class EmployeesService {
  constructor(private readonly authService: AuthService) {}
  async findAll(tenantId: string, filters?: { status?: string; departmentId?: string; search?: string; page?: string; limit?: string }) {
    const where = withTenant({}, tenantId);
    if (filters?.status) where.status = filters.status;
    if (filters?.departmentId) where.departmentId = filters.departmentId;
    if (filters?.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { employeeCode: { contains: filters.search, mode: 'insensitive' } },
        { jobTitle: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const { page, limit, skip } = parsePagination(filters);
    const [data, count] = await Promise.all([
      prisma.employee.findMany({ where, include: { user: { select: { id: true, email: true, status: true } } }, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.employee.count({ where }),
    ]);
    return pagedResult(data, count, page, limit);
  }

  async findOne(tenantId: string, id: string) {
    const employee = await prisma.employee.findFirst({ where: withTenant({ id }, tenantId), include: { user: { select: { id: true, email: true, status: true } } } });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  async create(tenantId: string, data: any) {
    const payload: any = { ...data, tenantId };
    if (payload.hireDate) payload.hireDate = new Date(payload.hireDate);
    if (payload.terminationDate) payload.terminationDate = new Date(payload.terminationDate);
    if (payload.departmentId) await this.assertDepartment(tenantId, payload.departmentId);
    return prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({ data: payload });
      const tasks = defaultLifecycleTasks('ONBOARDING');
      await tx.hrLifecycleCase.create({
        data: {
          tenantId,
          employeeId: employee.id,
          type: 'ONBOARDING',
          status: 'OPEN',
          startDate: employee.hireDate,
          tasks: { create: tasks.map((task) => ({ ...task, tenantId })) },
        },
      });
      return employee;
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const employee = await prisma.employee.findFirst({ where: withTenant({ id }, tenantId) });
    if (!employee) throw new NotFoundException('Employee not found');

    const payload: any = { ...data };
    if (payload.hireDate) payload.hireDate = new Date(payload.hireDate);
    if (payload.terminationDate) payload.terminationDate = new Date(payload.terminationDate);
    if (payload.departmentId) await this.assertDepartment(tenantId, payload.departmentId);

    return prisma.employee.update({ where: { id }, data: payload });
  }

  async linkUser(tenantId: string, id: string, userId: string) {
    const [employee, user] = await Promise.all([
      prisma.employee.findFirst({ where: withTenant({ id }, tenantId) }),
      prisma.user.findFirst({ where: { id: userId, tenantId, status: 'ACTIVE' } }),
    ]);
    if (!employee) throw new NotFoundException('Employee not found');
    if (!user) throw new NotFoundException('Active tenant user not found');
    const linked = await prisma.employee.findFirst({ where: { userId } });
    if (linked && linked.id !== employee.id) throw new ConflictException('User is already linked to another employee');
    return prisma.employee.update({ where: { id }, data: { userId } });
  }

  async provisionSelfService(tenantId: string, id: string) {
    const employee = await prisma.employee.findFirst({
      where: withTenant({ id }, tenantId),
      include: { user: { select: { id: true, email: true, status: true, tenantId: true } } },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    if (employee.status === 'TERMINATED') {
      throw new ConflictException('Cannot provision self-service for a terminated employee');
    }
    const email = employee.email?.trim().toLowerCase();
    if (!email) throw new BadRequestException('Employee email is required for self-service invitation');

    const sendPendingInvitation = async (userId: string) => {
      const delivery = await this.authService.sendAccountSetupEmail(userId);
      return { userId, status: 'PENDING_VERIFICATION', invitationSent: delivery.sent };
    };

    if (employee.userId) {
      const linkedUser = await prisma.user.findFirst({
        where: { id: employee.userId, tenantId },
        select: { id: true, status: true },
      });
      if (!linkedUser) throw new ConflictException('Linked employee user is outside tenant or missing');
      if (linkedUser.status === 'ACTIVE') {
        return { userId: linkedUser.id, status: 'ACTIVE', invitationSent: false, linkedExisting: true };
      }
      if (linkedUser.status === 'PENDING_VERIFICATION') {
        return sendPendingInvitation(linkedUser.id);
      }
      throw new ConflictException('Linked employee user is not eligible for activation');
    }

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, tenantId: true, status: true },
    });

    if (existing) {
      if (existing.tenantId !== tenantId) {
        throw new ConflictException('Email is already registered in another tenant');
      }
      const linkedElsewhere = await prisma.employee.findFirst({ where: { userId: existing.id } });
      if (linkedElsewhere && linkedElsewhere.id !== employee.id) {
        throw new ConflictException('User is already linked to another employee');
      }
      if (!['ACTIVE', 'PENDING_VERIFICATION'].includes(existing.status)) {
        throw new ConflictException('Existing user is not eligible for self-service');
      }
      await prisma.employee.update({ where: { id: employee.id }, data: { userId: existing.id } });
      if (existing.status === 'ACTIVE') {
        return { userId: existing.id, status: 'ACTIVE', invitationSent: false, linkedExisting: true };
      }
      return sendPendingInvitation(existing.id);
    }

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          firstName: employee.firstName,
          lastName: employee.lastName,
          phone: employee.phone || null,
          role: 'USER',
          status: 'PENDING_VERIFICATION',
          tenantId,
        },
        select: { id: true },
      });
      await tx.employee.update({ where: { id: employee.id }, data: { userId: created.id } });
      return created;
    });

    return sendPendingInvitation(user.id);
  }

  async unlinkUser(tenantId: string, id: string) {
    const employee = await prisma.employee.findFirst({ where: withTenant({ id }, tenantId) });
    if (!employee) throw new NotFoundException('Employee not found');
    return prisma.employee.update({ where: { id }, data: { userId: null } });
  }

  async terminate(tenantId: string, id: string) {
    const employee = await prisma.employee.findFirst({ where: withTenant({ id }, tenantId) });
    if (!employee) throw new NotFoundException('Employee not found');
    return prisma.employee.update({
      where: { id },
      data: {
        status: 'TERMINATED',
        terminationDate: employee.terminationDate || new Date(),
      },
    });
  }

  private async assertDepartment(tenantId: string, departmentId: string) {
    const department = await prisma.department.findFirst({ where: withTenant({ id: departmentId }, tenantId) });
    if (!department) throw new NotFoundException('Department not found');
  }
}
