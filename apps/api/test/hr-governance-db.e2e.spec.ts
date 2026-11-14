import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@scc/database';
import { HrGovernanceService } from '../src/hr/hr-governance.service';
import { HrLifecycleService } from '../src/hr/hr-lifecycle.service';

test('Governance workspaces: tenant isolation, contract ownership, notes and controlled transitions',
  { skip: process.env.CRM_DB_E2E !== '1' ? 'CRM_DB_E2E=1 is required' : false },
  async () => {
    const id = process.pid+'-'+Date.now();
    const a = await prisma.tenant.create({data:{name:'Governance A '+id,slug:'gov-a-'+id}});
    const b = await prisma.tenant.create({data:{name:'Governance B '+id,slug:'gov-b-'+id}});
    const reqA:any = {user:{tenantId:a.id,userId:'admin-a-'+id,role:'ADMIN'}};
    const reqB:any = {user:{tenantId:b.id,userId:'admin-b-'+id,role:'ADMIN'}};
    const service = new HrGovernanceService();
    try {
      const employee = await prisma.employee.create({data:{
        tenantId:a.id,employeeCode:'GOV-'+id,firstName:'Review',lastName:'Employee',
        hireDate:new Date('2026-01-01T00:00:00Z'),basicSalary:5000,
      }});
      await assert.rejects(()=>service.create(reqB,{
        employeeId:employee.id,category:'VIOLATIONS',title:'Cross tenant test',description:'Test cannot cross organization boundaries',
      }),/Employee not found/);
      await assert.rejects(()=>service.create(reqA,{
        employeeId:employee.id,contractId:'unrelated-contract',
        category:'VIOLATIONS',title:'Unowned contract',description:'Must not attach a different contract',
      }),/Contract does not belong/);
      const record = await service.create(reqA,{
        employeeId:employee.id,category:'VIOLATIONS',title:'Reported work issue',
        description:'Unverified report that must be reviewed',priority:'HIGH',
      });
      assert.equal(record.status,'OPEN');
      const searched=await service.list(reqA,{search:'Reported work issue'});
      assert.equal(searched.count,1);
      assert.equal(searched.data[0].id,record.id);
      const wrongStatus=await service.list(reqA,{status:'CLOSED'});
      assert.equal(wrongStatus.count,0);
      await assert.rejects(()=>service.list(reqA,{search:'x'.repeat(101)}),/Search term must be at most/);
      await assert.rejects(()=>service.list(reqA,{status:'INVALID'}),/Invalid governance status/);
      const foreignSearch=await service.list(reqB,{search:'Reported work issue'});
      assert.equal(foreignSearch.count,0);
      const pageOne=await service.list(reqA,{page:'1',limit:'1'});
      assert.equal(pageOne.count,1);
      assert.equal(pageOne.data.length,1);
      assert.equal(pageOne.data[0].id,record.id);
      await assert.rejects(()=>service.list(reqA,{page:'0'}),/Invalid pagination/);
      await assert.rejects(()=>service.list(reqA,{limit:'999'}),/Invalid pagination/);
      assert.equal(record.events[0].action,'CREATED');
      assert.equal((await service.list(reqB,{})).count,0);
      await assert.rejects(()=>service.findOne(reqB,record.id),/not found/);
      await assert.rejects(()=>service.transition(reqA,record.id,'RESOLVED',''),/Invalid case status transition/);
      const pdf = Buffer.from('%PDF-1.4\\n1 0 obj\\n<<>>\\nendobj\\n');
      const validEvidence = await service.addEvidence(reqA,record.id,{
        fileName:'case-test.pdf',mimeType:'application/pdf',
        contentBase64:pdf.toString('base64'),description:'Synthetic evidence for E2E',
      });
      assert.equal(validEvidence.sizeBytes,pdf.length);
      assert.equal(validEvidence.checksumSha256.length,64);
      assert.equal((await service.listEvidence(reqA,record.id)).length,1);
      assert.equal((await service.getEvidence(reqA,record.id,validEvidence.id)).content.toString(),pdf.toString());
      await assert.rejects(()=>service.getEvidence(reqB,record.id,validEvidence.id),/Evidence not found/);
      await assert.rejects(()=>service.addEvidence(reqA,record.id,{
        fileName:'mismatched.pdf',mimeType:'application/pdf',
        contentBase64:Buffer.from('not a pdf').toString('base64'),
      }),/signature does not match/);
      const reviewing = await service.transition(reqA,record.id,'IN_REVIEW');
      assert.equal(reviewing.status,'IN_REVIEW');
      const noted = await service.addNote(reqA,record.id,'Employee response received');
      assert.equal(noted.events.length,4);
      await assert.rejects(()=>service.transition(reqA,record.id,'CLOSED'),/rationale is required/);
      const resolved = await service.transition(reqA,record.id,'RESOLVED','No substantiated violation');
      assert.equal(resolved.status,'RESOLVED');
      const closed = await service.transition(reqA,record.id,'CLOSED','Administrative review complete');
      assert.equal(closed.status,'CLOSED');
      assert.ok(closed.closedAt);
      await assert.rejects(()=>service.addNote(reqA,record.id,'Late note'),/Closed cases are read only/);
      await assert.rejects(()=>service.transition(reqA,record.id,'IN_REVIEW'),/Invalid case status transition/);
      await assert.rejects(()=>service.addEvidence(reqA,record.id,{
        fileName:'late.pdf',mimeType:'application/pdf',contentBase64:pdf.toString('base64'),
      }),/Closed cases are read only/);
      assert.equal(await prisma.hrGovernanceEvent.count({where:{tenantId:a.id,caseId:record.id}}),6);
      const subjectUser=await prisma.user.create({data:{
        tenantId:a.id,email:'governance-'+id+'@example.test',firstName:'Case',lastName:'Subject',
        role:'USER',status:'ACTIVE',
      }});
      await prisma.employee.update({where:{id:employee.id},data:{userId:subjectUser.id}});
      const subjectReq:any={user:{tenantId:a.id,userId:subjectUser.id,role:'USER'}};
      await prisma.user.create({data:{
        id:'reviewer-'+id,tenantId:a.id,email:'reviewer-'+id+'@example.test',
        firstName:'Independent',lastName:'Investigator',role:'ADMIN',status:'ACTIVE',
      }});
      await prisma.user.create({data:{
        id:'appeal-reviewer-'+id,tenantId:a.id,email:'appeal-reviewer-'+id+'@example.test',
        firstName:'Appeal',lastName:'Reviewer',role:'ADMIN',status:'ACTIVE',
      }});
      const unlinkedOffboardingEmployee=await prisma.employee.create({data:{
        tenantId:a.id,employeeCode:'OFFBOARD-'+id,firstName:'Leaving',lastName:'Employee',
        hireDate:new Date('2026-01-01T00:00:00Z'),
      }});
      const categories = [
        ['VIOLATIONS','REPORT_DETAIL'], ['INVESTIGATIONS','INTERVIEW'],
        ['EVIDENCE','EVIDENCE_REVIEW'], ['DISCIPLINE','NOTICE_PROPOSED'],
        ['CONFLICTS','DISCLOSURE'], ['CLAIMS','CLAIM_PROPOSED'],
        ['LEGAL','CASE_REFERENCE'], ['OFFBOARDING','HANDOVER'],
        ['COMPLIANCE','CONTROL_FINDING'],
      ] as const;
      const reviewerReq:any={user:{tenantId:a.id,userId:'reviewer-'+id,role:'ADMIN'}};
      const appealReviewerReq:any={user:{tenantId:a.id,userId:'appeal-reviewer-'+id,role:'ADMIN'}};

      for(const [category,code] of categories) {
        const caseFile=await service.create(reqA,{
          employeeId:category==='OFFBOARDING'?unlinkedOffboardingEmployee.id:employee.id,
          category,title:'Workspace E2E '+category,
          description:'Independent validation of '+category+' case actions',
        });
        if(category==='EVIDENCE') {
          await assert.rejects(()=>service.addWorkflowAction(reqA,caseFile.id,{
            code:'EVIDENCE_REVIEW',narrative:'Attempt to review absent file',
          }),/requires an uploaded original file/);
          const sample=await service.addEvidence(reqA,caseFile.id,{
            fileName:'evidence.pdf',mimeType:'application/pdf',
            contentBase64:pdf.toString('base64'),description:'Synthetic original evidence',
          });
          assert.equal(sample.sizeBytes,pdf.length);
        }
        if(category==='INVESTIGATIONS') {
          await assert.rejects(()=>service.addWorkflowAction(reqA,caseFile.id,{
            code:'INVESTIGATOR_ASSIGNED',narrative:'Forged investigator assignment action',
          }),/requires a verified tenant user/);
          await assert.rejects(()=>service.assignInvestigator(reqA,caseFile.id,reqA.user.userId,
            'Reporter must not investigate their own case'),/not found in tenant|independent/);
          const assigned=await service.assignInvestigator(reqA,caseFile.id,reviewerReq.user.userId,
            'Independent employee review assigned to authorized investigator');
          assert.equal(assigned.assignedToId,reviewerReq.user.userId);
          await assert.rejects(()=>service.addWorkflowAction(reqA,caseFile.id,{
            code:'INTERVIEW',narrative:'Reporter is not assigned investigator',
          }),/Only the assigned investigator/);
        }
        const investigatorActor=category==='INVESTIGATIONS'?reviewerReq:reqA;
        const applied=await service.addWorkflowAction(investigatorActor,caseFile.id,{
          code,narrative:'Documented initial '+category+' procedure',
        });
        assert.equal(applied.events.at(-1)?.action,code);
        if(category==='INVESTIGATIONS') {
          const finding=await service.addWorkflowAction(reviewerReq,caseFile.id,{
            code:'FACT_FINDING',narrative:'Investigator records findings after documented interview',
          });
          assert.equal(finding.events.at(-1)?.action,'FACT_FINDING');
        }
        assert.equal((await service.list(reqB,{category})).count,0);
        if(category==='CLAIMS') {
          await assert.rejects(()=>service.addWorkflowAction(reqA,caseFile.id,{
            code:'CLAIM_REVIEWED',narrative:'Attempt without response',
          }),/respondent reply/);
          await service.transition(reqA,caseFile.id,'IN_REVIEW');
          await service.selfResponse(subjectReq,caseFile.id,{
            code:'EMPLOYEE_RESPONSE',narrative:'Respondent disputes the amount',
          });
          await assert.rejects(()=>service.addWorkflowAction(reqA,caseFile.id,{
            code:'CLAIM_REVIEWED',narrative:'Same author review is forbidden',
          }),/Independent claim review/);
          const reviewed=await service.addWorkflowAction(reviewerReq,caseFile.id,{
            code:'CLAIM_REVIEWED',narrative:'Independent review of the claim',
          });
          assert.equal(reviewed.events.at(-1)?.action,'CLAIM_REVIEWED');
          const offered=await service.addWorkflowAction(reqA,caseFile.id,{
            code:'SETTLEMENT_OFFER',narrative:'Recorded proposed settlement terms for claimant',
          });
          const offer=offered.events.at(-1);
          assert.equal(offer?.action,'SETTLEMENT_OFFER');
          await assert.rejects(()=>service.addWorkflowAction(reqA,caseFile.id,{
            code:'SETTLEMENT_ACCEPTANCE',narrative:'Forged administrative approval',
          }),/restricted to authenticated employee self-service/);
          await assert.rejects(()=>service.selfResponse(subjectReq,caseFile.id,{
            code:'SETTLEMENT_ACCEPTANCE',narrative:'Attempt to accept without identifying offer',
          }),/current settlement offer/);
          await assert.rejects(()=>service.selfResponse(subjectReq,caseFile.id,{
            code:'SETTLEMENT_ACCEPTANCE',narrative:'Attempt to accept unrelated offer',
            offerEventId:'fake-offer-id',
          }),/current settlement offer/);
          const accepted=await service.selfResponse(subjectReq,caseFile.id,{
            code:'SETTLEMENT_ACCEPTANCE',narrative:'I accept the documented proposed settlement terms',
            offerEventId:offer!.id,
          });
          assert.equal(accepted.code,'SETTLEMENT_ACCEPTANCE');
          const stored=await service.findOne(reqA,caseFile.id);
          const acceptance=stored.events.find(e=>e.action==='SETTLEMENT_ACCEPTANCE');
          const acceptanceDetails=JSON.parse(acceptance!.details);
          assert.equal(acceptanceDetails.acceptedOfferEventId,offer!.id);
          assert.match(acceptanceDetails.acceptedOfferSha256,/^[0-9a-f]{64}$/);
          await assert.rejects(()=>service.selfResponse(subjectReq,caseFile.id,{
            code:'SETTLEMENT_ACCEPTANCE',narrative:'Repeat acceptance of same proposed terms',
            offerEventId:offer!.id,
          }),/already accepted/);
        }
        if(category==='DISCIPLINE') {
          await service.transition(reqA,caseFile.id,'IN_REVIEW');
          await service.selfResponse(subjectReq,caseFile.id,{
            code:'EMPLOYEE_RESPONSE',narrative:'Employee response to proposed notice',
          });
          await assert.rejects(()=>service.addWorkflowAction(reqA,caseFile.id,{
            code:'FINAL_REVIEW',narrative:'Improper self review of proposed action',
          }),/Independent reviewer/);
          await service.addWorkflowAction(reviewerReq,caseFile.id,{
            code:'FINAL_REVIEW',narrative:'Review of proposed administrative notice',
          });
          await service.selfResponse(subjectReq,caseFile.id,{
            code:'APPEAL_SUBMITTED',narrative:'Formal appeal of proposed notice',
          });
          await assert.rejects(()=>service.transition(reqA,caseFile.id,'CLOSED','Closed early'),/unresolved employee appeal/);
          await assert.rejects(()=>service.addWorkflowAction(reviewerReq,caseFile.id,{
            code:'APPEAL_REVIEWED',narrative:'Original reviewer cannot decide the appeal',
          }),/must differ from the original decision reviewer/);
          await service.addWorkflowAction(appealReviewerReq,caseFile.id,{
            code:'APPEAL_REVIEWED',narrative:'Recorded independent response to appeal',
          });
        }
        if(category==='OFFBOARDING') {
          await assert.rejects(()=>service.transition(reqA,caseFile.id,'CLOSED','Incomplete offboarding'),/Offboarding task missing/);
          const custodyVerified=await service.addWorkflowAction(reqA,caseFile.id,{
            code:'ASSET_RETURN_CHECK',narrative:'Tenant custody ledger contains no active assignments',
          });
          assert.equal(custodyVerified.events.at(-1)?.action,'ASSET_RETURN_CHECK');
          await service.addWorkflowAction(reqA,caseFile.id,{
            code:'ACCESS_REVOKED_CONFIRMED',narrative:'Employee has no linked account or active session',
          });
          await assert.rejects(
            () => service.transition(reqA,caseFile.id,'CLOSED','Governance case without lifecycle'),
            /Completed HR offboarding lifecycle is required/,
          );
          const lifecycle=new HrLifecycleService();
          const exit=await lifecycle.create(reqA,{
            employeeId:unlinkedOffboardingEmployee.id,type:'OFFBOARDING',
          });
          for(const task of exit.tasks){
            await lifecycle.updateTask(reqA,exit.id,task.id,{status:'DONE'});
          }
          await prisma.employee.update({
            where:{id:unlinkedOffboardingEmployee.id},
            data:{status:'TERMINATED',terminationDate:new Date('2026-11-13T00:00:00Z')},
          });
          const exitClosed=await lifecycle.complete(reqA,exit.id);
          assert.equal(exitClosed.status,'COMPLETED');
          const offboardingClosed=await service.transition(reqA,caseFile.id,'CLOSED','All administrative checks recorded');
          assert.equal(offboardingClosed.status,'CLOSED');
        }
        if(category==='CLAIMS') {
          await assert.rejects(()=>service.addWorkflowAction(reqA,caseFile.id,{
            code:'SETTLEMENT_ACCEPTANCE',narrative:'Not permitted for administrative account',
          }),/restricted to authenticated employee self-service/);
        }
        if(category==='DISCIPLINE') {
          await assert.rejects(()=>service.addWorkflowAction(reqA,caseFile.id,{
            code:'EMPLOYEE_RESPONSE',narrative:'Administrative impersonation attempt',
          }),/Employee statements and appeals require/);
          await assert.rejects(()=>service.addWorkflowAction(reqA,caseFile.id,{
            code:'APPEAL_SUBMITTED',narrative:'Administrative impersonation of employee appeal',
          }),/Employee statements and appeals require/);
        }
        if(category==='VIOLATIONS') {
          await assert.rejects(()=>service.transition(reqA,caseFile.id,'CLOSED',
            'Attempt to close without review'),/Required governance action missing: REVIEW_FINDING/);
          await assert.rejects(()=>service.addWorkflowAction(reqA,caseFile.id,{
            code:'REVIEW_FINDING',narrative:'Reporter must not review own allegation',
          }),/Independent reviewer required/);
          await service.addWorkflowAction(reviewerReq,caseFile.id,{
            code:'REVIEW_FINDING',narrative:'Recorded review of the reported issue',
          });
        }
        if(category==='CONFLICTS') {
          await service.addWorkflowAction(reqA,caseFile.id,{
            code:'MITIGATION_PLAN',narrative:'Proposed mitigation of conflict of interest',
          });
          await assert.rejects(()=>service.addWorkflowAction(reqA,caseFile.id,{
            code:'MITIGATION_REVIEW',narrative:'Author cannot independently verify own plan',
          }),/Independent reviewer required/);
          await service.addWorkflowAction(reviewerReq,caseFile.id,{
            code:'MITIGATION_REVIEW',narrative:'Verified conflict mitigation controls',
          });
        }
        if(category==='LEGAL') {
          await assert.rejects(()=>service.transition(reqA,caseFile.id,'CLOSED',
            'Attempt without outcome'),/Legal case outcome must be documented/);
          await service.addWorkflowAction(reqA,caseFile.id,{
            code:'CASE_DISPOSITION',narrative:'Record that the referenced matter is withdrawn',
          });
        }
        if(category==='COMPLIANCE') {
          await service.addWorkflowAction(reqA,caseFile.id,{
            code:'CORRECTIVE_ACTION',narrative:'Corrective action approved for compliance finding',
          });
          await assert.rejects(()=>service.addWorkflowAction(reqA,caseFile.id,{
            code:'CONTROL_VERIFIED',narrative:'Operator cannot verify own corrective action',
          }),/Independent verification required/);
          await service.addWorkflowAction(reviewerReq,caseFile.id,{
            code:'CONTROL_VERIFIED',narrative:'Verified the corrective measure and controls',
          });
        }
        if(category!=='OFFBOARDING') {
          const final=await service.transition(reqA,caseFile.id,'CLOSED','All required records documented');
          assert.equal(final.status,'CLOSED');
        }
        const found=await service.findOne(reqA,caseFile.id);
        assert.ok(found.events.length>=2);
      }
      const newest=await service.list(reqA,{page:'1',limit:'1'});
      const older=await service.list(reqA,{page:'2',limit:'1'});
      assert.equal(newest.count,10);
      assert.equal(older.count,10);
      assert.equal(newest.data.length,1);
      assert.equal(older.data.length,1);
      assert.notEqual(newest.data[0].id,older.data[0].id);
      const exact=await service.list(reqA,{search:'Workspace E2E CLAIMS',status:'CLOSED'});
      assert.equal(exact.count,1);
      assert.equal(exact.data[0].category,'CLAIMS');
    } finally {
      await prisma.hrGovernanceEvidence.deleteMany({where:{tenantId:a.id}});
      await prisma.hrGovernanceEvent.deleteMany({where:{tenantId:a.id}});
      await prisma.hrGovernanceCase.deleteMany({where:{tenantId:a.id}});
      await prisma.user.deleteMany({where:{tenantId:a.id}});
      await prisma.tenant.deleteMany({where:{id:{in:[a.id,b.id]}}});
    }
  },
);


test('HR self-governance: only disclosed employee cases, private reply and independent appeal',
  { skip: process.env.CRM_DB_E2E !== '1' ? 'CRM_DB_E2E=1 is required' : false },
  async () => {
    const run='self-gov-'+process.pid+'-'+Date.now();
    const tenantA=await prisma.tenant.create({data:{name:'Self Governance A',slug:run+'-a'}});
    const tenantB=await prisma.tenant.create({data:{name:'Self Governance B',slug:run+'-b'}});
    const svc=new HrGovernanceService();
    try {
      const userA=await prisma.user.create({data:{
        tenantId:tenantA.id,email:run+'-a@example.test',firstName:'Response',lastName:'Employee',
        role:'USER',status:'ACTIVE',
      }});
      const userB=await prisma.user.create({data:{
        tenantId:tenantB.id,email:run+'-b@example.test',firstName:'Other',lastName:'Employee',
        role:'USER',status:'ACTIVE',
      }});
      const employee=await prisma.employee.create({data:{
        tenantId:tenantA.id,userId:userA.id,employeeCode:'GOV-SELF-'+run,
        firstName:'Review',lastName:'Recipient',hireDate:new Date('2026-01-01T00:00:00Z'),
      }});
      const admin:any={user:{tenantId:tenantA.id,userId:'admin-'+run,role:'ADMIN'}};
      const reviewer:any={user:{tenantId:tenantA.id,userId:'reviewer-'+run,role:'ADMIN'}};
      const self:any={user:{tenantId:tenantA.id,userId:userA.id,role:'USER'}};
      const foreign:any={user:{tenantId:tenantB.id,userId:userB.id,role:'USER'}};
      const record=await svc.create(admin,{
        employeeId:employee.id,category:'DISCIPLINE',title:'Private disciplinary notice',
        description:'A proposed notice must be disclosed before employee response',
      });
      assert.equal((await svc.selfCases(self)).length,0);
      await svc.addWorkflowAction(admin,record.id,{
        code:'NOTICE_PROPOSED',narrative:'Proposed notice communicated to employee',
      });
      const disclosed=await svc.selfCases(self);
      assert.equal(disclosed.length,1);
      assert.equal(disclosed[0].id,record.id);
      assert.equal((await svc.selfCases(foreign)).length,0);
      await assert.rejects(()=>svc.selfResponse(foreign,record.id,{
        code:'EMPLOYEE_RESPONSE',narrative:'Foreign employee cannot respond',
      }),/Disclosed employee case not found/);
      await assert.rejects(()=>svc.selfResponse(self,record.id,{
        code:'FINAL_REVIEW',narrative:'Employee cannot authorize review',
      }),/Only employee response or appeal/);
      await assert.rejects(()=>svc.selfResponse(self,record.id,{
        code:'EMPLOYEE_RESPONSE',narrative:'Reply before review is forbidden',
      }),/under review/);
      await assert.rejects(()=>svc.addWorkflowAction(admin,record.id,{
        code:'EMPLOYEE_RESPONSE',narrative:'Manager masquerading as employee',
      }),/require authenticated employee self-service/);
      await svc.transition(admin,record.id,'IN_REVIEW');
      const reply=await svc.selfResponse(self,record.id,{
        code:'EMPLOYEE_RESPONSE',narrative:'I dispute the proposed findings and provide clarification',
      });
      assert.equal(reply.submitted,true);
      await svc.addWorkflowAction(reviewer,record.id,{
        code:'FINAL_REVIEW',narrative:'Independent assessment following employee reply',
      });
      const appeal=await svc.selfResponse(self,record.id,{
        code:'APPEAL_SUBMITTED',narrative:'I request reconsideration of the independent review',
      });
      assert.equal(appeal.code,'APPEAL_SUBMITTED');
      await assert.rejects(()=>svc.selfResponse(self,record.id,{
        code:'APPEAL_SUBMITTED',narrative:'Duplicate pending employee appeal',
      }),/already under review/);
      await assert.rejects(()=>svc.transition(admin,record.id,'CLOSED','Close prematurely'),/unresolved employee appeal/);
      await svc.addWorkflowAction({ user: { tenantId: tenantA.id, userId: 'second-reviewer-'+run, role: 'ADMIN' } },record.id,{
        code:'APPEAL_REVIEWED',narrative:'Recorded independent appeal decision',
      });
      const closed=await svc.transition(admin,record.id,'CLOSED','Review and appeal documented');
      assert.equal(closed.status,'CLOSED');
    } finally {
      await prisma.hrGovernanceEvidence.deleteMany({where:{tenantId:tenantA.id}});
      await prisma.hrGovernanceEvent.deleteMany({where:{tenantId:tenantA.id}});
      await prisma.hrGovernanceCase.deleteMany({where:{tenantId:tenantA.id}});
      await prisma.user.deleteMany({where:{tenantId:{in:[tenantA.id,tenantB.id]}}});
      await prisma.tenant.deleteMany({where:{id:{in:[tenantA.id,tenantB.id]}}});
    }
  },
);
