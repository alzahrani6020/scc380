import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@scc/database';
import { EmployeesService } from '../src/hr/employees.service';
import { HrAssetCustodyService } from '../src/hr/asset-custody.service';
import { HrLifecycleService } from '../src/hr/hr-lifecycle.service';

test(
  'HR custody lifecycle: return and termination allow clearance while settlement stays unpaid',
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
        () => custody.closeAssignment(reqA,assignment.id,{status:'LOST'}),
        /Completed investigation case required/,
      );
      await assert.rejects(
        () => custody.closeAssignment(reqA,assignment.id,{status:'DAMAGED',
          governanceCaseId:'missing-case-id',impairmentAmount:100}),
        /Resolved investigation for custodian is required/,
      );
      const stillActive=await prisma.assetCustodyAssignment.findUniqueOrThrow({
        where:{id:assignment.id},
      });
      assert.equal(stillActive.status,'ACTIVE');

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
        () => custody.closeAssignment(reqA, assignment.id, {
          status: 'RETURNED',conditionIn:'DUPLICATE',
        }),
        /already closed/,
      );
      assert.equal(await prisma.assetCustodyAssignment.count({
        where:{tenantId:tenantA.id,id:assignment.id,status:'RETURNED'},
      }),1);

      await assert.rejects(
        () => lifecycle.complete(reqA, offboarding.id),
        /Employee must be terminated/,
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
          status: 'DRAFT',
        },
      });

      const unpaid = await prisma.endServiceSettlement.findFirstOrThrow({
        where: { tenantId: tenantA.id, employeeId: employee.id },
      });
      assert.equal(unpaid.status, 'DRAFT');
      assert.equal(unpaid.paidAt, null);

      const completed = await lifecycle.complete(reqA, offboarding.id);
      assert.equal(completed.status, 'COMPLETED');
      const stillUnpaid = await prisma.endServiceSettlement.findUniqueOrThrow({
        where: { id: unpaid.id },
      });
      assert.equal(stillUnpaid.status, 'DRAFT');
      assert.equal(stillUnpaid.paidAt, null);

      const active = await prisma.assetCustodyAssignment.count({
        where: { tenantId: tenantA.id, employeeId: employee.id, status: 'ACTIVE' },
      });
      assert.equal(active, 0);
    } finally {
      await prisma.tenant.deleteMany({ where: { id: { in: [tenantA.id, tenantB.id] } } });
    }
  },
);


test('HR offboarding rejects active employee user and sessions while preserving financial settlement state',
  { skip: process.env.CRM_DB_E2E !== '1' ? 'CRM_DB_E2E=1 is required' : false },
  async () => {
    const run='offboard-access-'+process.pid+'-'+Date.now();
    const tenant=await prisma.tenant.create({data:{name:'Offboard Access '+run,slug:run}});
    const lifecycle=new HrLifecycleService();
    let userId:string|undefined;
    try {
      const user=await prisma.user.create({data:{
        tenantId:tenant.id,email:run+'@example.test',
        firstName:'Access',lastName:'Holder',role:'USER',status:'ACTIVE',
      }});
      userId=user.id;
      const employee=await prisma.employee.create({data:{
        tenantId:tenant.id,userId:user.id,employeeCode:'TERM-'+run,
        firstName:'Leaving',lastName:'Person',
        hireDate:new Date('2026-01-01T00:00:00Z'),
        status:'TERMINATED',terminationDate:new Date('2026-11-13T00:00:00Z'),
      }});
      const session=await prisma.session.create({data:{
        tenantId:tenant.id,userId:user.id,token:'offboard-session-'+run,
        expiresAt:new Date(Date.now()+86_400_000),
      }});
      const req:any={user:{tenantId:tenant.id,userId:'admin-'+run,role:'ADMIN'}};
      const offboarding=await lifecycle.create(req,{employeeId:employee.id,type:'OFFBOARDING'});
      const emptyOnboarding=await lifecycle.create(req,{employeeId:employee.id,type:'ONBOARDING'});
      await prisma.hrLifecycleTask.deleteMany({where:{tenantId:tenant.id,caseId:emptyOnboarding.id}});
      await assert.rejects(
        ()=>lifecycle.complete(req,emptyOnboarding.id),
        /must contain at least one task/,
      );
      for(const task of offboarding.tasks) {
        await lifecycle.updateTask(req,offboarding.id,task.id,{status:'DONE'});
      }
      await assert.rejects(()=>lifecycle.complete(req,offboarding.id),
        /Active employee user must be deactivated/);
      await prisma.user.update({where:{id:user.id},data:{status:'INACTIVE'}});
      await assert.rejects(()=>lifecycle.complete(req,offboarding.id),
        /login sessions must be revoked/);
      await prisma.session.update({where:{id:session.id},data:{revokedAt:new Date()}});
      const closed=await lifecycle.complete(req,offboarding.id);
      assert.equal(closed.status,'COMPLETED');
      const paidCount=await prisma.endServiceSettlement.count({
        where:{tenantId:tenant.id,employeeId:employee.id,status:'PAID'},
      });
      assert.equal(paidCount,0);
    } finally {
      if(userId)await prisma.user.deleteMany({where:{id:userId}});
      await prisma.tenant.deleteMany({where:{id:tenant.id}});
    }
  },
);


test('HR administrative exit requires completed tasks and revokes access without asserting financial payment',
  { skip: process.env.CRM_DB_E2E !== '1' ? 'CRM_DB_E2E=1 is required' : false },
  async () => {
    const run='exit-finalization-'+process.pid+'-'+Date.now();
    const tenant=await prisma.tenant.create({data:{name:'Exit Validation '+run,slug:run}});
    const hr=new HrLifecycleService();
    try {
      const operator=await prisma.user.create({data:{
        tenantId:tenant.id,email:run+'-hr@example.test',firstName:'HR',lastName:'Operator',
        role:'ADMIN',status:'ACTIVE',
      }});
      const target=await prisma.user.create({data:{
        tenantId:tenant.id,email:run+'-employee@example.test',firstName:'Employee',lastName:'Exit',
        role:'USER',status:'ACTIVE',
      }});
      const employee=await prisma.employee.create({data:{
        tenantId:tenant.id,userId:target.id,employeeCode:'EXIT-'+run,
        firstName:'Employee',lastName:'Exit',hireDate:new Date('2026-01-01T00:00:00Z'),
      }});
      const session=await prisma.session.create({data:{
        tenantId:tenant.id,userId:target.id,token:'exit-session-'+run,
        expiresAt:new Date(Date.now()+86400000),
      }});
      const req:any={user:{tenantId:tenant.id,userId:operator.id,role:'ADMIN'}};
      const lifecycle=await hr.create(req,{employeeId:employee.id,type:'OFFBOARDING'});
      await assert.rejects(
        () => hr.updateTask(req,lifecycle.id,lifecycle.tasks[0].id,{status:'SKIPPED'}),
        /must be completed, not skipped/,
      );
      const dto={confirmation:'FINALIZE_EMPLOYMENT_EXIT',
        lastWorkingDate:'2026-11-13',reason:'Documented employee exit after clearance'};
      await assert.rejects(()=>hr.finalizeExit(req,lifecycle.id,dto),
        /All offboarding tasks must be explicitly completed/);
      for(const task of lifecycle.tasks){
        await hr.updateTask(req,lifecycle.id,task.id,{status:'DONE'});
      }
      const beforeFinalization=await hr.findOne(req,lifecycle.id);
      assert.equal(beforeFinalization.status,'IN_PROGRESS');
      await assert.rejects(()=>hr.finalizeExit(req,lifecycle.id,{
        ...dto,confirmation:'NO',
      }),/Explicit finalization confirmation/);
      const completed=await hr.finalizeExit(req,lifecycle.id,dto);
      assert.equal(completed.status,'COMPLETED');
      await assert.rejects(
        () => hr.updateTask(req,lifecycle.id,lifecycle.tasks[0].id,{status:'TODO'}),
        /Lifecycle case is closed/,
      );
      await assert.rejects(
        () => hr.addTask(req,lifecycle.id,{title:'Late task after closure'}),
        /Lifecycle case is closed/,
      );
      assert.equal((await prisma.hrLifecycleCase.findUniqueOrThrow({
        where:{id:lifecycle.id},
      })).status,'COMPLETED');
      const after=await prisma.employee.findUniqueOrThrow({where:{id:employee.id}});
      assert.equal(after.status,'TERMINATED');
      assert.equal(after.terminationDate?.toISOString().slice(0,10),'2026-11-13');
      assert.equal((await prisma.user.findUniqueOrThrow({where:{id:target.id}})).status,'INACTIVE');
      assert.ok((await prisma.session.findUniqueOrThrow({where:{id:session.id}})).revokedAt);
      assert.equal(await prisma.endServiceSettlement.count({
        where:{tenantId:tenant.id,employeeId:employee.id,status:'PAID'},
      }),0);
      const recorded=await prisma.auditLog.findFirstOrThrow({
        where:{tenantId:tenant.id,entityId:employee.id,action:'HR_EMPLOYMENT_EXIT_FINALIZED'},
      });
      assert.equal(recorded.userId,operator.id);
      await assert.rejects(()=>hr.finalizeExit(req,lifecycle.id,dto),/Open offboarding lifecycle case not found/);
    } finally {
      await prisma.auditLog.deleteMany({where:{tenantId:tenant.id}});
      await prisma.hrLifecycleTask.deleteMany({where:{tenantId:tenant.id}});
      await prisma.hrLifecycleCase.deleteMany({where:{tenantId:tenant.id}});
      await prisma.employee.deleteMany({where:{tenantId:tenant.id}});
      await prisma.user.deleteMany({where:{tenantId:tenant.id}});
      await prisma.tenant.deleteMany({where:{id:tenant.id}});
    }
  },
);
