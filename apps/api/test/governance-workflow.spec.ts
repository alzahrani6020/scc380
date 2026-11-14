import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  GOVERNANCE_WORKFLOWS,
  assertGovernanceAction,
  assertGovernanceClosure,
} from '../src/hr/hr-governance.service';

const recorded = (action:string, actorUserId='investigator-a') => ({action,actorUserId});

test('every Makkin governance workspace offers specialized, non-financial actions', () => {
  assert.equal(Object.keys(GOVERNANCE_WORKFLOWS).length,9);
  for (const actions of Object.values(GOVERNANCE_WORKFLOWS)) {
    assert.ok(actions.length >= 2);
    assert.ok(actions.every(x => x.label && x.code));
  }
});

test('unauthorized workflow action is rejected for case category', () => {
  assert.throws(() => assertGovernanceAction('VIOLATIONS','CLAIM_REVIEWED','manager',[]),/not available/);
});

test('disciplinary review requires employee response and separation of duties', () => {
  assert.throws(
    () => assertGovernanceAction('DISCIPLINE','FINAL_REVIEW','manager',[recorded('NOTICE_PROPOSED')]),
    /employee response/,
  );
  assert.throws(
    () => assertGovernanceAction('DISCIPLINE','FINAL_REVIEW','investigator-a',
      [recorded('NOTICE_PROPOSED'),recorded('EMPLOYEE_RESPONSE','employee')]),
    /Independent reviewer/,
  );
  assert.doesNotThrow(
    () => assertGovernanceAction('DISCIPLINE','FINAL_REVIEW','reviewer-b',
      [recorded('NOTICE_PROPOSED'),recorded('EMPLOYEE_RESPONSE','employee')]),
  );
});

test('employee appeal is not reviewed by its author and prevents premature closure', () => {
  const history = [recorded('APPEAL_SUBMITTED','employee')];
  assert.throws(()=>assertGovernanceAction('DISCIPLINE','APPEAL_REVIEWED','employee',history),/independently reviewed/);
  assert.doesNotThrow(()=>assertGovernanceAction('DISCIPLINE','APPEAL_REVIEWED','reviewer-b',history));
  assert.throws(()=>assertGovernanceClosure('DISCIPLINE',history.map(x=>({...x,createdAt:new Date()}))),/unresolved/);
  assert.doesNotThrow(()=>assertGovernanceClosure('DISCIPLINE',
    [...history,recorded('APPEAL_REVIEWED','reviewer-b')].map(x=>({...x,createdAt:new Date()}))));
});

test('claims cannot be reviewed without reply or by initial claimant', () => {
  assert.throws(()=>assertGovernanceAction('CLAIMS','CLAIM_REVIEWED','reviewer-b',
    [recorded('CLAIM_PROPOSED')]),/respondent reply/);
  assert.throws(()=>assertGovernanceAction('CLAIMS','CLAIM_REVIEWED','investigator-a',
    [recorded('CLAIM_PROPOSED'),recorded('EMPLOYEE_RESPONSE','employee')]),/Independent claim/);
  assert.doesNotThrow(()=>assertGovernanceAction('CLAIMS','CLAIM_REVIEWED','reviewer-b',
    [recorded('CLAIM_PROPOSED'),recorded('EMPLOYEE_RESPONSE','employee')]));
});

test('investigation, conflict management and compliance require prior record', () => {
  assert.throws(()=>assertGovernanceAction('INVESTIGATIONS','FACT_FINDING','a',[]),/Interview record/);
  assert.throws(()=>assertGovernanceAction('CONFLICTS','MITIGATION_REVIEW','a',[]),/Mitigation plan/);
  assert.throws(()=>assertGovernanceAction('COMPLIANCE','CONTROL_VERIFIED','a',[]),/Corrective action/);
  assert.throws(()=>assertGovernanceAction('CLAIMS','SETTLEMENT_OFFER','a',[]),/Independent claim review/);
  assert.throws(()=>assertGovernanceAction('CLAIMS','SETTLEMENT_ACCEPTANCE','a',[]),/restricted to authenticated employee self-service/);
});

test('offboarding cannot be closed without handover, custody and access checks', () => {
  assert.throws(() => assertGovernanceClosure('OFFBOARDING', []), /HANDOVER/);
  const history = [
    recorded('HANDOVER'),recorded('ASSET_RETURN_CHECK'),recorded('ACCESS_REVOKED_CONFIRMED'),
  ].map(x => ({action:x.action,createdAt:new Date()}));
  assert.doesNotThrow(() => assertGovernanceClosure('OFFBOARDING', history));
});

test('administrators cannot impersonate employee responses or acceptance', () => {
  for (const action of ['EMPLOYEE_RESPONSE','APPEAL_SUBMITTED']) {
    assert.throws(() => assertGovernanceAction('DISCIPLINE',action,'admin',[]),/employee self-service/);
  }
  assert.throws(
    () => assertGovernanceAction('CLAIMS','SETTLEMENT_ACCEPTANCE','admin',[]),
    /restricted to authenticated employee self-service/,
  );
});

test('disciplinary notices require independent final review before closure', () => {
  const unreviewed=[recorded('NOTICE_PROPOSED')].map(x=>({...x,createdAt:new Date()}));
  assert.throws(()=>assertGovernanceClosure('DISCIPLINE',unreviewed),/independent final review/);
  const reviewed=[...unreviewed,{action:'FINAL_REVIEW',actorUserId:'reviewer-b',createdAt:new Date()}];
  assert.doesNotThrow(()=>assertGovernanceClosure('DISCIPLINE',reviewed));
});

test('investigator assignment cannot be fabricated as a text-only action', () => {
  assert.throws(
    () => assertGovernanceAction('INVESTIGATIONS','INVESTIGATOR_ASSIGNED','reporter',[]),
    /requires a verified tenant user/,
  );
});

test('category-specific closure requires documented governance actions', () => {
  const dated=(action:string)=>({action,createdAt:new Date('2026-01-01T00:00:00Z')});
  const requirements: Record<string,string[]> = {
    VIOLATIONS:['REPORT_DETAIL','REVIEW_FINDING'],
    INVESTIGATIONS:['INVESTIGATOR_ASSIGNED','INTERVIEW','FACT_FINDING'],
    EVIDENCE:['EVIDENCE_REVIEW'],
    CONFLICTS:['DISCLOSURE','MITIGATION_PLAN','MITIGATION_REVIEW'],
    COMPLIANCE:['CONTROL_FINDING','CORRECTIVE_ACTION','CONTROL_VERIFIED'],
  };
  for(const [category,actions] of Object.entries(requirements)) {
    assert.throws(()=>assertGovernanceClosure(category,[]),/Required governance action missing/);
    assert.doesNotThrow(()=>assertGovernanceClosure(category,actions.map(dated)));
  }
  assert.throws(()=>assertGovernanceClosure('LEGAL',[dated('CASE_REFERENCE')]),/Legal case outcome/);
  assert.doesNotThrow(()=>assertGovernanceClosure('LEGAL',
    [dated('CASE_REFERENCE'),dated('CASE_DISPOSITION')]));
});

test('independent governance reviews cannot be signed by the action author', () => {
  assert.throws(()=>assertGovernanceAction('VIOLATIONS','REVIEW_FINDING','author',
    [recorded('REPORT_DETAIL','author')]),/Independent reviewer required/);
  assert.doesNotThrow(()=>assertGovernanceAction('VIOLATIONS','REVIEW_FINDING','reviewer',
    [recorded('REPORT_DETAIL','author')]));
  assert.throws(()=>assertGovernanceAction('CONFLICTS','MITIGATION_REVIEW','author',
    [recorded('MITIGATION_PLAN','author')]),/Independent reviewer required/);
  assert.throws(()=>assertGovernanceAction('COMPLIANCE','CONTROL_VERIFIED','author',
    [recorded('CORRECTIVE_ACTION','author')]),/Independent verification required/);
  const appeal=[recorded('FINAL_REVIEW','first-reviewer'),recorded('APPEAL_SUBMITTED','employee')];
  assert.throws(()=>assertGovernanceAction('DISCIPLINE','APPEAL_REVIEWED','first-reviewer',appeal),
    /must differ from the original decision reviewer/);
  assert.doesNotThrow(()=>assertGovernanceAction('DISCIPLINE','APPEAL_REVIEWED','second-reviewer',appeal));
});

test('governance UI searches all tenant employees instead of truncating selector at 200', () => {
  const ui=readFileSync(join(process.cwd(),'../web/src/app/dashboard/hr/governance/[category]/page.tsx'),'utf8');
  assert.match(ui,/AsyncCombobox/);
  assert.match(ui,/searchEmployees/);
  assert.match(ui,/resolveEmployee/);
  assert.match(ui,/hr\/employees\?search=/);
  assert.doesNotMatch(ui,/hr\/employees\?limit=200/);
});

test('claim disposition is required after latest review or settlement event', () => {
  const dated=(action:string)=>({action,createdAt:new Date('2026-11-14T00:00:00Z')});
  assert.throws(()=>assertGovernanceClosure('CLAIMS',
    [dated('CLAIM_PROPOSED'),dated('CLAIM_REVIEWED')]),/CLAIM_DISPOSITION/);
  assert.doesNotThrow(()=>assertGovernanceClosure('CLAIMS',
    [dated('CLAIM_PROPOSED'),dated('CLAIM_REVIEWED'),dated('CLAIM_DISPOSITION')]));
  assert.throws(()=>assertGovernanceClosure('CLAIMS',
    [dated('CLAIM_PROPOSED'),dated('CLAIM_REVIEWED'),dated('CLAIM_DISPOSITION'),dated('SETTLEMENT_OFFER')]),
    /Claim disposition/);
  assert.throws(()=>assertGovernanceAction('CLAIMS','CLAIM_DISPOSITION','reviewer',[]),
    /Claim must be independently reviewed/);
});

test('empty claims and disciplinary cases cannot be closed as if reviewed', () => {
  const dated=(action:string)=>({action,createdAt:new Date('2026-11-14T00:00:00Z')});
  assert.throws(()=>assertGovernanceClosure('CLAIMS',[]),/CLAIM_PROPOSED/);
  assert.throws(()=>assertGovernanceClosure('CLAIMS',
    [dated('CLAIM_PROPOSED'),dated('CLAIM_DISPOSITION')]),/CLAIM_REVIEWED/);
  assert.throws(()=>assertGovernanceClosure('DISCIPLINE',[]),/Disciplinary case disposition/);
  assert.doesNotThrow(()=>assertGovernanceClosure('DISCIPLINE',[dated('DISCIPLINE_DISPOSITION')]));
});
