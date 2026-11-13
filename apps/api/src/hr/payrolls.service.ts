import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';
import { pagedResult, parsePagination } from './pagination';

@Injectable()
export class PayrollsService {
  async findAll(req: any, query: any) {
    const where: any = { ...tenantWhere(req.user?.tenantId) };
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.status) where.status = query.status;
    if (query.month) where.month = parseInt(query.month);
    if (query.year) where.year = parseInt(query.year);
    if (query.search) {
      where.employee = {
        OR: [
          { firstName: { contains: query.search, mode: 'insensitive' } },
          { lastName: { contains: query.search, mode: 'insensitive' } },
          { employeeCode: { contains: query.search, mode: 'insensitive' } },
        ],
      };
    }
    const { page, limit, skip } = parsePagination(query);
    const [data, count] = await Promise.all([
      prisma.payroll.findMany({
        where,
        include: { employee: { select: { firstName: true, lastName: true, employeeCode: true } } },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.payroll.count({ where }),
    ]);
    return pagedResult(data, count, page, limit);
  }

  async findOne(req: any, id: string) {
    const where = { ...tenantWhere(req.user?.tenantId), id };
    const item = await prisma.payroll.findFirst({ where, include: { employee: { select: { firstName: true, lastName: true } } } });
    if (!item) throw new NotFoundException('Payroll record not found');
    return item;
  }

  private verifyAmounts(input: any, netSalary: unknown) {
    const moneyFields = [
      'basicSalary', 'housingAllowance', 'transportAllowance', 'otherAllowances',
      'gosiDeduction', 'taxDeduction', 'otherDeductions', 'loanDeductions',
    ] as const;
    const cents: Record<string, number> = {};
    for (const key of moneyFields) {
      const raw = input[key] ?? 0;
      const amount = Number(raw);
      if (!Number.isFinite(amount) || amount < 0 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001) {
        throw new BadRequestException('Payroll ' + key + ' must be a non-negative amount with at most two decimal places');
      }
      cents[key] = Math.round(amount * 100);
    }
    const calculated = cents.basicSalary + cents.housingAllowance + cents.transportAllowance + cents.otherAllowances
      - cents.gosiDeduction - cents.taxDeduction - cents.otherDeductions - cents.loanDeductions;
    if (calculated < 0) throw new BadRequestException('Payroll net salary cannot be negative');
    const supplied = Number(netSalary);
    if (!Number.isFinite(supplied) || Math.abs(supplied * 100 - calculated) > 0.000001) {
      throw new BadRequestException('Payroll net salary does not match earnings minus deductions');
    }
    return calculated / 100;
  }

  async create(req: any, dto: any) {
    const tenantId = req.user?.tenantId;
    await this.assertEmployee(tenantId, dto.employeeId);
    const netSalary = this.verifyAmounts(dto, dto.netSalary);
    const existing = await prisma.payroll.findFirst({
      where: { ...tenantWhere(tenantId), employeeId: dto.employeeId, month: dto.month, year: dto.year },
    });
    if (existing) throw new ConflictException('Payroll already exists for this employee and period');
    return prisma.payroll.create({
      data: { ...dto, netSalary, status: 'DRAFT', tenantId },
    });
  }

  async update(req: any, id: string, dto: any) {
    const tenantId = req.user?.tenantId;
    const scope = { ...tenantWhere(tenantId), id };
    const existing = await prisma.payroll.findFirst({ where: scope });
    if (!existing) throw new NotFoundException('Payroll record not found');
    if (existing.payrollRunId) throw new ConflictException('Payroll run records must be managed through the payroll run');
    if (existing.status === 'PAID') throw new ConflictException('Paid payroll is locked');

    if (existing.status === 'APPROVED') {
      if (Object.keys(dto).some(key => key !== 'status' && key !== 'paidAt') || dto.status !== 'PAID') {
        throw new ConflictException('Approved payroll is locked except for payment');
      }
      if (dto.paidAt && !Number.isFinite(new Date(dto.paidAt).getTime())) {
        throw new BadRequestException('Invalid payment date');
      }
      const change = await prisma.payroll.updateMany({
        where: { ...scope, status: 'APPROVED', payrollRunId: null },
        data: { status: 'PAID', paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date() },
      });
      if (change.count !== 1) throw new ConflictException('Payroll status changed concurrently');
      return prisma.payroll.findFirstOrThrow({ where: scope });
    }
    if (existing.status !== 'DRAFT') throw new ConflictException('Unsupported payroll state');
    if (dto.status === 'PAID') throw new BadRequestException('Payroll must be approved before payment');
    if (dto.status && !['DRAFT', 'APPROVED'].includes(dto.status)) {
      throw new ConflictException('Draft payroll can only be approved');
    }
    if (dto.paidAt !== undefined) throw new BadRequestException('Payment date is only allowed on payment');
    const fields = [
      'basicSalary', 'housingAllowance', 'transportAllowance', 'otherAllowances',
      'gosiDeduction', 'taxDeduction', 'otherDeductions', 'loanDeductions',
    ] as const;
    const merged: Record<string, unknown> = {};
    for (const key of fields) merged[key] = dto[key] ?? existing[key];
    const computed = this.verifyAmounts(merged, dto.netSalary ?? existing.netSalary);
    const data: any = { ...dto, netSalary: computed };
    // Financial values may only be edited while the record is a draft.
    const changed = await prisma.payroll.updateMany({
      where: { ...scope, status: 'DRAFT', payrollRunId: null },
      data,
    });
    if (changed.count !== 1) throw new ConflictException('Payroll status changed concurrently');
    return prisma.payroll.findFirstOrThrow({ where: scope });
  }

  async remove(req: any, id: string) {
    const scope = { ...tenantWhere(req.user?.tenantId), id };
    const existing = await prisma.payroll.findFirst({ where: scope });
    if (!existing) throw new NotFoundException('Payroll record not found');
    if (existing.payrollRunId || existing.status !== 'DRAFT') {
      throw new ConflictException('Only standalone draft payrolls can be deleted');
    }
    const deleted = await prisma.payroll.deleteMany({
      where: { ...scope, status: 'DRAFT', payrollRunId: null },
    });
    if (deleted.count !== 1) throw new ConflictException('Payroll status changed concurrently');
    return { deleted: true, id };
  }

  private async assertEmployee(tenantId: string, employeeId: string) {
    const employee = await prisma.employee.findFirst({ where: { ...tenantWhere(tenantId), id: employeeId } });
    if (!employee) throw new NotFoundException('Employee not found');
  }
}
