import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@scc/database';
import { HrGovernanceService } from '../src/hr/hr-governance.service';

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
      const categories = [
        ['VIOLATIONS','REPORT_DETAIL'], ['INVESTIGATIONS','INTERVIEW'],
        ['EVIDENCE','EVIDENCE_REVIEW'], ['DISCIPLINE','NOTICE_PROPOSED'],
        ['CONFLICTS','DISCLOSURE'], ['CLAIMS','CLAIM_PROPOSED'],
        ['LEGAL','CASE_REFERENCE'], ['OFFBOARDING','HANDOVER'],
        ['COMPLIANCE','CONTROL_FINDING'],
      ] as const;
      const reviewerReq:any={user:{tenantId:a.id,userId:'reviewer-'+id,role:'ADMIN'}};
      const employeeReq:any={user:{tenantId:a.id,userId:'employee-reply-'+id,role:'ADMIN'}};
      for(const [category,code] of categories) {
        const caseFile=await service.create(reqA,{
          employeeId:employee.id,category,title:'Workspace E2E '+category,
          description:'Independent validation of '+category+' case actions',
        });
        const applied=await service.addWorkflowAction(reqA,caseFile.id,{
          code,narrative:'Documented initial '+category+' procedure',
        });
        assert.equal(applied.events.at(-1)?.action,code);
        assert.equal((await service.list(reqB,{category})).count,0);
        if(category==='CLAIMS') {
          await assert.rejects(()=>service.addWorkflowAction(reqA,caseFile.id,{
            code:'CLAIM_REVIEWED',narrative:'Attempt without response',
          }),/respondent reply/);
          await service.addWorkflowAction(employeeReq,caseFile.id,{
            code:'EMPLOYEE_RESPONSE',narrative:'Respondent disputes the amount',
          });
          await assert.rejects(()=>service.addWorkflowAction(reqA,caseFile.id,{
            code:'CLAIM_REVIEWED',narrative:'Same author review is forbidden',
          }),/Independent claim review/);
          const reviewed=await service.addWorkflowAction(reviewerReq,caseFile.id,{
            code:'CLAIM_REVIEWED',narrative:'Independent review of the claim',
          });
          assert.equal(reviewed.events.at(-1)?.action,'CLAIM_REVIEWED');
        }
        if(category==='DISCIPLINE') {
          await service.addWorkflowAction(employeeReq,caseFile.id,{
            code:'EMPLOYEE_RESPONSE',narrative:'Employee response to proposed notice',
          });
          await assert.rejects(()=>service.addWorkflowAction(reqA,caseFile.id,{
            code:'FINAL_REVIEW',narrative:'Improper self review of proposed action',
          }),/Independent reviewer/);
          await service.addWorkflowAction(reviewerReq,caseFile.id,{
            code:'FINAL_REVIEW',narrative:'Review of proposed administrative notice',
          });
          await service.addWorkflowAction(employeeReq,caseFile.id,{
            code:'APPEAL_SUBMITTED',narrative:'Formal appeal of proposed notice',
          });
          await assert.rejects(()=>service.transition(reqA,caseFile.id,'CLOSED','Closed early'),/unresolved employee appeal/);
          await service.addWorkflowAction(reviewerReq,caseFile.id,{
            code:'APPEAL_REVIEWED',narrative:'Recorded independent response to appeal',
          });
        }
        const found=await service.findOne(reqA,caseFile.id);
        assert.ok(found.events.length>=2);
      }
    } finally {
      await prisma.hrGovernanceEvidence.deleteMany({where:{tenantId:a.id}});
      await prisma.hrGovernanceEvent.deleteMany({where:{tenantId:a.id}});
      await prisma.hrGovernanceCase.deleteMany({where:{tenantId:a.id}});
      await prisma.tenant.deleteMany({where:{id:{in:[a.id,b.id]}}});
    }
  },
);
