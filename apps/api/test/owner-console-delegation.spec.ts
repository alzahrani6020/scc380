import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const controller = readFileSync(join(process.cwd(), 'src/analytics/analytics.controller.ts'), 'utf8');
const ownerPage = readFileSync(join(process.cwd(), '../web/src/app/owner/activity/page.tsx'), 'utf8');
const ownerLayout = readFileSync(join(process.cwd(), '../web/src/app/owner/layout.tsx'), 'utf8');
const middleware = readFileSync(join(process.cwd(), '../web/src/middleware.ts'), 'utf8');
const ownerRecovery = readFileSync(join(process.cwd(), '../web/src/app/auth/owner-resume/page.tsx'), 'utf8');

test('owner delegation is off unless verified email is configured', () => {
  assert.match(controller, /const configured = \(process\.env\.SCC380_ACTIVITY_OWNER_EMAIL \|\| ''\)/);
  assert.match(controller, /if \(!configured \|\| !\['ADMIN', 'SUPER_ADMIN'\]\.includes\(req\.user\?\.role\)/);
  assert.match(controller, /req\.user\?\.email\?\.toLowerCase\(\) !== configured/);
  assert.match(controller, /!req\.user\?\.sessionId/);
  assert.doesNotMatch(controller.slice(controller.indexOf('private async canManageOwnerConsole'), controller.indexOf('private async requireOwner')), /account\.emailVerified/);
  assert.match(controller, /account\.status === 'ACTIVE'/);
  assert.match(controller, /account\.role === req\.user\.role/);
  assert.match(controller, /account\.email\.toLowerCase\(\) === configured/);
});
test('delegation remains scoped to owner console, without role updates', () => {
  assert.match(controller, /private async requireOwner\(req: any\)/);
  assert.match(controller, /await this\.requireOwner\(req\)/);
  assert.match(controller, /req\.activityOwnerAuthorized = true/);
  assert.doesNotMatch(controller, /prisma\.user\.update\(/);
  assert.doesNotMatch(controller, /req\.user\.role\s*=\s*'SUPER_ADMIN'/);
});
test('owner UI uses server-backed authorization, not a local browser role', () => {
  assert.match(ownerPage, /analytics\/activity\/owner\/status/);
  assert.match(ownerPage, /setOwnerAuthorized\(result\.data\?\.authorized === true\)/);
  assert.doesNotMatch(ownerPage, /getRole\(/);
});

test('owner layout must enforce authenticated API authorization on server before children render', () => {
  assert.match(ownerLayout, /export const dynamic = 'force-dynamic'/);
  assert.match(ownerLayout, /cookies\(\)\.get\('accessToken'\)/);
  assert.match(ownerLayout, /fetch\(getOwnerApiOrigin\(\) \+ '\/analytics\/activity\/owner\/status'/);
  assert.match(ownerLayout, /Authorization: 'Bearer ' \+ token/);
  assert.match(ownerLayout, /cache: 'no-store'/);
  assert.match(ownerLayout, /if \(response\.status === 401\) redirect\('\/auth\/owner-resume'\)/);
  assert.match(ownerLayout, /if \(response\.status === 403 \|\| response\.status === 404\) notFound\(\)/);
  assert.match(ownerLayout, /if \(!authorized\) notFound\(\)/);
  assert.match(ownerLayout, /return <>\{children\}<\/>/);
});

test('owner recovery requires existing HttpOnly refresh session and rechecks private route', () => {
  assert.match(middleware, /path\.startsWith\('\/owner\/'\) && !sessionValid && mayRefresh/);
  assert.match(middleware, /new URL\('\/auth\/owner-resume', request\.url\)/);
  assert.match(ownerRecovery, /sessionAuth\('refresh'/);
  assert.match(ownerRecovery, /setAuth\(/);
  assert.match(ownerRecovery, /window\.location\.replace\('\/owner\/activity'\)/);
  assert.doesNotMatch(ownerRecovery, /SUPER_ADMIN/);
  assert.doesNotMatch(ownerRecovery, /localStorage\.setItem\('role'/);
});
