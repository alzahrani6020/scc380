import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

const money = (value: any) => Number(value || 0);

@Injectable()
export class EmployeeLoansService {
  async findAll(req: any, query: any) {
    const tenantId = req.user?.tenantId;
    const where: any = { ...tenantWhere(tenantId) };
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.status) where.status = query.status;
    const data = await prisma.employeeLoan.findMany({
      where,
      include: {
        employee: { select: { firstName: true, lastName: true, employeeCode: true } },
        payments: { orderBy: { paidAt: 'desc' }, take: 10 },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { data, count: data.length };
  }

  async findOne(req: any, id: string) {
    const item = await prisma.employeeLoan.findFirst({
      where: { ...tenantWhere(req.user?.tenantId), id },
      include: {
        employee: { select: { firstName: true, lastName: true, employeeCode: true } },
        payments: { orderBy: { paidAt: 'desc' } },
      },
    });
    if (!item) throw new NotFoundException('Employee loan not found');
    return item;
  }

  async create(req: any, dto: any) {
    const tenantId = req.user?.tenantId;
    await this.assertEmployee(tenantId, dto.employeeId);
    const principal = money(dto.principal);
    const installmentAmount = money(dto.installmentAmount);
    if (principal <= 0 || installmentAmount <= 0) throw new BadRequestException('Loan amounts must be positive');
    if (installmentAmount > principal) throw new BadRequestException('Installment cannot exceed principal');

    return prisma.employeeLoan.create({
      data: {
        tenantId,
        employeeId: dto.employeeId,
        type: dto.type || 'LOAN',
        principal,
        installmentAmount,
        balance: principal,
        startDate: new Date(dto.startDate),
        status: 'DRAFT',
        notes: dto.notes || null,
      },
    });
  }

  async updateDraft(req: any, id: string, dto: any) {
    const tenantId = req.user?.tenantId;
    const loan = await prisma.employeeLoan.findFirst({ where: { ...tenantWhere(tenantId), id } });
    if (!loan) throw new NotFoundException('Employee loan not found');
    if (loan.status !== 'DRAFT') throw new ConflictException('Only draft loans can be edited');

    const principal = dto.principal !== undefined ? money(dto.principal) : money(loan.principal);
    const installmentAmount = dto.installmentAmount !== undefined ? money(dto.installmentAmount) : money(loan.installmentAmount);
    if (principal <= 0 || installmentAmount <= 0) throw new BadRequestException('Loan amounts must be positive');
    if (installmentAmount > principal) throw new BadRequestException('Installment cannot exceed principal');

    return prisma.employeeLoan.update({
      where: { id },
      data: {
        type: dto.type ?? loan.type,
        principal,
        installmentAmount,
        balance: principal,
        startDate: dto.startDate ? new Date(dto.startDate) : loan.startDate,
        notes: dto.notes ?? loan.notes,
      },
    });
  }

  async approve(req: any, id: string) {
    const tenantId = req.user?.tenantId;
    const loan = await prisma.employeeLoan.findFirst({ where: { ...tenantWhere(tenantId), id } });
    if (!loan) throw new NotFoundException('Employee loan not found');
    if (loan.status !== 'DRAFT') throw new ConflictException('Only draft loans can be approved');
    return prisma.employeeLoan.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        approvedAt: new Date(),
        approvedById: req.user?.userId || req.user?.sub || req.user?.id || null,
      },
    });
  }

  async repay(req: any, id: string, dto: any) {
    const tenantId = req.user?.tenantId;
    const amount = money(dto.amount);
    if (amount <= 0) throw new BadRequestException('Repayment amount must be positive');

    return prisma.$transaction(async (tx) => {
      const loan = await tx.employeeLoan.findFirst({ where: { ...tenantWhere(tenantId), id } });
      if (!loan) throw new NotFoundException('Employee loan not found');
      if (loan.status !== 'ACTIVE') throw new ConflictException('Only active loans can be repaid');
      const balance = money(loan.balance);
      if (amount > balance + 0.001) throw new BadRequestException('Repayment exceeds outstanding balance');
      const newBalance = Math.max(0, Math.round((balance - amount) * 100) / 100);

      await tx.employeeLoanPayment.create({
        data: { tenantId, loanId: id, amount, source: 'MANUAL', notes: dto.notes || null },
      });
      return tx.employeeLoan.update({
        where: { id },
        data: { balance: newBalance, status: newBalance === 0 ? 'PAID' : 'ACTIVE' },
      });
    });
  }

  async cancelDraft(req: any, id: string) {
    const loan = await prisma.employeeLoan.findFirst({ where: { ...tenantWhere(req.user?.tenantId), id } });
    if (!loan) throw new NotFoundException('Employee loan not found');
    if (loan.status !== 'DRAFT') throw new ConflictException('Only draft loans can be cancelled');
    return prisma.employeeLoan.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  private async assertEmployee(tenantId: string, employeeId: string) {
    const employee = await prisma.employee.findFirst({ where: { ...tenantWhere(tenantId), id: employeeId } });
    if (!employee) throw new NotFoundException('Employee not found');
  }
}
