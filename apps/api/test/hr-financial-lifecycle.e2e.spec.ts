import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@scc/database';
import { EmployeesService } from '../src/hr/employees.service';
import { EmployeeLoansService } from '../src/hr/employee-loans.service';
import { PayrollRunsService } from '../src/hr/payroll-runs.service';
import { EndServiceSettlementsService } from '../src/hr/end-service-settlements.service';

test(
  'HR financial lifecycle: loan -> payroll installment -> final settlement',
  { skip: process.env.CRM_DB_E2E !== '1' ? 'CRM_DB_E2E=1 is required' : false },
  async () => {
    const run = `${process.pid}-${Date.now()}`;
    const tenantA = await prisma.tenant.create({ data: { name: `HR Finance A ${run}`, slug: `hr-fin-a-${run}` } });
    const tenantB = await prisma.tenant.create({ data: { name: `HR Finance B ${run}`, slug: `hr-fin-b-${run}` } });
    const employees = new EmployeesService();
    const loans = new EmployeeLoansService();
    const payrollRuns = new PayrollRunsService({} as any);
    const settlements = new EndServiceSettlementsService({} as any);
    const reqA: any = { user: { tenantId: tenantA.id, userId: `admin-a-${run}`, role: 'ADMIN' } };
    const reqB: any = { user: { tenantId: tenantB.id, userId: `admin-b-${run}`, role: 'ADMIN' } };

    try {
      const employee = await employees.create(tenantA.id, {
        employeeCode: `FIN-${run}`,
        firstName: 'Finance',
        lastName: 'Employee',
        hireDate: '2020-01-01T00:00:00.000Z',
        basicSalary: 12000,
        housingAllowance: 3000,
      });

      const draftLoan = await loans.create(reqA, {
        employeeId: employee.id,
        type: 'LOAN',
        principal: 6000,
        installmentAmount: 1500,
        startDate: '2027-01-01T00:00:00.000Z',
      });
      assert.equal(draftLoan.status, 'DRAFT');
      assert.equal(Number(draftLoan.balance), 6000);

      await assert.rejects(
        () => loans.findOne(reqB, draftLoan.id),
        /Employee loan not found/,
      );

      const activeLoan = await loans.approve(reqA, draftLoan.id);
      assert.equal(activeLoan.status, 'ACTIVE');

      const payrollRun = await payrollRuns.create(reqA, { year: 2027, month: 1 });
      assert.equal(payrollRun.items.length, 1);
      assert.equal(Number(payrollRun.items[0].loanDeductionsTotal), 1500);
      assert.equal(Number(payrollRun.items[0].netSalary), 13500);

      const snapshot = await prisma.payrollRunLoanDeduction.findFirstOrThrow({
        where: { payrollRunItemId: payrollRun.items[0].id, loanId: draftLoan.id },
      });
      assert.equal(Number(snapshot.amount), 1500);

      await payrollRuns.approve(reqA, payrollRun.id, true);
      await payrollRuns.pay(reqA, payrollRun.id);

      const afterPayroll = await prisma.employeeLoan.findUniqueOrThrow({ where: { id: draftLoan.id } });
      assert.equal(Number(afterPayroll.balance), 4500);
      const payrollPayment = await prisma.employeeLoanPayment.findFirstOrThrow({
        where: { loanId: draftLoan.id, payrollRunId: payrollRun.id, source: 'PAYROLL' },
      });
      assert.equal(Number(payrollPayment.amount), 1500);

      const payroll = await prisma.payroll.findFirstOrThrow({
        where: { tenantId: tenantA.id, employeeId: employee.id, year: 2027, month: 1 },
      });
      assert.equal(Number(payroll.loanDeductions), 1500);

      const preview = await settlements.preview(reqA, {
        employeeId: employee.id,
        reason: 'RESIGNATION',
        initiatedBy: 'EMPLOYEE',
        lastWorkingDate: '2027-01-31T00:00:00.000Z',
        deductOutstandingLoans: true,
      });
      assert.ok(Math.abs(preview.awardFactor - (2 / 3)) < 0.000001);
      assert.equal(preview.outstandingLoanBalance, 4500);
      assert.equal(preview.loanDeduction, 4500);
      assert.ok(preview.netSettlement > 0);

      const settlement = await settlements.create(reqA, {
        employeeId: employee.id,
        reason: 'RESIGNATION',
        initiatedBy: 'EMPLOYEE',
        lastWorkingDate: '2027-01-31T00:00:00.000Z',
        deductOutstandingLoans: true,
      });
      assert.equal(settlement.status, 'DRAFT');

      const foreignSettlements = await settlements.findAll(reqB, { employeeId: employee.id });
      assert.equal(foreignSettlements.count, 0);

      await settlements.approve(reqA, settlement.id);
      const paid = await settlements.pay(reqA, settlement.id);
      assert.equal(paid.status, 'PAID');

      const finalEmployee = await prisma.employee.findUniqueOrThrow({ where: { id: employee.id } });
      assert.equal(finalEmployee.status, 'TERMINATED');
      assert.equal(finalEmployee.terminationDate?.toISOString().slice(0, 10), '2027-01-31');

      const finalLoan = await prisma.employeeLoan.findUniqueOrThrow({ where: { id: draftLoan.id } });
      assert.equal(Number(finalLoan.balance), 0);
      assert.equal(finalLoan.status, 'PAID');
      const settlementPayment = await prisma.employeeLoanPayment.findFirstOrThrow({
        where: { loanId: draftLoan.id, settlementId: settlement.id, source: 'SETTLEMENT' },
      });
      assert.equal(Number(settlementPayment.amount), 4500);
    } finally {
      await prisma.tenant.deleteMany({ where: { id: { in: [tenantA.id, tenantB.id] } } });
    }
  },
);
