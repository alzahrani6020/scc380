import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@scc/database';
import { EmployeesService } from '../src/hr/employees.service';
import { HrSelfService } from '../src/hr/self-service.service';
import { HrRequestsService } from '../src/hr/hr-requests.service';
import { HrLifecycleService } from '../src/hr/hr-lifecycle.service';

test(
  'HR self-service lifecycle: explicit user link -> self profile -> request -> onboarding tasks',
  { skip: process.env.CRM_DB_E2E !== '1' ? 'CRM_DB_E2E=1 is required' : false },
  async () => {
    const run = `${process.pid}-${Date.now()}`;
    const tenantA = await prisma.tenant.create({ data: { name: `HR Self A ${run}`, slug: `hr-self-a-${run}` } });
    const tenantB = await prisma.tenant.create({ data: { name: `HR Self B ${run}`, slug: `hr-self-b-${run}` } });
    const userA = await prisma.user.create({
      data: { email: `self-a-${run}@example.test`, firstName: 'Self', lastName: 'A', tenantId: tenantA.id, role: 'USER', status: 'ACTIVE' },
    });
    const userB = await prisma.user.create({
      data: { email: `self-b-${run}@example.test`, firstName: 'Self', lastName: 'B', tenantId: tenantB.id, role: 'USER', status: 'ACTIVE' },
    });

    const employees = new EmployeesService();
    const selfService = new HrSelfService();
    const requests = new HrRequestsService();
    const lifecycle = new HrLifecycleService();
    const adminReq: any = { user: { tenantId: tenantA.id, userId: `admin-${run}`, role: 'ADMIN' } };
    const selfReq: any = { user: { tenantId: tenantA.id, userId: userA.id, role: 'USER' } };

    try {
      const employee = await employees.create(tenantA.id, {
        employeeCode: `SELF-${run}`,
        firstName: 'Employee',
        lastName: 'Self',
        email: `employee-${run}@example.test`,
        hireDate: '2026-11-01T00:00:00.000Z',
        basicSalary: 9000,
      });

      const onboarding = await prisma.hrLifecycleCase.findFirstOrThrow({
        where: { tenantId: tenantA.id, employeeId: employee.id, type: 'ONBOARDING' },
        include: { tasks: true },
      });
      assert.equal(onboarding.status, 'OPEN');
      assert.ok(onboarding.tasks.length >= 5);

      await assert.rejects(
        () => employees.linkUser(tenantA.id, employee.id, userB.id),
        /Active tenant user not found/,
      );

      const linked = await employees.linkUser(tenantA.id, employee.id, userA.id);
      assert.equal(linked.userId, userA.id);

      const me = await selfService.getMe(selfReq);
      assert.equal(me.employee.id, employee.id);
      assert.equal(me.employee.userId, userA.id);

      const updated = await selfService.updateProfile(selfReq, {
        phone: '0500000000',
        emergencyContactName: 'Emergency',
        emergencyContactPhone: '0511111111',
        basicSalary: 1,
      });
      assert.equal(updated.phone, '0500000000');
      const salaryCheck = await prisma.employee.findUniqueOrThrow({ where: { id: employee.id } });
      assert.equal(Number(salaryCheck.basicSalary), 9000);

      const request = await requests.createSelf(selfReq, {
        type: 'EMPLOYMENT_CERTIFICATE',
        subject: 'Employment certificate',
        details: { language: 'ar' },
      });
      assert.equal(request.employeeId, employee.id);
      assert.equal(request.status, 'PENDING');

      const reviewed = await requests.review(adminReq, request.id, 'APPROVED', 'Ready for issuance');
      assert.equal(reviewed.status, 'APPROVED');
      assert.equal(reviewed.reviewedById, adminReq.user.userId);

      const firstTask = onboarding.tasks.sort((a, b) => a.order - b.order)[0];
      const updatedCase = await lifecycle.updateTask(adminReq, onboarding.id, firstTask.id, { status: 'DONE' });
      assert.equal(updatedCase.tasks.find((t: any) => t.id === firstTask.id)?.status, 'DONE');
      assert.equal(updatedCase.status, 'IN_PROGRESS');

      const selfRequests = await requests.listSelf(selfReq);
      assert.equal(selfRequests.length, 1);
      assert.equal(selfRequests[0].status, 'APPROVED');
    } finally {
      await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
      await prisma.tenant.deleteMany({ where: { id: { in: [tenantA.id, tenantB.id] } } });
    }
  },
);
