import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const auth = readFileSync(join(process.cwd(), 'src/auth/auth.service.ts'), 'utf8');
const controller = readFileSync(join(process.cwd(), 'src/auth/auth.controller.ts'), 'utf8');
const page = readFileSync(join(process.cwd(), '../web/src/app/owner/activity/page.tsx'), 'utf8');

test('Google owner proof is bound to exact server-side owner identity and existing account', () => {
  assert.match(auth, /SCC380_ACTIVITY_OWNER_EMAIL/);
  assert.match(auth, /email_verified !== true/);
  assert.match(auth, /payload\.email\.toLowerCase\(\) !== configured/);
  assert.match(auth, /account\.role !== 'ADMIN'/);
  assert.match(auth, /account\.status !== 'ACTIVE'/);
  assert.match(auth, /this\.googleClient\.verifyIdToken/);
  assert.match(auth, /audience: this\.config\.get\('GOOGLE_CLIENT_ID'\)/);
});
test('owner proof never updates roles or admits a user without JWT', () => {
  assert.match(auth, /data: \{ emailVerified: true \}/);
  assert.doesNotMatch(auth, /data: \{ role: 'SUPER_ADMIN' \}/);
  assert.match(controller, /@UseGuards\(JwtAuthGuard\)\s*@ApiBearerAuth\(\)\s*@Post\('owner\/verify-google-email'\)/);
});
test('owner page only unlocks after server confirms access', () => {
  assert.match(page, /auth\/owner\/verify-google-email/);
  assert.match(page, /analytics\/activity\/owner\/status/);
  assert.match(page, /setOwnerAuthorized\(verified\.data\?\.authorized === true\)/);
});
