import { test } from 'node:test'; import assert from 'node:assert/strict'; import { prisma } from '@scc/database'; import { RecruitmentService } from '../src/hr/recruitment.service'; import { PerformanceService } from '../src/hr/performance.service'; import { TrainingService } from '../src/hr/training.service';
test('HR talent DB-backed E2E validates recruitment performance training and tenant isolation',{skip:process.env.CRM_DB_E2E!=='1'?'CRM_DB_E2E=1 is required':false},async()=>{const run=`${process.pid}-${Date.now()}`;const a=await prisma.tenant.create({data:{name:`Talent A ${run}`,slug:`talent-a-${run}`}}),b=await prisma.tenant.create({data:{name:`Talent B ${run}`,slug:`talent-b-${run}`}});const R=new RecruitmentService(),P=new PerformanceService(),T=new TrainingService();const ra:any={user:{tenantId:a.id,userId:`m-${run}`,role:'ADMIN'}},rb:any={user:{tenantId:b.id,userId:`mb-${run}`,role:'ADMIN'}};try{const o=await R.createOpening(ra,{code:`JOB-${run}`,title:'Financial Analyst',openings:1});const c=await R.createCandidate(ra,{jobOpeningId:o.id,firstName:'Sara',lastName:'Talent',email:`sara-${run}@example.com`});await assert.rejects(()=>R.hireCandidate(ra,c.id,{employeeCode:`EMP-${run}`,hireDate:'2026-11-13T00:00:00.000Z',basicSalary:12000}),/OFFER stage/);await R.updateCandidate(ra,c.id,{stage:'OFFER'});const e=await R.hireCandidate(ra,c.id,{employeeCode:`EMP-${run}`,hireDate:'2026-11-13T00:00:00.000Z',basicSalary:12000});assert.equal(e.jobTitle,'Financial Analyst');assert.equal((await prisma.candidate.findUniqueOrThrow({where:{id:c.id}})).stage,'HIRED');const onboarding=await prisma.hrLifecycleCase.findFirstOrThrow({where:{tenantId:a.id,employeeId:e.id,type:'ONBOARDING'},include:{tasks:true}});assert.equal(onboarding.status,'OPEN');assert.equal(onboarding.tasks.length,7);assert.equal((await prisma.jobOpening.findUniqueOrThrow({where:{id:o.id}})).status,'CLOSED');assert.equal((await R.listCandidates(rb,{})).count,0);const rev=await P.create(ra,{employeeId:e.id,periodStart:'2026-01-01T00:00:00.000Z',periodEnd:'2026-12-31T00:00:00.000Z'});await P.update(ra,rev.id,{goalsScore:4.5,competenciesScore:4.2,overallScore:4.4});assert.equal((await P.submit(ra,rev.id)).status,'SUBMITTED');assert.equal((await P.acknowledge(ra,rev.id,'Reviewed')).status,'ACKNOWLEDGED');const course=await T.createCourse(ra,{code:`TR-${run}`,title:'Risk Management',capacity:1});await assert.rejects(()=>T.enroll(ra,{courseId:course.id,employeeId:e.id}),/must be OPEN/);await T.status(ra,course.id,'OPEN');const en=await T.enroll(ra,{courseId:course.id,employeeId:e.id});const done=await T.complete(ra,en.id,{score:92,certificateNumber:`CERT-${run}`});assert.equal(done.status,'COMPLETED');assert.equal(Number(done.score),92);assert.equal((await P.list(rb,{})).count,0);assert.equal((await T.listEnrollments(rb,{})).count,0);}finally{await prisma.tenant.deleteMany({where:{id:{in:[a.id,b.id]}}});await prisma.$disconnect();}});

test('Concurrent recruitment hires never exceed a single opening seat', {
  skip: process.env.CRM_DB_E2E !== '1' ? 'CRM_DB_E2E=1 is required' : false,
}, async () => {
  const run = `concurrent-${process.pid}-${Date.now()}`;
  const tenant = await prisma.tenant.create({
    data: { name: `Concurrency ${run}`, slug: run },
  });
  const service = new RecruitmentService();
  const req: any = { user: { tenantId: tenant.id, userId: `actor-${run}`, role: 'ADMIN' } };
  try {
    const opening = await service.createOpening(req, {
      code: `JOB-${run}`, title: 'One Seat', openings: 1,
    });
    const first = await service.createCandidate(req, {
      jobOpeningId: opening.id, firstName: 'First', lastName: 'Candidate',
      email: `first-${run}@example.invalid`,
    });
    const second = await service.createCandidate(req, {
      jobOpeningId: opening.id, firstName: 'Second', lastName: 'Candidate',
      email: `second-${run}@example.invalid`,
    });
    await service.updateCandidate(req, first.id, { stage: 'OFFER' });
    await service.updateCandidate(req, second.id, { stage: 'OFFER' });

    const results = await Promise.allSettled([
      service.hireCandidate(req, first.id, {
        employeeCode: `EMP-A-${run}`, hireDate: '2026-11-13T00:00:00.000Z',
      }),
      service.hireCandidate(req, second.id, {
        employeeCode: `EMP-B-${run}`, hireDate: '2026-11-13T00:00:00.000Z',
      }),
    ]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1,
      'Exactly one concurrent hire may occupy the only seat');
    assert.equal(results.filter(r => r.status === 'rejected').length, 1);
    const hiredCount = await prisma.candidate.count({
      where: { tenantId: tenant.id, jobOpeningId: opening.id, stage: 'HIRED' },
    });
    assert.equal(hiredCount, 1);
    const actualOpening = await prisma.jobOpening.findUniqueOrThrow({
      where: { id: opening.id },
    });
    assert.equal(actualOpening.status, 'CLOSED');
    assert.equal(await prisma.employee.count({ where: { tenantId: tenant.id } }), 1);
    assert.equal(await prisma.hrLifecycleCase.count({
      where: { tenantId: tenant.id, type: 'ONBOARDING' },
    }), 1);
  } finally {
    await prisma.tenant.delete({ where: { id: tenant.id } });
    await prisma.$disconnect();
  }
});

test('Concurrent course enrollment respects a single available seat', {
  skip: process.env.CRM_DB_E2E !== '1' ? 'CRM_DB_E2E=1 is required' : false,
}, async () => {
  const run = `training-race-${process.pid}-${Date.now()}`;
  const tenant = await prisma.tenant.create({
    data: { name: run, slug: run },
  });
  const req: any = { user: { tenantId: tenant.id, userId: `actor-${run}`, role: 'ADMIN' } };
  const service = new TrainingService();
  try {
    const first = await prisma.employee.create({
      data: { tenantId: tenant.id, employeeCode: `E1-${run}`,
        firstName: 'First', lastName: 'Employee', hireDate: new Date('2026-01-01') },
    });
    const second = await prisma.employee.create({
      data: { tenantId: tenant.id, employeeCode: `E2-${run}`,
        firstName: 'Second', lastName: 'Employee', hireDate: new Date('2026-01-01') },
    });
    const course = await service.createCourse(req, {
      code: `C-${run}`, title: 'One seat course', capacity: 1,
    });
    await service.status(req, course.id, 'OPEN');
    const results = await Promise.allSettled([
      service.enroll(req, { courseId: course.id, employeeId: first.id }),
      service.enroll(req, { courseId: course.id, employeeId: second.id }),
    ]);
    assert.equal(results.filter(x => x.status === 'fulfilled').length, 1,
      'Exactly one concurrent enrollment should succeed');
    assert.equal(results.filter(x => x.status === 'rejected').length, 1);
    assert.equal(await prisma.trainingEnrollment.count({
      where: { tenantId: tenant.id, courseId: course.id, status: 'ENROLLED' },
    }), 1);
  } finally {
    await prisma.tenant.delete({ where: { id: tenant.id } });
    await prisma.$disconnect();
  }
});

test('Training lifecycle rejects invalid status transitions and duplicate completions', {
  skip: process.env.CRM_DB_E2E !== '1' ? 'CRM_DB_E2E=1 is required' : false,
}, async () => {
  const run = `training-lifecycle-${process.pid}-${Date.now()}`;
  const tenant = await prisma.tenant.create({ data: { name: run, slug: run } });
  const req: any = { user: { tenantId: tenant.id, userId: `admin-${run}`, role: 'ADMIN' } };
  const training = new TrainingService();
  try {
    const employee = await prisma.employee.create({
      data: { tenantId: tenant.id, employeeCode: `EMP-${run}`,
        firstName: 'Active', lastName: 'Trainee', hireDate: new Date('2026-01-01') },
    });
    const planned = await training.createCourse(req, {
      code: `PLANNED-${run}`, title: 'Planned course', capacity: 1,
    });
    await assert.rejects(() => training.status(req, planned.id, 'COMPLETED'),
      /Invalid training course status transition/);
    await training.status(req, planned.id, 'OPEN');
    const enrolled = await training.enroll(req, { courseId: planned.id, employeeId: employee.id });
    await assert.rejects(() => training.complete(req, enrolled.id, { score: 101 }),
      /Training score must be between 0 and 100/);
    const completed = await training.complete(req, enrolled.id, {
      score: 92, certificateNumber: `CERT-${run}`,
    });
    assert.equal(completed.status, 'COMPLETED');
    await assert.rejects(() => training.complete(req, enrolled.id, { score: 80 }),
      /Only enrolled participants can be completed/);
    await training.status(req, planned.id, 'COMPLETED');
    await assert.rejects(() => training.status(req, planned.id, 'OPEN'),
      /Invalid training course status transition/);
    await assert.rejects(() => training.enroll(req, { courseId: planned.id, employeeId: employee.id }),
      /must be OPEN/);

    const cancelled = await training.createCourse(req, {
      code: `CANCELLED-${run}`, title: 'Cancelled course',
    });
    await training.status(req, cancelled.id, 'OPEN');
    const extra = await prisma.employee.create({
      data: { tenantId: tenant.id, employeeCode: `EMP2-${run}`,
        firstName: 'Second', lastName: 'Trainee', hireDate: new Date('2026-01-01') },
    });
    const cancelledEnrollment = await training.enroll(req, {
      courseId: cancelled.id, employeeId: extra.id,
    });
    await training.status(req, cancelled.id, 'CANCELLED');
    await assert.rejects(() => training.complete(req, cancelledEnrollment.id, { score: 90 }),
      /Training course must be open or completed/);
    await assert.rejects(() => training.status(req, cancelled.id, 'OPEN'),
      /Invalid training course status transition/);
  } finally {
    await prisma.tenant.delete({ where: { id: tenant.id } });
    await prisma.$disconnect();
  }
});
