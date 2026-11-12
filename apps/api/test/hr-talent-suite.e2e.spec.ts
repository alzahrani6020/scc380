import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@scc/database';
import { RecruitmentService } from '../src/hr/recruitment.service';
import { PerformanceService } from '../src/hr/performance.service';
import { TrainingService } from '../src/hr/training.service';

test(
 'HR talent lifecycle: recruit -> hire/onboard -> performance -> self acknowledge -> training/certificate',
 { skip: process.env.CRM_DB_E2E !== '1' ? 'CRM_DB_E2E=1 is required' : false },
 async()=>{
  const run=`${process.pid}-${Date.now()}`;
  const tenantA=await prisma.tenant.create({data:{name:`Talent A ${run}`,slug:`talent-a-${run}`}});
  const tenantB=await prisma.tenant.create({data:{name:`Talent B ${run}`,slug:`talent-b-${run}`}});
  const userA=await prisma.user.create({data:{email:`talent-${run}@example.test`,firstName:'Talent',lastName:'User',tenantId:tenantA.id,role:'USER',status:'ACTIVE'}});
  const dept=await prisma.department.create({data:{tenantId:tenantA.id,name:`Technology ${run}`,code:`TECH-${run}`}});
  const reqA:any={user:{tenantId:tenantA.id,userId:`admin-${run}`,role:'ADMIN'}};
  const reqB:any={user:{tenantId:tenantB.id,userId:`admin-b-${run}`,role:'ADMIN'}};
  const selfReq:any={user:{tenantId:tenantA.id,userId:userA.id,role:'USER'}};
  const recruitment=new RecruitmentService();
  const performance=new PerformanceService();
  const training=new TrainingService();
  try{
   const job=await recruitment.createJob(reqA,{title:'Financial Analyst',code:`FA-${run}`,departmentId:dept.id,headcount:1,employmentType:'FULL_TIME'});
   await recruitment.setJobStatus(reqA,job.id,'OPEN');

   const candidate=await recruitment.addCandidate(reqA,{
    jobOpeningId:job.id,firstName:'Candidate',lastName:'One',email:`candidate-${run}@example.test`,phone:'0500000000',
    resumeFileName:'resume.pdf',resumeMimeType:'application/pdf',resumeContentBase64:Buffer.from('%PDF talent').toString('base64')
   });
   const foreign=await recruitment.candidates(reqB,{});
   assert.equal(foreign.count,0);

   const interview=await recruitment.scheduleInterview(reqA,candidate.id,{scheduledAt:'2026-12-01T09:00:00.000Z',type:'TECHNICAL'});
   await recruitment.completeInterview(reqA,candidate.id,interview.id,{score:4.5,feedback:'Strong'});
   await recruitment.makeOffer(reqA,candidate.id,{offerSalary:12000});
   const employee=await recruitment.hire(reqA,candidate.id,{employeeCode:`EMP-${run}`,hireDate:'2026-12-15T00:00:00.000Z'});
   assert.equal(employee.departmentId,dept.id);

   const hired=await prisma.recruitmentCandidate.findUniqueOrThrow({where:{id:candidate.id}});
   assert.equal(hired.status,'HIRED'); assert.equal(hired.hiredEmployeeId,employee.id);
   const closedJob=await prisma.recruitmentJobOpening.findUniqueOrThrow({where:{id:job.id}});
   assert.equal(closedJob.status,'CLOSED');
   const onboarding=await prisma.hrLifecycleCase.findFirst({where:{tenantId:tenantA.id,employeeId:employee.id,type:'ONBOARDING'}});
   assert.ok(onboarding);

   await prisma.employee.update({where:{id:employee.id},data:{userId:userA.id}});

   const cycle=await performance.createCycle(reqA,{name:`Annual ${run}`,startDate:'2027-01-01T00:00:00.000Z',endDate:'2027-12-31T00:00:00.000Z'});
   await performance.setCycleStatus(reqA,cycle.id,'ACTIVE');
   const review=await performance.createReview(reqA,{cycleId:cycle.id,employeeId:employee.id});
   const g1=await performance.addGoal(reqA,review.id,{title:'Revenue quality',weight:60,target:'95%'});
   const g2=await performance.addGoal(reqA,review.id,{title:'Cycle time',weight:40,target:'5 days'});
   await performance.updateGoal(reqA,review.id,g1.id,{rating:4,result:'96%',status:'COMPLETED'});
   await performance.updateGoal(reqA,review.id,g2.id,{rating:5,result:'4 days',status:'COMPLETED'});
   const submitted=await performance.submit(reqA,review.id,{managerSummary:'Strong year'});
   assert.equal(submitted.status,'SUBMITTED');
   assert.equal(Number(submitted.overallRating),4.4);
   const ownReviews=await performance.selfReviews(selfReq);
   assert.equal(ownReviews.length,1);
   const acknowledged=await performance.acknowledge(selfReq,review.id,'Reviewed');
   assert.equal(acknowledged.status,'ACKNOWLEDGED');

   const second=await prisma.employee.create({data:{tenantId:tenantA.id,employeeCode:`EMP2-${run}`,firstName:'Second',lastName:'Employee',hireDate:new Date('2026-12-15T00:00:00.000Z'),basicSalary:8000,status:'ACTIVE'}});
   const course=await training.createCourse(reqA,{title:`Compliance ${run}`,code:`TR-${run}`,hours:8,certificateRequired:true});
   const session=await training.createSession(reqA,{courseId:course.id,startAt:'2027-02-01T08:00:00.000Z',endAt:'2027-02-01T16:00:00.000Z',capacity:1});
   const enrollment=await training.enroll(reqA,session.id,{employeeId:employee.id,status:'ENROLLED'});
   await assert.rejects(()=>training.enroll(reqA,session.id,{employeeId:second.id,status:'ENROLLED'}),/capacity is full/);
   await assert.rejects(()=>training.updateEnrollment(reqA,session.id,enrollment.id,{status:'COMPLETED',score:95}),/Certificate evidence is required/);
   const completed=await training.updateEnrollment(reqA,session.id,enrollment.id,{status:'COMPLETED',score:95,certificateNumber:`CERT-${run}`});
   assert.equal(completed.status,'COMPLETED');
   await training.setSessionStatus(reqA,session.id,'COMPLETED');
   const selfTraining=await training.selfTraining(selfReq);
   assert.equal(selfTraining.length,1);assert.equal(selfTraining[0].certificateNumber,`CERT-${run}`);
  }finally{
   await prisma.user.deleteMany({where:{id:userA.id}});
   await prisma.tenant.deleteMany({where:{id:{in:[tenantA.id,tenantB.id]}}});
  }
 }
);
