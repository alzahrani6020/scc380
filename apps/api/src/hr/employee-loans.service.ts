import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';
import { AccountingPostingService } from '../accounting-core/accounting-posting.service';

const money = (value: any) => Number(value || 0);

@Injectable()
export class EmployeeLoansService {
  constructor(private readonly accountingPosting: AccountingPostingService) {}
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

  async postDisbursementAccounting(req: any, id: string, dto: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant is required');

    const loan = await prisma.employeeLoan.findFirst({
      where: { ...tenantWhere(tenantId), id },
    });
    if (!loan) throw new NotFoundException('Employee loan not found');
    if (!['ACTIVE', 'PAID'].includes(loan.status)) {
      throw new ConflictException('Loan must be approved before disbursement accounting');
    }
    if (!dto.loanReceivableAccountId || !dto.cashAccountId) {
      throw new BadRequestException('Loan receivable and bank/cash accounts are required');
    }

    const principal = money(loan.principal);
    if (principal <= 0) throw new BadRequestException('Loan principal must be positive');

    return this.accountingPosting.post({
      tenantId,
      date: loan.approvedAt || loan.createdAt,
      entryNumber: `LOAN-DISB-${loan.id.slice(-10)}`,
      description: `Employee ${loan.type === 'ADVANCE' ? 'advance' : 'loan'} disbursement`,
      reference: `EMPLOYEE-LOAN-${loan.id}`,
      sourceType: 'EMPLOYEE_LOAN_DISBURSEMENT',
      sourceId: loan.id,
      lines: [
        {
          accountId: dto.loanReceivableAccountId,
          debitAmount: principal,
          description: 'Employee loan receivable',
        },
        {
          accountId: dto.cashAccountId,
          creditAmount: principal,
          description: 'Loan disbursement from bank/cash',
        },
      ],
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

      if (!dto.cashAccountId || !dto.loanReceivableAccountId) {
        throw new BadRequestException('Bank/cash and loan receivable accounts are required for manual repayment');
      }

      const payment = await tx.employeeLoanPayment.create({
        data: { tenantId, loanId: id, amount, source: 'MANUAL', notes: dto.notes || null },
      });

      await this.accountingPosting.postInTransaction(tx, {
        tenantId,
        date: payment.paidAt,
        entryNumber: `LOAN-REPAY-${payment.id.slice(-10)}`,
        description: `Manual employee loan repayment`,
        reference: `EMPLOYEE-LOAN-PAYMENT-${payment.id}`,
        sourceType: 'EMPLOYEE_LOAN_PAYMENT',
        sourceId: payment.id,
        lines: [
          {
            accountId: dto.cashAccountId,
            debitAmount: amount,
            description: 'Loan repayment received in bank/cash',
          },
          {
            accountId: dto.loanReceivableAccountId,
            creditAmount: amount,
            description: 'Reduce employee loan receivable',
          },
        ],
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
