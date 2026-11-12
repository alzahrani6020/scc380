import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@scc/database';
import { EmployeesService } from '../src/hr/employees.service';
import { LeavesService } from '../src/hr/leaves.service';
import { AttendancesService } from '../src/hr/attendances.service';
import { PayrollsService } from '../src/hr/payrolls.service';
import { ShiftsService } from '../src/hr/shifts.service';

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
      const approvedLeave = await leaves.update(reqA, leaveA.id, { status: 'APPROVED' });
      assert.equal(approvedLeave.status, 'APPROVED');
      assert.equal(approvedLeave.approvedById, reqA.user.userId);
      assert.ok(approvedLeave.approvedAt);

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
