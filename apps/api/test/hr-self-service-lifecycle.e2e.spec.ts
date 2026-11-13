import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@scc/database';
import { EmployeesService } from '../src/hr/employees.service';
import { HrSelfService } from '../src/hr/self-service.service';
import { HrRequestsService } from '../src/hr/hr-requests.service';
import { HrLifecycleService } from '../src/hr/hr-lifecycle.service';
import { ContractsService } from '../src/hr/contracts.service';
import { PerformanceService } from '../src/hr/performance.service';
import { AuthService } from '../src/auth/auth.service';

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

    const invitationAuth = { sendAccountSetupEmail: async () => ({ sent: true }) } as any;
    const employees = new EmployeesService(invitationAuth);
    const activationAuth = new AuthService({} as any, { get: () => undefined } as any);
    const selfService = new HrSelfService();
    const requests = new HrRequestsService();
    const lifecycle = new HrLifecycleService();
    const contracts = new ContractsService();
    const performance = new PerformanceService();
    const adminReq: any = { user: { tenantId: tenantA.id, userId: `admin-${run}`, role: 'ADMIN' } };
    const selfReq: any = { user: { tenantId: tenantA.id, userId: userA.id, role: 'USER' } };
    let invitedUserId: string | undefined;

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

      const invitedEmployee = await employees.create(tenantA.id, {
        employeeCode: `INVITE-${run}`,
        firstName: 'Invited',
        lastName: 'Employee',
        email: `invited-${run}@example.test`,
        hireDate: '2026-11-01T00:00:00.000Z',
      });
      const provisioned = await employees.provisionSelfService(tenantA.id, invitedEmployee.id);
      invitedUserId = provisioned.userId;
      assert.equal(provisioned.status, 'PENDING_VERIFICATION');
      assert.equal(provisioned.invitationSent, true);

      const reprovisioned = await employees.provisionSelfService(tenantA.id, invitedEmployee.id);
      assert.equal(reprovisioned.userId, invitedUserId);
      assert.equal(
        await prisma.user.count({ where: { email: `invited-${run}@example.test` } }),
        1,
      );

      const inviteToken = `invite-token-${run}`;
      await prisma.passwordResetToken.create({
        data: {
          email: `invited-${run}@example.test`,
          token: inviteToken,
          expiresAt: new Date(Date.now() + 60_000),
          userId: invitedUserId,
        },
      });
      await activationAuth.resetPassword(inviteToken, `Invite-${run}-StrongAa1!`);
      const activatedInvite = await prisma.user.findUniqueOrThrow({ where: { id: invitedUserId } });
      assert.equal(activatedInvite.status, 'ACTIVE');
      assert.equal(activatedInvite.emailVerified, true);
      assert.ok(activatedInvite.passwordHash);

      const invitedSelf = await selfService.getMe({
        user: { tenantId: tenantA.id, userId: invitedUserId, role: 'USER' },
      });
      assert.equal(invitedSelf.employee.id, invitedEmployee.id);

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

      // Simultaneous decisions must not overwrite each other or apply across tenants.
      const racingRequest = await requests.createSelf(selfReq, {
        type: 'LETTER',
        subject: 'Race-safe HR approval',
      });
      const outcomes = await Promise.allSettled([
        requests.review(adminReq, racingRequest.id, 'APPROVED'),
        requests.cancelSelf(selfReq, racingRequest.id),
      ]);
      assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
      assert.equal(outcomes.filter((outcome) => outcome.status === 'rejected').length, 1);
      const raceResult = await prisma.hrRequest.findUniqueOrThrow({ where: { id: racingRequest.id } });
      assert.ok(['APPROVED', 'CANCELLED'].includes(raceResult.status));

      await assert.rejects(
        () => requests.review({ user: { tenantId: tenantB.id, userId: userB.id } }, racingRequest.id, 'APPROVED'),
        /HR request not found/,
      );
      await assert.rejects(
        () => requests.cancelSelf(selfReq, racingRequest.id),
        /Only pending requests can be cancelled/,
      );

      const orderedTasks = onboarding.tasks.sort((a, b) => a.order - b.order);
      let updatedCase: any = onboarding;
      for (const task of orderedTasks) {
        updatedCase = await lifecycle.updateTask(adminReq, onboarding.id, task.id, { status: 'DONE' });
      }
      assert.equal(updatedCase.status, 'IN_PROGRESS');
      await assert.rejects(
        () => lifecycle.complete(adminReq, onboarding.id),
        /Active signed employment contract is required/,
      );

      const contract = await contracts.create(adminReq, {
        employeeId: employee.id,
        contractNumber: `SELF-CONTRACT-${run}`,
        startDate: '2026-11-01T00:00:00.000Z',
        basicSalary: 9000,
      });
      await contracts.activate(adminReq, contract.id, '2026-11-01T00:00:00.000Z');

      const completed = await lifecycle.complete(adminReq, onboarding.id);
      assert.equal(completed.status, 'COMPLETED');

      const review = await performance.create(adminReq, {
        employeeId: employee.id,
        periodStart: '2026-01-01T00:00:00.000Z',
        periodEnd: '2026-12-31T00:00:00.000Z',
      });
      await performance.update(adminReq, review.id, { overallScore: 4.3 });
      await performance.submit(adminReq, review.id);

      const selfReviews = await selfService.getPerformanceReviews(selfReq);
      assert.equal(selfReviews.length, 1);
      assert.equal(selfReviews[0].status, 'SUBMITTED');
      const acknowledged = await selfService.acknowledgePerformanceReview(selfReq, review.id, 'تم الاطلاع');
      assert.equal(acknowledged.status, 'ACKNOWLEDGED');
      assert.equal(acknowledged.employeeComments, 'تم الاطلاع');

      await assert.rejects(
        () => selfService.acknowledgePerformanceReview({ user: { tenantId: tenantB.id, userId: userB.id } }, review.id, 'forbidden'),
        /User is not linked to an employee profile|Performance review not found/,
      );

      const selfRequests = await requests.listSelf(selfReq);
      assert.equal(selfRequests.length, 1);
      assert.equal(selfRequests[0].status, 'APPROVED');
    } finally {
      await prisma.user.deleteMany({
        where: { id: { in: [userA.id, userB.id, ...(invitedUserId ? [invitedUserId] : [])] } },
      });
      await prisma.tenant.deleteMany({ where: { id: { in: [tenantA.id, tenantB.id] } } });
    }
  },
);
