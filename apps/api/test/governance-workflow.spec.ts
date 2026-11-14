import { test } from 'node:test';
import assert from 'node:assert/strict';
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
  assert.throws(()=>assertGovernanceAction('CLAIMS','SETTLEMENT_ACCEPTANCE','a',[]),/Settlement offer/);
});
