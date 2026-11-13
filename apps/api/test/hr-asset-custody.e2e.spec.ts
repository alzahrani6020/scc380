import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@scc/database';
import { EmployeesService } from '../src/hr/employees.service';
import { HrAssetCustodyService } from '../src/hr/asset-custody.service';
import { HrLifecycleService } from '../src/hr/hr-lifecycle.service';

test(
  'HR custody lifecycle: assign -> offboarding blocked -> return -> paid settlement -> offboarding completes',
  { skip: process.env.CRM_DB_E2E !== '1' ? 'CRM_DB_E2E=1 is required' : false },
  async () => {
    const run = `${process.pid}-${Date.now()}`;
    const tenantA = await prisma.tenant.create({ data: { name: `Custody A ${run}`, slug: `custody-a-${run}` } });
    const tenantB = await prisma.tenant.create({ data: { name: `Custody B ${run}`, slug: `custody-b-${run}` } });
    const employees = new EmployeesService();
    const custody = new HrAssetCustodyService();
    const lifecycle = new HrLifecycleService();
    const reqA: any = { user: { tenantId: tenantA.id, userId: `admin-a-${run}`, role: 'ADMIN' } };
    const reqB: any = { user: { tenantId: tenantB.id, userId: `admin-b-${run}`, role: 'ADMIN' } };

    try {
      const employee = await employees.create(tenantA.id, {
        employeeCode: `AST-${run}`,
        firstName: 'Asset',
        lastName: 'Holder',
        hireDate: '2026-11-01T00:00:00.000Z',
        basicSalary: 8000,
      });

      const category = await prisma.fixedAssetCategory.create({
        data: { tenantId: tenantA.id, name: `Laptop ${run}`, code: `LAP-${run}` },
      });
      const asset = await prisma.fixedAsset.create({
        data: {
          tenantId: tenantA.id,
          name: `Laptop ${run}`,
          code: `ASSET-${run}`,
          categoryId: category.id,
          acquisitionCost: 5000,
          currentValue: 5000,
          purchaseDate: new Date('2026-11-01T00:00:00.000Z'),
        },
      });

      const assignment = await custody.assign(reqA, {
        assetId: asset.id,
        employeeId: employee.id,
        conditionOut: 'GOOD',
      });
      assert.equal(assignment.status, 'ACTIVE');

      await assert.rejects(
        () => custody.assign(reqA, { assetId: asset.id, employeeId: employee.id }),
        /already has an active custody assignment/,
      );

      const foreign = await custody.listAssignments(reqB, { employeeId: employee.id });
      assert.equal(foreign.count, 0);

      const offboarding = await lifecycle.create(reqA, {
        employeeId: employee.id,
        type: 'OFFBOARDING',
      });

      let state: any = offboarding;
      for (const task of offboarding.tasks) {
        state = await lifecycle.updateTask(reqA, offboarding.id, task.id, { status: 'DONE' });
      }
      assert.equal(state.status, 'IN_PROGRESS');
      await assert.rejects(
        () => lifecycle.complete(reqA, offboarding.id),
        /active asset custody assignments/,
      );

      const returned = await custody.closeAssignment(reqA, assignment.id, {
        status: 'RETURNED',
        conditionIn: 'GOOD',
      });
      assert.equal(returned.status, 'RETURNED');

      await assert.rejects(
        () => lifecycle.complete(reqA, offboarding.id),
        /Paid end-service settlement is required/,
      );

      const lastWorkingDate = new Date('2026-11-13T00:00:00.000Z');
      await prisma.employee.update({
        where: { id: employee.id },
        data: { status: 'TERMINATED', terminationDate: lastWorkingDate },
      });
      await prisma.endServiceSettlement.create({
        data: {
          tenantId: tenantA.id,
          employeeId: employee.id,
          reason: 'TEST',
          initiatedBy: 'EMPLOYER',
          lastWorkingDate,
          dueDate: lastWorkingDate,
          hireDateSnapshot: new Date('2026-11-01T00:00:00.000Z'),
          serviceDays: 12,
          lastWage: 8000,
          baseAward: 0,
          awardFactor: 1,
          eosAward: 0,
          leaveEncashment: 0,
          unpaidSalary: 0,
          otherEntitlements: 0,
          compensation: 0,
          outstandingLoanBalance: 0,
          loanDeduction: 0,
          otherDeductions: 0,
          netSettlement: 0,
          status: 'PAID',
          paidAt: new Date(),
        },
      });

      const completed = await lifecycle.complete(reqA, offboarding.id);
      assert.equal(completed.status, 'COMPLETED');

      const active = await prisma.assetCustodyAssignment.count({
        where: { tenantId: tenantA.id, employeeId: employee.id, status: 'ACTIVE' },
      });
      assert.equal(active, 0);
    } finally {
      await prisma.tenant.deleteMany({ where: { id: { in: [tenantA.id, tenantB.id] } } });
    }
  },
);
