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

test('activities list uses validated bounded pagination', () => {
  const service = src('src/crm/activities.service.ts');
  const queryDto = src('src/crm/dto/list-activities-query.dto.ts');
  assert.match(queryDto, /@Max\(100\)/);
  assert.match(queryDto, /@Min\(1\)/);
  assert.match(service, /skip:\s*\(page - 1\) \* limit/);
  assert.match(service, /take:\s*limit/);
});

test('analytics UI uses authenticated API and contains no production demo fallback', () => {
  const source = src('../web/src/app/dashboard/analytics/page.tsx');
  assert.match(source, /api\.get\('\/analytics\/dashboard'\)/);
  assert.match(source, /api\.get\('\/analytics\/crm'\)/);
  assert.doesNotMatch(source, /localhost:3001\/analytics\/public-summary/);
  assert.doesNotMatch(source, /Demo data/);
  assert.doesNotMatch(source, /Lead', count: 12/);
});


test('CRM FK migration is additive only', () => {
  const migration = readFileSync(
    join(process.cwd(), '../../packages/database/prisma/migrations/20261111174000_add_crm_relations/migration.sql'),
    'utf8',
  );
  assert.ok((migration.match(/ADD CONSTRAINT/g) ?? []).length === 6);
  assert.doesNotMatch(migration, /(^|\n)\s*DROP\s+/i);
  assert.doesNotMatch(migration, /(^|\n)\s*TRUNCATE\s+/i);
  assert.doesNotMatch(migration, /(^|\n)\s*DELETE\s+FROM\s+/i);
  assert.doesNotMatch(migration, /(^|\n)\s*UPDATE\s+["a-z]/i);
});


test('CRM relationship selectors are async and not capped to first 100 records', () => {
  const dealsPage = src('../web/src/app/dashboard/crm/deals/page.tsx');
  const activitiesPage = src('../web/src/app/dashboard/crm/activities/page.tsx');
  const combo = src('../web/src/components/ui/AsyncCombobox.tsx');
  const activitiesService = src('src/crm/activities.service.ts');

  assert.match(dealsPage, /AsyncCombobox/);
  assert.match(activitiesPage, /AsyncCombobox/);
  assert.match(combo, /loadOptions/);
  assert.doesNotMatch(dealsPage, /crm\/(contacts|companies|deals)\?limit=100/);
  assert.doesNotMatch(activitiesPage, /crm\/(contacts|companies|deals)\?limit=100/);
  assert.match(activitiesService, /contact:\s*\{\s*select:/);
  assert.match(activitiesService, /deal:\s*\{\s*select:/);
});


test('users and tenants enforce RBAC and block privilege escalation', () => {
  const usersController = src('src/users/users.controller.ts');
  const usersService = src('src/users/users.service.ts');
  const tenantController = src('src/tenant/tenant.controller.ts');
  const tenantService = src('src/tenant/tenant.service.ts');

  assert.match(usersController, /UseGuards\(JwtAuthGuard, PermissionsGuard\)/);
  assert.match(usersController, /RequirePermissions\('user:read'\)/);
  assert.match(usersController, /RequirePermissions\('user:write'\)/);
  assert.match(usersService, /Only super admin can change role or status/);
  assert.doesNotMatch(usersService, /req\.user\?\.role !== 'SUPER_ADMIN' && req\.user\?\.role !== 'ADMIN'/);

  assert.match(tenantController, /UseGuards\(JwtAuthGuard, PermissionsGuard\)/);
  assert.match(tenantController, /RequirePermissions\('tenant:read'\)/);
  assert.match(tenantController, /RequirePermissions\('tenant:write'\)/);
  assert.match(tenantService, /user\.role !== 'SUPER_ADMIN' && user\.tenantId !== id/);
  assert.match(tenantService, /Protected tenant fields require super admin/);
  assert.match(tenantService, /Super admin only/);
});
