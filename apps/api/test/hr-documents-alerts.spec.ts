import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const src = (relative: string) => readFileSync(join(process.cwd(), relative), 'utf8');

test('employee documents are tenant-scoped, size-limited and stored with checksum', () => {
  const service = src('src/hr/employee-documents.service.ts');
  const controller = src('src/hr/employee-documents.controller.ts');
  assert.match(service, /tenantWhere\(tenantId\)/);
  assert.match(service, /MAX_DOCUMENT_BYTES = 5 \* 1024 \* 1024/);
  assert.match(service, /createHash\('sha256'\)/);
  assert.match(controller, /@RequirePermissions\('hr:read'\)/);
  assert.match(controller, /@RequirePermissions\('hr:write'\)/);
  assert.match(controller, /X-Content-Type-Options/);
});

test('alerts derive tenant from authenticated user and include HR expiry alerts', () => {
  const controller = src('src/alerts/alerts.controller.ts');
  const service = src('src/alerts/alerts.service.ts');
  assert.doesNotMatch(controller, /x-tenant-id/i);
  assert.match(controller, /req\.user\?\.tenantId/);
  assert.match(service, /EMPLOYEE_DOCUMENT_EXPIRY/);
  assert.match(service, /EMPLOYEE_CONTRACT_EXPIRY/);
  assert.match(service, /const tw = tenantWhere\(tenantId\)/);
});

test('employee document migration is additive only', () => {
  const migration = src('../../packages/database/prisma/migrations/20261112170000_employee_documents/migration.sql');
  assert.match(migration, /CREATE TABLE "employee_documents"/);
  assert.match(migration, /BYTEA NOT NULL/);
  assert.doesNotMatch(migration, /(^|\n)\s*DROP\s+/i);
  assert.doesNotMatch(migration, /(^|\n)\s*TRUNCATE\s+/i);
  assert.doesNotMatch(migration, /(^|\n)\s*DELETE\s+FROM\s+/i);
});
