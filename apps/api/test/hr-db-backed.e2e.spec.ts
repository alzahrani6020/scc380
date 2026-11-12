import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@scc/database';
import { EmployeesService } from '../src/hr/employees.service';
import { LeavesService } from '../src/hr/leaves.service';
import { AttendancesService } from '../src/hr/attendances.service';
import { PayrollsService } from '../src/hr/payrolls.service';
import { ShiftsService } from '../src/hr/shifts.service';
import { ContractsService } from '../src/hr/contracts.service';
import { LeavePoliciesService } from '../src/hr/leave-policies.service';
import { LeaveBalancesService } from '../src/hr/leave-balances.service';
import { PayrollRunsService } from '../src/hr/payroll-runs.service';

test(
  'HR DB-backed E2E validates schema, tenant isolation and core lifecycles',
  { skip: process.env.CRM_DB_E2E !== '1' ? 'CRM_DB_E2E=1 is required' : false },
  async () => {
    const run = `${process.pid}-${Date.now()}`;
    const tenantA = await prisma.tenant.create({
      data: { name: `HR E2E A ${run}`, slug: `hr-e2e-a-${run}` },
    });
    const tenantB = await prisma.tenant.create({
      data: { name: `HR E2E B ${run}`, slug: `hr-e2e-b-${run}` },
    });

    const employees = new EmployeesService();
    const leaves = new LeavesService();
    const attendance = new AttendancesService();
    const payrolls = new PayrollsService();
    const shifts = new ShiftsService();
    const contracts = new ContractsService();
    const leavePolicies = new LeavePoliciesService();
    const leaveBalances = new LeaveBalancesService();
    const payrollRuns = new PayrollRunsService();

    const reqA: any = { user: { tenantId: tenantA.id, userId: `approver-${run}`, role: 'ADMIN' } };
    const reqB: any = { user: { tenantId: tenantB.id, userId: `approver-b-${run}`, role: 'ADMIN' } };

    try {
      const employeeA = await employees.create(tenantA.id, {
        employeeCode: `HRA-${run}`,
        firstName: 'Ali',
        lastName: 'HR',
        hireDate: '2026-11-01T00:00:00.000Z',
        basicSalary: 10000,
      });
      const employeeB = await employees.create(tenantB.id, {
        employeeCode: `HRA-${run}`,
        firstName: 'Badr',
        lastName: 'HR',
        hireDate: '2026-11-01T00:00:00.000Z',
        basicSalary: 9000,
      });

      const listA = await employees.findAll(tenantA.id, { page: '1', limit: '25' });
      assert.ok(listA.data.some((row: any) => row.id === employeeA.id));
      assert.ok(!listA.data.some((row: any) => row.id === employeeB.id));

      const annualPolicy = await leavePolicies.create(reqA, {
        type: 'ANNUAL',
        name: 'Annual Leave',
        annualEntitlement: 5,
        maxCarryForward: 2,
        requiresApproval: true,
        isActive: true,
      });
      assert.equal(annualPolicy.annualEntitlement, 5);

      const initializedBalances = await leaveBalances.initialize(reqA, employeeA.id, 2026);
      assert.equal(initializedBalances.length, 1);
      assert.equal(initializedBalances[0].entitlement, 5);

      await assert.rejects(
        () => leaves.create(reqA, {
          employeeId: employeeB.id,
          type: 'ANNUAL',
          startDate: '2026-11-20T00:00:00.000Z',
          endDate: '2026-11-21T00:00:00.000Z',
          days: 2,
        }),
        /Employee not found/,
      );

      const leaveA = await leaves.create(reqA, {
        employeeId: employeeA.id,
        type: 'ANNUAL',
        startDate: '2026-11-20T00:00:00.000Z',
        endDate: '2026-11-21T00:00:00.000Z',
        days: 2,
        reason: 'E2E',
      });
      const reservedBalance = await prisma.leaveBalance.findUniqueOrThrow({
        where: {
          tenantId_employeeId_type_year: {
            tenantId: tenantA.id,
            employeeId: employeeA.id,
            type: 'ANNUAL',
            year: 2026,
          },
        },
      });
      assert.equal(reservedBalance.pending, 2);
      assert.equal(reservedBalance.used, 0);

      const approvedLeave = await leaves.update(reqA, leaveA.id, { status: 'APPROVED' });
      assert.equal(approvedLeave.status, 'APPROVED');
      assert.equal(approvedLeave.approvedById, reqA.user.userId);
      assert.ok(approvedLeave.approvedAt);

      const usedBalance = await prisma.leaveBalance.findUniqueOrThrow({
        where: {
          tenantId_employeeId_type_year: {
            tenantId: tenantA.id,
            employeeId: employeeA.id,
            type: 'ANNUAL',
            year: 2026,
          },
        },
      });
      assert.equal(usedBalance.pending, 0);
      assert.equal(usedBalance.used, 2);

      await assert.rejects(
        () => leaves.create(reqA, {
          employeeId: employeeA.id,
          type: 'ANNUAL',
          startDate: '2026-12-01T00:00:00.000Z',
          endDate: '2026-12-05T00:00:00.000Z',
          days: 4,
        }),
        /Insufficient leave balance/,
      );

      const adjusted = await leaveBalances.adjust(reqA, usedBalance.id, 2, 'E2E adjustment');
      assert.equal(adjusted.adjustment, 2);
      const adjustmentLog = await prisma.leaveBalanceAdjustment.findFirst({
        where: { balanceId: usedBalance.id, amount: 2 },
      });
      assert.ok(adjustmentLog);

      const attendanceA = await attendance.create(reqA, {
        employeeId: employeeA.id,
        date: '2026-11-12T00:00:00.000Z',
        status: 'PRESENT',
        checkIn: '2026-11-12T05:00:00.000Z',
        checkOut: '2026-11-12T13:00:00.000Z',
        workHours: 8,
      });
      assert.equal(attendanceA.tenantId, tenantA.id);

      const shiftA = await shifts.create(reqA, {
        employeeId: employeeA.id,
        name: 'E2E Shift',
        startTime: '2026-11-12T05:00:00.000Z',
        endTime: '2026-11-12T13:00:00.000Z',
        isRecurring: false,
      });
      assert.equal(shiftA.employeeId, employeeA.id);

      const payrollA = await payrolls.create(reqA, {
        employeeId: employeeA.id,
        month: 11,
        year: 2026,
        basicSalary: 10000,
        housingAllowance: 2500,
        transportAllowance: 1000,
        otherAllowances: 0,
        gosiDeduction: 1000,
        taxDeduction: 0,
        otherDeductions: 0,
        netSalary: 12500,
      });
      assert.equal(payrollA.status, 'DRAFT');

      await assert.rejects(
        () => payrolls.create(reqA, {
          employeeId: employeeA.id,
          month: 11,
          year: 2026,
          basicSalary: 10000,
          housingAllowance: 0,
          transportAllowance: 0,
          otherAllowances: 0,
          gosiDeduction: 0,
          taxDeduction: 0,
          otherDeductions: 0,
          netSalary: 10000,
        }),
        /Payroll already exists for this employee and period/,
      );

      await assert.rejects(
        () => payrolls.update(reqA, payrollA.id, { status: 'PAID' }),
        /Payroll must be approved before payment/,
      );

      const approvedPayroll = await payrolls.update(reqA, payrollA.id, { status: 'APPROVED' });
      assert.equal(approvedPayroll.status, 'APPROVED');

      const paidPayroll = await payrolls.update(reqA, payrollA.id, { status: 'PAID' });
      assert.equal(paidPayroll.status, 'PAID');
      assert.ok(paidPayroll.paidAt);

      await assert.rejects(
        () => payrolls.update(reqA, payrollA.id, { netSalary: 1 }),
        /Paid payroll is locked/,
      );

      const foreignPayroll = await payrolls.findAll(reqB, { employeeId: employeeA.id });
      assert.equal(foreignPayroll.count, 0);

      const contract = await contracts.create(reqA, {
        employeeId: employeeA.id,
        contractNumber: `CTR-${run}`,
        type: 'FIXED_TERM',
        startDate: '2026-11-01T00:00:00.000Z',
        endDate: '2027-10-31T00:00:00.000Z',
        jobTitle: 'Senior Analyst',
        basicSalary: 12000,
        housingAllowance: 3000,
        transportAllowance: 1200,
      });
      assert.equal(contract.status, 'DRAFT');

      const activeContract = await contracts.activate(reqA, contract.id);
      assert.equal(activeContract.status, 'ACTIVE');

      const employeeAfterContract = await prisma.employee.findUniqueOrThrow({ where: { id: employeeA.id } });
      assert.equal(employeeAfterContract.jobTitle, 'Senior Analyst');
      assert.equal(Number(employeeAfterContract.basicSalary), 12000);

      const secondContract = await contracts.create(reqA, {
        employeeId: employeeA.id,
        contractNumber: `CTR2-${run}`,
        type: 'FIXED_TERM',
        startDate: '2027-11-01T00:00:00.000Z',
        endDate: '2028-10-31T00:00:00.000Z',
      });
      await assert.rejects(
        () => contracts.activate(reqA, secondContract.id),
        /Employee already has an active contract/,
      );

      const terminatedContract = await contracts.terminate(reqA, contract.id, 'E2E termination');
      assert.equal(terminatedContract.status, 'TERMINATED');
      assert.ok(terminatedContract.terminatedAt);

      const payrollRun = await payrollRuns.create(reqA, { year: 2026, month: 12, notes: 'E2E payroll run' });
      assert.equal(payrollRun.status, 'DRAFT');
      assert.equal(payrollRun.employeeCount, 1);
      assert.equal(payrollRun.items.length, 1);
      assert.equal(payrollRun.items[0].employeeId, employeeA.id);

      const editedRunItem = await payrollRuns.updateItem(reqA, payrollRun.id, payrollRun.items[0].id, {
        gosiDeduction: 1000,
        notes: 'E2E deduction',
      });
      assert.equal(Number(editedRunItem.gosiDeduction), 1000);
      assert.equal(Number(editedRunItem.netSalary), 15200);

      const approvedRun = await payrollRuns.approve(reqA, payrollRun.id);
      assert.equal(approvedRun.status, 'APPROVED');
      assert.ok(approvedRun.approvedAt);

      const paidRun = await payrollRuns.pay(reqA, payrollRun.id);
      assert.equal(paidRun.status, 'PAID');
      assert.ok(paidRun.paidAt);

      const generatedPayroll = await prisma.payroll.findFirstOrThrow({
        where: { tenantId: tenantA.id, employeeId: employeeA.id, year: 2026, month: 12 },
      });
      assert.equal(generatedPayroll.status, 'PAID');
      assert.equal(generatedPayroll.payrollRunId, payrollRun.id);
      assert.equal(Number(generatedPayroll.netSalary), 15200);

      const foreignRuns = await payrollRuns.findAll(reqB, { year: 2026, month: 12 });
      assert.equal(foreignRuns.count, 0);

      await assert.rejects(
        () => payrollRuns.create(reqA, { year: 2026, month: 12 }),
        /Payroll run already exists for this period/,
      );

      const terminated = await employees.terminate(tenantA.id, employeeA.id);
      assert.equal(terminated.status, 'TERMINATED');
      assert.ok(terminated.terminationDate);

      const leaveStillExists = await prisma.leave.findUnique({ where: { id: leaveA.id } });
      const payrollStillExists = await prisma.payroll.findUnique({ where: { id: payrollA.id } });
      assert.ok(leaveStillExists);
      assert.ok(payrollStillExists);
    } finally {
      await prisma.tenant.deleteMany({ where: { id: { in: [tenantA.id, tenantB.id] } } });
      await prisma.$disconnect();
    }
  },
);
