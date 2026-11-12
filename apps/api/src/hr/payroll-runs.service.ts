import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

function money(value: any): number {
  return Number(value || 0);
}

@Injectable()
export class PayrollRunsService {
  async findAll(req: any, query: any) {
    const where: any = { ...tenantWhere(req.user?.tenantId) };
    if (query.year) where.year = Number(query.year);
    if (query.month) where.month = Number(query.month);
    if (query.status) where.status = query.status;

    const data = await prisma.payrollRun.findMany({
      where,
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'desc' }],
    });
    return { data, count: data.length };
  }

  async findOne(req: any, id: string) {
    const item = await prisma.payrollRun.findFirst({
      where: { ...tenantWhere(req.user?.tenantId), id },
      include: {
        items: { orderBy: { employeeName: 'asc' } },
      },
    });
    if (!item) throw new NotFoundException('Payroll run not found');
    return item;
  }

  async create(req: any, dto: any) {
    const tenantId = req.user?.tenantId;
    const year = Number(dto.year);
    const month = Number(dto.month);
    this.validatePeriod(year, month);

    const existingRun = await prisma.payrollRun.findFirst({
      where: { ...tenantWhere(tenantId), year, month },
    });
    if (existingRun) throw new ConflictException('Payroll run already exists for this period');

    const existingPayroll = await prisma.payroll.findFirst({
      where: { ...tenantWhere(tenantId), year, month },
      select: { id: true },
    });
    if (existingPayroll) {
      throw new ConflictException('Individual payroll records already exist for this period');
    }

    const employees = await prisma.employee.findMany({
      where: {
        ...tenantWhere(tenantId),
        status: { in: ['ACTIVE', 'ON_LEAVE'] },
      },
      orderBy: [{ employeeCode: 'asc' }],
    });
    if (employees.length === 0) throw new BadRequestException('No eligible employees for payroll run');

    const missingSalary = employees.filter((employee) => employee.basicSalary === null);
    if (missingSalary.length > 0) {
      throw new BadRequestException(
        'Employees missing basic salary: ' + missingSalary.map((employee) => employee.employeeCode).join(', '),
      );
    }

    return prisma.$transaction(async (tx) => {
      const run = await tx.payrollRun.create({
        data: { tenantId, year, month, notes: dto.notes || null },
      });

      let grossTotal = 0;
      let deductionTotal = 0;
      let netTotal = 0;

      for (const employee of employees) {
        const basicSalary = money(employee.basicSalary);
        const housingAllowance = money(employee.housingAllowance);
        const transportAllowance = money(employee.transportAllowance);
        const otherAllowances = money(employee.otherAllowances);
        const grossSalary = basicSalary + housingAllowance + transportAllowance + otherAllowances;
        const gosiDeduction = 0;
        const taxDeduction = 0;
        const otherDeductions = 0;
        const totalDeductions = 0;
        const netSalary = grossSalary;

        await tx.payrollRunItem.create({
          data: {
            tenantId,
            payrollRunId: run.id,
            employeeId: employee.id,
            employeeCode: employee.employeeCode,
            employeeName: `${employee.firstName} ${employee.lastName}`,
            basicSalary,
            housingAllowance,
            transportAllowance,
            otherAllowances,
            gosiDeduction,
            taxDeduction,
            otherDeductions,
            grossSalary,
            totalDeductions,
            netSalary,
          },
        });

        grossTotal += grossSalary;
        deductionTotal += totalDeductions;
        netTotal += netSalary;
      }

      return tx.payrollRun.update({
        where: { id: run.id },
        data: {
          employeeCount: employees.length,
          grossTotal,
          deductionTotal,
          netTotal,
        },
        include: { items: { orderBy: { employeeName: 'asc' } } },
      });
    });
  }

  async updateItem(req: any, runId: string, itemId: string, dto: any) {
    const tenantId = req.user?.tenantId;
    const run = await prisma.payrollRun.findFirst({
      where: { ...tenantWhere(tenantId), id: runId },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    if (run.status !== 'DRAFT') throw new ConflictException('Only draft payroll runs can be edited');

    const item = await prisma.payrollRunItem.findFirst({
      where: { ...tenantWhere(tenantId), id: itemId, payrollRunId: runId },
    });
    if (!item) throw new NotFoundException('Payroll run item not found');

    const basicSalary = dto.basicSalary ?? money(item.basicSalary);
    const housingAllowance = dto.housingAllowance ?? money(item.housingAllowance);
    const transportAllowance = dto.transportAllowance ?? money(item.transportAllowance);
    const otherAllowances = dto.otherAllowances ?? money(item.otherAllowances);
    const gosiDeduction = dto.gosiDeduction ?? money(item.gosiDeduction);
    const taxDeduction = dto.taxDeduction ?? money(item.taxDeduction);
    const otherDeductions = dto.otherDeductions ?? money(item.otherDeductions);

    const values = [
      basicSalary, housingAllowance, transportAllowance, otherAllowances,
      gosiDeduction, taxDeduction, otherDeductions,
    ].map(Number);
    if (values.some((value) => !Number.isFinite(value) || value < 0)) {
      throw new BadRequestException('Payroll amounts must be non-negative numbers');
    }

    const grossSalary = Number(basicSalary) + Number(housingAllowance) + Number(transportAllowance) + Number(otherAllowances);
    const totalDeductions = Number(gosiDeduction) + Number(taxDeduction) + Number(otherDeductions);
    const netSalary = grossSalary - totalDeductions;
    if (netSalary < 0) throw new BadRequestException('Payroll net salary cannot be negative');

    return prisma.$transaction(async (tx) => {
      const updated = await tx.payrollRunItem.update({
        where: { id: itemId },
        data: {
          basicSalary,
          housingAllowance,
          transportAllowance,
          otherAllowances,
          gosiDeduction,
          taxDeduction,
          otherDeductions,
          grossSalary,
          totalDeductions,
          netSalary,
          notes: dto.notes ?? item.notes,
        },
      });
      await this.recalculateTotals(tx, runId);
      return updated;
    });
  }

  async approve(req: any, id: string) {
    const tenantId = req.user?.tenantId;
    const run = await prisma.payrollRun.findFirst({
      where: { ...tenantWhere(tenantId), id },
      include: { items: true },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    if (run.status !== 'DRAFT') throw new ConflictException('Only draft payroll runs can be approved');
    if (run.items.length === 0) throw new BadRequestException('Payroll run has no items');
    if (run.items.some((item) => money(item.netSalary) < 0)) {
      throw new BadRequestException('Payroll run contains invalid negative net salary');
    }

    const existingPayroll = await prisma.payroll.findFirst({
      where: { ...tenantWhere(tenantId), year: run.year, month: run.month },
      select: { id: true },
    });
    if (existingPayroll) throw new ConflictException('Individual payroll records already exist for this period');

    return prisma.payrollRun.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedById: req.user?.userId || req.user?.sub || req.user?.id || null,
      },
    });
  }

  async pay(req: any, id: string) {
    const tenantId = req.user?.tenantId;
    const run = await prisma.payrollRun.findFirst({
      where: { ...tenantWhere(tenantId), id },
      include: { items: true },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    if (run.status !== 'APPROVED') throw new ConflictException('Only approved payroll runs can be paid');

    const existingPayrolls = await prisma.payroll.count({
      where: { ...tenantWhere(tenantId), year: run.year, month: run.month },
    });
    if (existingPayrolls > 0) throw new ConflictException('Individual payroll records already exist for this period');

    const paidAt = new Date();
    return prisma.$transaction(async (tx) => {
      for (const item of run.items) {
        await tx.payroll.create({
          data: {
            tenantId,
            employeeId: item.employeeId,
            year: run.year,
            month: run.month,
            basicSalary: item.basicSalary,
            housingAllowance: item.housingAllowance,
            transportAllowance: item.transportAllowance,
            otherAllowances: item.otherAllowances,
            gosiDeduction: item.gosiDeduction,
            taxDeduction: item.taxDeduction,
            otherDeductions: item.otherDeductions,
            netSalary: item.netSalary,
            status: 'PAID',
            paidAt,
            payrollRunId: run.id,
          },
        });
      }

      return tx.payrollRun.update({
        where: { id },
        data: { status: 'PAID', paidAt },
        include: { items: { orderBy: { employeeName: 'asc' } } },
      });
    });
  }

  async removeDraft(req: any, id: string) {
    const run = await prisma.payrollRun.findFirst({
      where: { ...tenantWhere(req.user?.tenantId), id },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    if (run.status !== 'DRAFT') throw new ConflictException('Only draft payroll runs can be deleted');
    return prisma.payrollRun.delete({ where: { id } });
  }

  private async recalculateTotals(tx: any, runId: string) {
    const aggregate = await tx.payrollRunItem.aggregate({
      where: { payrollRunId: runId },
      _count: { _all: true },
      _sum: { grossSalary: true, totalDeductions: true, netSalary: true },
    });
    await tx.payrollRun.update({
      where: { id: runId },
      data: {
        employeeCount: aggregate._count._all,
        grossTotal: aggregate._sum.grossSalary || 0,
        deductionTotal: aggregate._sum.totalDeductions || 0,
        netTotal: aggregate._sum.netSalary || 0,
      },
    });
  }

  private validatePeriod(year: number, month: number) {
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new BadRequestException('Invalid payroll year');
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new BadRequestException('Invalid payroll month');
    }
  }
}
