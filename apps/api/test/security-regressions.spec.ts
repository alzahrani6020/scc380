import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tenantWhere, withTenant } from '@scc/database';

const src = (relative: string) => readFileSync(join(process.cwd(), relative), 'utf8');

test('tenant helpers fail closed when tenant context is absent', () => {
  assert.notDeepEqual(tenantWhere(undefined), {});
  assert.ok(tenantWhere(undefined).tenantId);
  assert.equal(withTenant({ id: 'x' }, undefined).id, 'x');
  assert.ok(withTenant({ id: 'x' }, undefined).tenantId);
});

test('analytics has no unauthenticated global public-summary route', () => {
  const source = src('src/analytics/analytics.controller.ts');
  assert.doesNotMatch(source, /@Get\('public-summary'\)/);
  assert.match(source, /@Get\('dashboard'\)[\s\S]*@UseGuards\(JwtAuthGuard\)/);
});

test('tenant middleware does not depend on req.user before guards run', () => {
  const source = src('src/common/middleware/tenant.middleware.ts');
  assert.doesNotMatch(source, /req\.user\?\.role/);
});

test('notification websocket authenticates access session and never accepts client tenant join', () => {
  const source = src('src/notifications/notifications.gateway.ts');
  assert.match(source, /handshake\.auth\?\.token/);
  assert.match(source, /validateAccessSessionPayload/);
  assert.match(source, /client\.data\.user/);
  assert.match(source, /client\.join\(\`tenant-\$\{user\.tenantId\}\`\)/);
  assert.doesNotMatch(source, /SubscribeMessage\('join-tenant'\)/);
  assert.doesNotMatch(source, /cors:\s*\{\s*origin:\s*['"]\*['"]/);
});

test('web socket client sends access token and never sends tenantId', () => {
  const source = src('../web/src/hooks/useSocket.ts');
  assert.match(source, /getToken/);
  assert.match(source, /auth:\s*\{\s*token\s*\}/);
  assert.doesNotMatch(source, /getTenantId/);
  assert.doesNotMatch(source, /join-tenant/);
});

test('deal assignee is validated inside tenant and list is paginated', () => {
  const source = src('src/crm/deals.service.ts');
  assert.match(source, /Assignee not found in your tenant/);
  assert.match(source, /tenantWhere\(tenantId\)/);
  assert.match(source, /skip:\s*\(page - 1\) \* limit/);
  assert.match(source, /take:\s*limit/);
});

test('deal and activity DTOs use enum validation and probability bounds', () => {
  const deals = src('src/crm/deals.controller.ts');
  const activities = src('src/crm/activities.controller.ts');
  assert.match(deals, /@IsEnum\(DealStage\)/);
  assert.match(deals, /@Min\(0\)/);
  assert.match(deals, /@Max\(100\)/);
  assert.match(activities, /@IsEnum\(ActivityType\)/);
});

test('activities list uses bounded pagination', () => {
  const source = src('src/crm/activities.service.ts');
  assert.match(source, /Math\.min\(100/);
  assert.match(source, /skip:\s*\(page - 1\) \* limit/);
  assert.match(source, /take:\s*limit/);
});

test('analytics UI uses authenticated API and contains no production demo fallback', () => {
  const source = src('../web/src/app/dashboard/analytics/page.tsx');
  assert.match(source, /api\.get\('\/analytics\/dashboard'\)/);
  assert.match(source, /api\.get\('\/analytics\/crm'\)/);
  assert.doesNotMatch(source, /localhost:3001\/analytics\/public-summary/);
  assert.doesNotMatch(source, /Demo data/);
  assert.doesNotMatch(source, /Lead', count: 12/);
});


test('CRM relation apply step is guarded and non-destructive', () => {
  const source = src('scripts/apply-crm-relations.cjs');
  assert.match(source, /CRM_RELATIONS_APPLY_BLOCKED/);
  assert.match(source, /violations !== 0/);
  assert.match(source, /pg_constraint/);
  assert.match(source, /expectedConstraints: constraints\.length/);
  assert.match(source, /installedConstraints: rows\.length/);
  assert.doesNotMatch(source, /\bDROP\b/i);
  assert.doesNotMatch(source, /\bTRUNCATE\b/i);
  assert.doesNotMatch(source, /\bDELETE\s+FROM\b/i);
  assert.doesNotMatch(source, /\bUPDATE\s+["a-z]/i);
});

test('CRM FK migration is additive only', () => {
  const migration = readFileSync(
    join(process.cwd(), '../../packages/database/prisma/migrations/20261111174000_add_crm_relations/migration.sql'),
    'utf8',
  );
  assert.ok((migration.match(/ADD CONSTRAINT/g) ?? []).length === 6);
  assert.doesNotMatch(migration, /\bDROP\b/i);
  assert.doesNotMatch(migration, /\bTRUNCATE\b/i);
  assert.doesNotMatch(migration, /\bDELETE\b/i);
  assert.doesNotMatch(migration, /\bUPDATE\b/i);
});
