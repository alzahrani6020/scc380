import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';
import { pagedResult, parsePagination } from './pagination';

@Injectable()
export class LeavesService {
  async findAll(req: any, query: any) {
    const where: any = { ...tenantWhere(req.user?.tenantId) };
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;
    if (query.search) {
      where.employee = {
        OR: [
          { firstName: { contains: query.search, mode: 'insensitive' } },
          { lastName: { contains: query.search, mode: 'insensitive' } },
          { employeeCode: { contains: query.search, mode: 'insensitive' } },
        ],
      };
    }
    if (query.from && query.to) {
      where.startDate = { gte: new Date(query.from), lte: new Date(query.to) };
    }
    const { page, limit, skip } = parsePagination(query);
    const [data, count] = await Promise.all([
      prisma.leave.findMany({
        where,
        include: { employee: { select: { firstName: true, lastName: true, employeeCode: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.leave.count({ where }),
    ]);
    return pagedResult(data, count, page, limit);
  }

  async findOne(req: any, id: string) {
    const where = { ...tenantWhere(req.user?.tenantId), id };
    const item = await prisma.leave.findFirst({
      where,
      include: { employee: { select: { firstName: true, lastName: true, employeeCode: true } } },
    });
    if (!item) throw new NotFoundException('Leave request not found');
    return item;
  }

  async create(req: any, dto: any) {
    const tenantId = req.user?.tenantId;
    await this.assertEmployee(tenantId, dto.employeeId);

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    this.assertDates(startDate, endDate, dto.days);
    const year = startDate.getUTCFullYear();
    if (endDate.getUTCFullYear() !== year) {
      throw new BadRequestException('Leave request must stay within one balance year');
    }

    const policy = await prisma.leavePolicy.findFirst({
      where: { ...tenantWhere(tenantId), type: dto.type, isActive: true },
    });
    if (!policy) throw new BadRequestException('No active leave policy configured for this type');

    return prisma.$transaction(async (tx) => {
      const balance = await this.ensureBalance(tx, tenantId, dto.employeeId, dto.type, year, policy);
      const available = this.available(balance);
      if (dto.days > available) throw new BadRequestException('Insufficient leave balance');

      const requiresApproval = policy.requiresApproval;
      const data: any = {
        ...dto,
        tenantId,
        startDate,
        endDate,
        status: requiresApproval ? 'PENDING' : 'APPROVED',
      };
      if (!requiresApproval) {
        data.approvedAt = new Date();
        data.approvedById = req.user?.userId || req.user?.sub || req.user?.id || null;
      }

      const leave = await tx.leave.create({ data });
      await tx.leaveBalance.update({
        where: { id: balance.id },
        data: requiresApproval
          ? { pending: { increment: dto.days } }
          : { used: { increment: dto.days } },
      });
      return leave;
    });
  }

  async update(req: any, id: string, dto: any) {
    const tenantId = req.user?.tenantId;
    const existing = await prisma.leave.findFirst({ where: { ...tenantWhere(tenantId), id } });
    if (!existing) throw new NotFoundException('Leave request not found');
    if (existing.status !== 'PENDING') {
      throw new BadRequestException('Only pending leave requests can be changed');
    }

    const startDate = dto.startDate ? new Date(dto.startDate) : existing.startDate;
    const endDate = dto.endDate ? new Date(dto.endDate) : existing.endDate;
    const days = dto.days ?? existing.days;
    this.assertDates(startDate, endDate, days);

    const year = existing.startDate.getUTCFullYear();
    if (startDate.getUTCFullYear() !== year || endDate.getUTCFullYear() !== year) {
      throw new BadRequestException('Leave request must stay within the original balance year');
    }

    const requestedStatus = dto.status || 'PENDING';
    if (!['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].includes(requestedStatus)) {
      throw new BadRequestException('Invalid leave status transition');
    }

    return prisma.$transaction(async (tx) => {
      const balance = await tx.leaveBalance.findUnique({
        where: {
          tenantId_employeeId_type_year: {
            tenantId,
            employeeId: existing.employeeId,
            type: existing.type,
            year,
          },
        },
      });
      if (!balance) throw new BadRequestException('Leave balance not initialized');

      const delta = days - existing.days;
      if (requestedStatus === 'PENDING') {
        if (delta > this.available(balance)) throw new BadRequestException('Insufficient leave balance');
        if (balance.pending + delta < 0) throw new BadRequestException('Invalid pending balance');
        if (delta !== 0) {
          await tx.leaveBalance.update({ where: { id: balance.id }, data: { pending: { increment: delta } } });
        }
      } else if (requestedStatus === 'APPROVED') {
        const availableIncludingReservation = this.available(balance) + existing.days;
        if (days > availableIncludingReservation) throw new BadRequestException('Insufficient leave balance');
        if (balance.pending < existing.days) throw new BadRequestException('Pending leave balance mismatch');
        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: {
            pending: { decrement: existing.days },
            used: { increment: days },
          },
        });
      } else {
        if (balance.pending < existing.days) throw new BadRequestException('Pending leave balance mismatch');
        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: { pending: { decrement: existing.days } },
        });
      }

      const data: any = {
        startDate,
        endDate,
        days,
        reason: dto.reason ?? existing.reason,
        status: requestedStatus,
      };
      if (requestedStatus === 'APPROVED') {
        data.approvedAt = new Date();
        data.approvedById = req.user?.userId || req.user?.sub || req.user?.id || null;
      }
      return tx.leave.update({ where: { id }, data });
    });
  }

  async remove(req: any, id: string) {
    const tenantId = req.user?.tenantId;
    const existing = await prisma.leave.findFirst({ where: { ...tenantWhere(tenantId), id } });
    if (!existing) throw new NotFoundException('Leave request not found');
    if (existing.status !== 'PENDING') {
      throw new BadRequestException('Only pending leave requests can be deleted');
    }

    const year = existing.startDate.getUTCFullYear();
    return prisma.$transaction(async (tx) => {
      const balance = await tx.leaveBalance.findUnique({
        where: {
          tenantId_employeeId_type_year: {
            tenantId,
            employeeId: existing.employeeId,
            type: existing.type,
            year,
          },
        },
      });
      if (!balance) throw new BadRequestException('Leave balance not initialized');
      if (balance.pending < existing.days) throw new BadRequestException('Pending leave balance mismatch');

      await tx.leaveBalance.update({
        where: { id: balance.id },
        data: { pending: { decrement: existing.days } },
      });
      return tx.leave.delete({ where: { id } });
    });
  }

  private async ensureBalance(tx: any, tenantId: string, employeeId: string, type: any, year: number, policy: any) {
    const existing = await tx.leaveBalance.findUnique({
      where: { tenantId_employeeId_type_year: { tenantId, employeeId, type, year } },
    });
    if (existing) return existing;

    let carriedForward = 0;
    const previous = await tx.leaveBalance.findUnique({
      where: { tenantId_employeeId_type_year: { tenantId, employeeId, type, year: year - 1 } },
    });
    if (previous) {
      carriedForward = Math.min(policy.maxCarryForward, Math.max(0, this.available(previous)));
    }

    return tx.leaveBalance.create({
      data: {
        tenantId,
        employeeId,
        type,
        year,
        entitlement: policy.annualEntitlement,
        carriedForward,
      },
    });
  }

  private available(balance: any) {
    return balance.entitlement + balance.carriedForward + balance.adjustment - balance.used - balance.pending;
  }

  private assertDates(startDate: Date, endDate: Date, days: number) {
    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) {
      throw new BadRequestException('Invalid leave dates');
    }
    if (endDate < startDate) throw new BadRequestException('Leave end date must not be before start date');
    if (!Number.isInteger(days) || days <= 0) throw new BadRequestException('Leave days must be a positive integer');
  }

  private async assertEmployee(tenantId: string, employeeId: string) {
    const employee = await prisma.employee.findFirst({ where: { ...tenantWhere(tenantId), id: employeeId } });
    if (!employee) throw new NotFoundException('Employee not found');
  }
}
