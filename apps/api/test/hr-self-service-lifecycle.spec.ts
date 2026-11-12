import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const src = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

test('employee self-service resolves identity only through explicit tenant user link', () => {
  const service = src('src/hr/self-service.service.ts');
  const employees = src('src/hr/employees.service.ts');
  assert.match(service, /tenantWhere\(tenantId\).*userId/s);
  assert.match(employees, /Active tenant user not found/);
  assert.match(employees, /User is already linked to another employee/);
});

test('legacy approvals my-requests no longer guesses employee from email contains user id', () => {
  const approvals = src('src/approvals/approvals.service.ts');
  assert.match(approvals, /employee\.findFirst\(\{ where: \{ \.\.\.tw, userId \} \}\)/);
  assert.doesNotMatch(approvals, /email:\s*\{\s*contains:\s*userId/);
});

test('onboarding and offboarding are connected to employee and settlement creation', () => {
  const employees = src('src/hr/employees.service.ts');
  const settlements = src('src/hr/end-service-settlements.service.ts');
  assert.match(employees, /defaultLifecycleTasks\('ONBOARDING'\)/);
  assert.match(employees, /hrLifecycleCase\.create/);
  assert.match(settlements, /defaultLifecycleTasks\('OFFBOARDING'\)/);
  assert.match(settlements, /type:\s*'OFFBOARDING'/);
});

test('HR self-service migration is additive and constrains workflow statuses', () => {
  const migration = src('../../packages/database/prisma/migrations/20261112183000_hr_self_service_requests_lifecycle/migration.sql');
  assert.match(migration, /ADD COLUMN "userId"/);
  assert.match(migration, /CREATE TABLE "hr_requests"/);
  assert.match(migration, /CREATE TABLE "hr_lifecycle_cases"/);
  assert.match(migration, /CREATE TABLE "hr_lifecycle_tasks"/);
  assert.match(migration, /hr_requests_status_check/);
  assert.match(migration, /hr_lifecycle_tasks_status_check/);
  assert.doesNotMatch(migration, /(^|\n)\s*DROP\s+/i);
  assert.doesNotMatch(migration, /(^|\n)\s*TRUNCATE\s+/i);
  assert.doesNotMatch(migration, /(^|\n)\s*DELETE\s+FROM\s+/i);
});

test('self-service profile update cannot mutate salary or employment state', () => {
  const service = src('src/hr/self-service.service.ts');
  assert.match(service, /\['phone', 'emergencyContactName', 'emergencyContactPhone'\]/);
  const method = service.slice(service.indexOf('async updateProfile'), service.indexOf('async getPayroll'));
  assert.doesNotMatch(method, /basicSalary|jobTitle|status|terminationDate/);
});
