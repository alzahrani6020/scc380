import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const api = readFileSync(join(process.cwd(), 'src/analytics/analytics.controller.ts'), 'utf8');
const applicant = readFileSync(join(process.cwd(), '../web/src/app/downloads/activity/page.tsx'), 'utf8');
const owner = readFileSync(join(process.cwd(), '../web/src/components/owner/OwnerActivityPanel.tsx'), 'utf8');

test('applicant identity, tenant and resource scope are attributed server-side', () => {
  assert.match(api, /@Post\('activity\/download-request'\)\s*@UseGuards\(JwtAuthGuard\)/);
  assert.match(api, /userId: req\.user\.userId/);
  assert.match(api, /tenantId: req\.user\.tenantId/);
  assert.match(api, /resourceType: 'ACTIVITY_REPORT'/);
  assert.match(api, /days > 31/);
  assert.match(api, /activity\/my-requests/);
});
test('owner decisions are guarded, audited and serialized for the same request', () => {
  assert.match(api, /@Get\('activity\/owner\/requests'\)\s*@UseGuards\(JwtAuthGuard\)/);
  assert.match(api, /@Post\('activity\/owner\/resolve-request'\)\s*@UseGuards\(JwtAuthGuard\)/);
  assert.match(api, /async resolveDownloadRequest[\s\S]{0,280}await this\.requireOwner\(req\)/);
  assert.match(api, /pg_advisory_xact_lock/);
  assert.match(api, /DOWNLOAD_REQUEST_REJECTED/);
  assert.match(api, /requestId: row\.id/);
});
test('approving a date-bounded partial report cannot unlock a different date range', () => {
  assert.match(api, /requestedScope === 'PARTIAL' && from === values\.from && to === values\.to/);
  assert.match(api, /requireExportAccess\(req, scope, invoiceNumber, from, to\)/);
});
test('user and owner interfaces expose real submit, refresh and resolve actions', () => {
  assert.match(applicant, /api\.post\('\/analytics\/activity\/download-request'/);
  assert.match(applicant, /api\.get\('\/analytics\/activity\/my-requests'/);
  assert.match(applicant, /params\.set\('scope', scope\)/);
  assert.match(owner, /api\.get\('\/analytics\/activity\/owner\/requests'/);
  assert.match(owner, /api\.post\('\/analytics\/activity\/owner\/resolve-request'/);
});
