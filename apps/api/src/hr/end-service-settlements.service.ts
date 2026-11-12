import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';
import { calculateEndService } from './end-service-calculator';
import { AccountingPostingService } from '../accounting-core/accounting-posting.service';
import { defaultLifecycleTasks } from './hr-lifecycle-defaults';

const money = (value: any) => Math.round(Number(value || 0) * 100) / 100;

@Injectable()
export class EndServiceSettlementsService {
  constructor(private readonly accountingPosting: AccountingPostingService) {}

  async findAll(req: any, query: any) {
    const tenantId = req.user?.tenantId;
    const where: any = { ...tenantWhere(tenantId) };
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.status) where.status = query.status;
    const data = await prisma.endServiceSettlement.findMany({
      where,
      include: { employee: { select: { firstName: true, lastName: true, employeeCode: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return { data, count: data.length };
  }

  async findOne(req: any, id: string) {
    const item = await prisma.endServiceSettlement.findFirst({
      where: { ...tenantWhere(req.user?.tenantId), id },
      include: { employee: { select: { firstName: true, lastName: true, employeeCode: true } } },
    });
    if (!item) throw new NotFoundException('End-service settlement not found');
    return item;
  }

  async preview(req: any, dto: any) {
    const tenantId = req.user?.tenantId;
    const employee = await prisma.employee.findFirst({ where: { ...tenantWhere(tenantId), id: dto.employeeId } });
    if (!employee) throw new NotFoundException('Employee not found');

    const defaultLastWage = money(employee.basicSalary) + money(employee.housingAllowance) + money(employee.transportAllowance) + money(employee.otherAllowances);
    const lastWage = dto.lastWage !== undefined ? money(dto.lastWage) : defaultLastWage;
    const calc = calculateEndService({
      hireDate: employee.hireDate,
      lastWorkingDate: new Date(dto.lastWorkingDate),
      lastWage,
      reason: dto.reason,
      initiatedBy: dto.initiatedBy,
    });

    const loans = await prisma.employeeLoan.findMany({
      where: { ...tenantWhere(tenantId), employeeId: employee.id, status: 'ACTIVE', balance: { gt: 0 } },
      select: { balance: true },
    });
    const outstandingLoanBalance = money(loans.reduce((sum, row) => sum + money(row.balance), 0));
    const loanDeduction = dto.deductOutstandingLoans === false ? 0 : outstandingLoanBalance;
    const leaveEncashment = money(dto.leaveEncashment);
    const unpaidSalary = money(dto.unpaidSalary);
    const otherEntitlements = money(dto.otherEntitlements);
    const compensation = money(dto.compensation);
    const otherDeductions = money(dto.otherDeductions);
    const netSettlement = money(calc.eosAward + leaveEncashment + unpaidSalary + otherEntitlements + compensation - loanDeduction - otherDeductions);
    if (netSettlement < 0) throw new BadRequestException('Settlement deductions exceed employee entitlements');

    return {
      employeeId: employee.id,
      hireDateSnapshot: employee.hireDate,
      lastWage,
      ...calc,
      outstandingLoanBalance,
      loanDeduction,
      leaveEncashment,
      unpaidSalary,
      otherEntitlements,
      compensation,
      otherDeductions,
      netSettlement,
    };
  }

  async create(req: any, dto: any) {
    const tenantId = req.user?.tenantId;
    const duplicate = await prisma.endServiceSettlement.findFirst({
      where: { ...tenantWhere(tenantId), employeeId: dto.employeeId, status: { in: ['DRAFT', 'APPROVED'] } },
    });
    if (duplicate) throw new ConflictException('Employee already has an open end-service settlement');

    const p = await this.preview(req, dto);
    return prisma.$transaction(async (tx) => {
      const settlement = await tx.endServiceSettlement.create({
        data: {
          tenantId,
          employeeId: dto.employeeId,
          reason: dto.reason,
          initiatedBy: dto.initiatedBy,
          lastWorkingDate: new Date(dto.lastWorkingDate),
          dueDate: p.dueDate,
          hireDateSnapshot: p.hireDateSnapshot,
          serviceDays: p.serviceDays,
          lastWage: p.lastWage,
          baseAward: p.baseAward,
          awardFactor: p.awardFactor,
          eosAward: p.eosAward,
          leaveEncashment: p.leaveEncashment,
          unpaidSalary: p.unpaidSalary,
          otherEntitlements: p.otherEntitlements,
          compensation: p.compensation,
          outstandingLoanBalance: p.outstandingLoanBalance,
          loanDeduction: p.loanDeduction,
          otherDeductions: p.otherDeductions,
          netSettlement: p.netSettlement,
          status: 'DRAFT',
          notes: dto.notes || null,
        },
      });

      const openOffboarding = await tx.hrLifecycleCase.findFirst({
        where: {
          tenantId, employeeId: dto.employeeId, type: 'OFFBOARDING',
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
      });
      if (!openOffboarding) {
        const tasks = defaultLifecycleTasks('OFFBOARDING');
        await tx.hrLifecycleCase.create({
          data: {
            tenantId,
            employeeId: dto.employeeId,
            type: 'OFFBOARDING',
            status: 'OPEN',
            startDate: new Date(),
            targetDate: p.dueDate,
            createdById: req.user?.userId || req.user?.id || null,
            tasks: { create: tasks.map((task) => ({ ...task, tenantId })) },
          },
        });
      }
      return settlement;
    });
  }

  async approve(req: any, id: string) {
    const settlement = await prisma.endServiceSettlement.findFirst({
      where: { ...tenantWhere(req.user?.tenantId), id },
    });
    if (!settlement) throw new NotFoundException('End-service settlement not found');
    if (settlement.status !== 'DRAFT') throw new ConflictException('Only draft settlements can be approved');

    return prisma.endServiceSettlement.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedById: req.user?.userId || req.user?.sub || req.user?.id || null,
      },
    });
  }


  async postAccounting(req: any, id: string, dto: any) {
    const tenantId = req.user?.tenantId;
    const settlement = await prisma.endServiceSettlement.findFirst({
      where: { ...tenantWhere(tenantId), id },
    });
    if (!settlement) throw new NotFoundException('End-service settlement not found');
    if (!['APPROVED', 'PAID'].includes(settlement.status)) {
      throw new ConflictException('Settlement must be approved before accounting posting');
    }

    const eos = money(settlement.eosAward);
    const leave = money(settlement.leaveEncashment);
    const unpaidSalary = money(settlement.unpaidSalary);
    const otherEntitlements = money(settlement.otherEntitlements);
    const compensation = money(settlement.compensation);
    const loan = money(settlement.loanDeduction);
    const otherDeductions = money(settlement.otherDeductions);
    const net = money(settlement.netSettlement);

    if (!dto.settlementPayableAccountId) throw new BadRequestException('Settlement payable account is required');
    if (eos > 0 && !dto.eosExpenseAccountId) throw new BadRequestException('End-service expense account is required');
    if (leave > 0 && !dto.leaveEncashmentAccountId) throw new BadRequestException('Leave encashment account is required');
    if (unpaidSalary > 0 && !dto.unpaidSalaryAccountId) throw new BadRequestException('Unpaid salary account is required');
    if (otherEntitlements > 0 && !dto.otherEntitlementsAccountId) throw new BadRequestException('Other entitlements account is required');
    if (compensation > 0 && !dto.compensationAccountId) throw new BadRequestException('Compensation account is required');
    if (loan > 0 && !dto.loanReceivableAccountId) throw new BadRequestException('Employee loan receivable account is required');
    if (otherDeductions > 0 && !dto.otherDeductionAccountId) throw new BadRequestException('Other deduction account is required');

    const lines: any[] = [];
    if (eos > 0) lines.push({ accountId: dto.eosExpenseAccountId, debitAmount: eos, description: 'End-service award' });
    if (leave > 0) lines.push({ accountId: dto.leaveEncashmentAccountId, debitAmount: leave, description: 'Leave encashment' });
    if (unpaidSalary > 0) lines.push({ accountId: dto.unpaidSalaryAccountId, debitAmount: unpaidSalary, description: 'Unpaid salary settlement' });
    if (otherEntitlements > 0) lines.push({ accountId: dto.otherEntitlementsAccountId, debitAmount: otherEntitlements, description: 'Other employee entitlements' });
    if (compensation > 0) lines.push({ accountId: dto.compensationAccountId, debitAmount: compensation, description: 'Termination compensation' });
    if (net > 0) lines.push({ accountId: dto.settlementPayableAccountId, creditAmount: net, description: 'Net employee settlement payable' });
    if (loan > 0) lines.push({ accountId: dto.loanReceivableAccountId, creditAmount: loan, description: 'Employee loan receivable reduction' });
    if (otherDeductions > 0) lines.push({ accountId: dto.otherDeductionAccountId, creditAmount: otherDeductions, description: 'Settlement deductions payable' });

    if (lines.length < 2) throw new BadRequestException('Settlement has no accounting amounts to post');

    return this.accountingPosting.post({
      tenantId,
      entryNumber: `EOS-${settlement.id.slice(-10)}`,
      description: `End-service settlement for employee ${settlement.employeeId}`,
      reference: `EOS-${settlement.id}`,
      sourceType: 'END_SERVICE_SETTLEMENT',
      sourceId: settlement.id,
      lines,
    });
  }

  async pay(req: any, id: string) {
    const tenantId = req.user?.tenantId;
    const settlement = await prisma.endServiceSettlement.findFirst({
      where: { ...tenantWhere(tenantId), id },
    });
    if (!settlement) throw new NotFoundException('End-service settlement not found');
    if (settlement.status !== 'APPROVED') throw new ConflictException('Only approved settlements can be paid');

    return prisma.$transaction(async (tx) => {
      let remainingLoanDeduction = money(settlement.loanDeduction);
      if (remainingLoanDeduction > 0) {
        const loans = await tx.employeeLoan.findMany({
          where: { ...tenantWhere(tenantId), employeeId: settlement.employeeId, status: 'ACTIVE', balance: { gt: 0 } },
          orderBy: { createdAt: 'asc' },
        });
        const liveOutstanding = money(loans.reduce((sum, loan) => sum + money(loan.balance), 0));
        if (liveOutstanding + 0.001 < remainingLoanDeduction) {
          throw new ConflictException('Outstanding loan balance changed after settlement approval');
        }
        for (const loan of loans) {
          if (remainingLoanDeduction <= 0) break;
          const currentBalance = money(loan.balance);
          const applied = Math.min(currentBalance, remainingLoanDeduction);
          if (applied <= 0) continue;
          const newBalance = money(currentBalance - applied);
          await tx.employeeLoanPayment.create({
            data: {
              tenantId,
              loanId: loan.id,
              amount: applied,
              source: 'SETTLEMENT',
              settlementId: settlement.id,
              notes: 'Final settlement deduction',
            },
          });
          await tx.employeeLoan.update({
            where: { id: loan.id },
            data: { balance: newBalance, status: newBalance === 0 ? 'PAID' : 'ACTIVE' },
          });
          remainingLoanDeduction = money(remainingLoanDeduction - applied);
        }
      }

      await tx.employee.update({
        where: { id: settlement.employeeId },
        data: { status: 'TERMINATED', terminationDate: settlement.lastWorkingDate },
      });
      await tx.employeeContract.updateMany({
        where: { tenantId, employeeId: settlement.employeeId, status: 'ACTIVE' },
        data: {
          status: 'TERMINATED',
          terminatedAt: settlement.lastWorkingDate,
          terminationReason: settlement.reason,
        },
      });

      return tx.endServiceSettlement.update({
        where: { id },
        data: { status: 'PAID', paidAt: new Date() },
      });
    });
  }

  async cancelDraft(req: any, id: string) {
    const settlement = await prisma.endServiceSettlement.findFirst({
      where: { ...tenantWhere(req.user?.tenantId), id },
    });
    if (!settlement) throw new NotFoundException('End-service settlement not found');
    if (settlement.status !== 'DRAFT') throw new ConflictException('Only draft settlements can be cancelled');
    return prisma.endServiceSettlement.update({ where: { id }, data: { status: 'CANCELLED' } });
  }
}
