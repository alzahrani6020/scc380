import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const controller = readFileSync(join(process.cwd(), 'src/analytics/analytics.controller.ts'), 'utf8');
const hrDocuments = readFileSync(join(process.cwd(), 'src/hr/employee-documents.controller.ts'), 'utf8');
const page = readFileSync(join(process.cwd(), '../web/src/components/owner/OwnerInsights.tsx'), 'utf8');

test('operational insights is authenticated and restricted to the configured owner', () => {
  assert.match(controller, /@Get\('activity\/owner\/insights'\)\s*@UseGuards\(JwtAuthGuard\)\s*@ApiBearerAuth\(\)\s*async ownerInsights/);
  const endpoint = controller.slice(controller.indexOf('async ownerInsights('), controller.indexOf("@Get('activity/owner/approvals')"));
  assert.match(endpoint, /await this\.requireOwner\(req\)/);
  assert.match(endpoint, /days < 1 \|\| days > 90/);
  assert.doesNotMatch(endpoint, /prisma\.[a-zA-Z]+\.(?:delete|update|create|upsert)\(/);
});
test('operational KPIs use complete database counts, not limited preview', () => {
  const endpoint = controller.slice(controller.indexOf('async ownerInsights('), controller.indexOf("@Get('activity/owner/approvals')"));
  assert.match(endpoint, /prisma\.auditLog\.count\(/);
  assert.match(endpoint, /prisma\.session\.count\(/);
  assert.match(endpoint, /prisma\.loginAttempt\.count\(/);
  assert.match(endpoint, /prisma\.auditLog\.groupBy\(/);
  assert.match(endpoint, /anonymousVisitors: 'NOT_COLLECTED'/);
  assert.match(endpoint, /deviceDownloadCompletion: 'NOT_VERIFIABLE'/);
});
test('web dashboard clearly states its coverage and only uses owner-authorized API', () => {
  assert.match(page, /\/analytics\/activity\/owner\/insights\?days=/);
  assert.match(page, /لا يشمل هذا التقرير تنزيل جميع أنواع ملفات الموقع/);
  assert.match(page, /الزوار المجهولون غير مسجلين/);
  assert.doesNotMatch(page, /Math\.random\(/);
});

test('actual HR file delivery attempts are recorded server-side after permission and tenant authorization', () => {
  assert.match(hrDocuments, /@RequirePermissions\('hr:documents:read'\)/);
  assert.match(hrDocuments, /await this\.service\.getFile\(req, id\)/);
  assert.match(hrDocuments, /action: 'FILE_DELIVERY_STARTED'/);
  assert.match(hrDocuments, /tenantId: doc\.tenantId/);
  assert.match(hrDocuments, /entityType: 'HR_EMPLOYEE_DOCUMENT'/);
  assert.match(hrDocuments, /return new StreamableFile\(Buffer\.from\(doc\.content\)\)/);
});
test('CSV uses actual UTF-8 BOM and CRLF with spreadsheet formula escaping', () => {
  const exportCode = controller.slice(controller.indexOf('async exportActivity('), controller.indexOf("@Get('alerts')"));
  assert.ok(exportCode.includes(String.raw`'\uFEFF'`));
  assert.ok(exportCode.includes(String.raw`'\r\n'`));
  assert.ok(exportCode.includes(String.raw`replace(/[\r\n]+/g`));
  assert.ok(exportCode.includes(String.raw`/^[\s]*[=+@-]/`));
  assert.equal(exportCode.includes(String.raw`'\\uFEFF'`), false);
  assert.equal(exportCode.includes(String.raw`'\\r\\n'`), false);
});
