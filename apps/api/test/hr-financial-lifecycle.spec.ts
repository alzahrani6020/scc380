import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateEndService } from '../src/hr/end-service-calculator';

const src = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

test('Saudi end-service calculator applies Article 84 base and Article 85 resignation factor', () => {
  const r = calculateEndService({
    hireDate: new Date('2020-01-01T00:00:00.000Z'),
    lastWorkingDate: new Date('2027-01-01T00:00:00.000Z'),
    lastWage: 12000,
    reason: 'RESIGNATION',
    initiatedBy: 'EMPLOYEE',
  });
  assert.ok(r.serviceYears > 6.99 && r.serviceYears < 7.01);
  assert.ok(r.baseAward > 53900 && r.baseAward < 54100);
  assert.ok(Math.abs(r.awardFactor - (2 / 3)) < 0.000001);
  assert.ok(r.eosAward > 35900 && r.eosAward < 36100);
  assert.equal(r.dueDate.toISOString().slice(0, 10), '2027-01-15');
});

test('Article 80/probation award is zero and full-award reasons remain full', () => {
  const base = {
    hireDate: new Date('2020-01-01T00:00:00.000Z'),
    lastWorkingDate: new Date('2027-01-01T00:00:00.000Z'),
    lastWage: 12000,
    initiatedBy: 'EMPLOYER',
  };
  assert.equal(calculateEndService({ ...base, reason: 'ARTICLE_80' }).awardFactor, 0);
  assert.equal(calculateEndService({ ...base, reason: 'PROBATION' }).awardFactor, 0);
  assert.equal(calculateEndService({ ...base, reason: 'FORCE_MAJEURE' }).awardFactor, 1);
  assert.equal(calculateEndService({ ...base, reason: 'ARTICLE_81' }).awardFactor, 1);
  assert.equal(calculateEndService({ ...base, reason: 'EMPLOYER_TERMINATION' }).dueDate.toISOString().slice(0, 10), '2027-01-08');
});

test('loan installments are explicit payroll deductions and accounting dimensions', () => {
  const service = src('src/hr/payroll-runs.service.ts');
  const controller = src('src/hr/payroll-runs.controller.ts');
  assert.match(service, /loanDeductionsTotal/);
  assert.match(service, /payrollRunLoanDeduction\.create/);
  assert.match(service, /source:\s*'PAYROLL'/);
  assert.match(service, /Employee loan receivable reduction/);
  assert.match(controller, /loanReceivableAccountId/);
});

test('final settlement has approval/payment lifecycle and idempotent accounting source', () => {
  const service = src('src/hr/end-service-settlements.service.ts');
  assert.match(service, /status:\s*'APPROVED'/);
  assert.match(service, /status:\s*'PAID'/);
  assert.match(service, /source:\s*'SETTLEMENT'/);
  assert.match(service, /sourceType:\s*'END_SERVICE_SETTLEMENT'/);
  assert.match(service, /terminationDate:\s*settlement\.lastWorkingDate/);
});

test('loans/settlement migration is additive and has amount constraints', () => {
  const migration = src('../../packages/database/prisma/migrations/20261112174500_hr_loans_settlements/migration.sql');
  assert.match(migration, /CREATE TABLE "employee_loans"/);
  assert.match(migration, /CREATE TABLE "end_service_settlements"/);
  assert.match(migration, /employee_loans_amounts_check/);
  assert.match(migration, /end_service_settlements_amounts_check/);
  assert.doesNotMatch(migration, /(^|\n)\s*DROP\s+/i);
  assert.doesNotMatch(migration, /(^|\n)\s*TRUNCATE\s+/i);
  assert.doesNotMatch(migration, /(^|\n)\s*DELETE\s+FROM\s+/i);
});
