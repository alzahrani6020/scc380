import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const controller = readFileSync(join(process.cwd(), 'src/analytics/analytics.controller.ts'), 'utf8');
const ownerPage = readFileSync(join(process.cwd(), '../web/src/app/owner/activity/page.tsx'), 'utf8');

test('owner delegation is off unless verified email is configured', () => {
  assert.match(controller, /const configured = \(process\.env\.SCC380_ACTIVITY_OWNER_EMAIL \|\| ''\)/);
  assert.match(controller, /if \(!configured \|\| req\.user\?\.role !== 'ADMIN'/);
  assert.match(controller, /account\.emailVerified/);
  assert.match(controller, /account\.status === 'ACTIVE'/);
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
