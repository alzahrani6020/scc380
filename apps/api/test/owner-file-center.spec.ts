import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const api = read('src/owner-files/owner-files.controller.ts');
const bootstrap = read('src/main.ts');
const schema = read('../../packages/database/prisma/schema.prisma');
const migration = read('../../packages/database/prisma/migrations/20261122010000_owner_file_center/migration.sql');
// Owner operations moved to a shared panel when the console was unified; the old URL redirects here.
const owner = read('../web/src/components/owner/OwnerFilesPanel.tsx');
const tenant = read('../web/src/app/downloads/files/page.tsx');

test('file upload parser is scoped to owner-files and large enough for 1 MiB base64 content', () => {
  assert.match(bootstrap, /app\.use\('\/owner-files'/);
  assert.match(bootstrap, /json\(\{ limit: '1500kb' \}\)/);
});
test('file storage and requests have composite tenant-scoped foreign keys', () => {
  assert.match(schema, /model OwnerFile\s*\{/);
  assert.match(schema, /model OwnerFileRequest\s*\{/);
  assert.match(schema, /@relation\(fields: \[fileId, tenantId\], references: \[id, tenantId\]/);
  assert.match(migration, /FOREIGN KEY \("fileId","tenantId"\)/);
  assert.match(migration, /CHECK \("scope" IN \('FULL','PARTIAL'\)\)/);
  assert.doesNotMatch(migration, /(^|\n)\s*(DROP|TRUNCATE|DELETE)\s+/i);
});
test('API requires real JWT tenant identity, never a tenant field supplied by browser', () => {
  assert.match(api, /@UseGuards\(JwtAuthGuard\)/);
  assert.match(api, /req\.user\?\.tenantId/);
  assert.match(api, /req\.user\.userId/);
  assert.match(api, /tenantId: this\.tenant\(req\)/);
  assert.match(api, /where: \{ id, tenantId, requesterId: req\.user\.userId \}/);
  assert.match(api, /this\.owner\(req\)/);
  assert.doesNotMatch(api, /@Headers\('x-tenant-id'\)/);
});
test('authorization verifies exact owner, prevents self approval and serializes decisions', () => {
  assert.match(api, /SCC380_ACTIVITY_OWNER_EMAIL/);
  assert.match(api, /pg_advisory_xact_lock/);
  assert.match(api, /Self approval prohibited/);
  assert.match(api, /current\.status === 'PENDING'/);
  assert.match(api, /OWNER_FILE_' \+ status/);
});
test('file payment is bound to tenant, verified identity, exact SKU, and fully settled invoice', () => {
  assert.match(api, /emailVerified/);
  assert.match(api, /tenantId, invoiceNumber, status: 'PAID'/);
  assert.match(api, /SCC380-FILE-/);
  assert.match(api, /x\.status === 'COMPLETED'/);
  assert.match(api, /settled \+ 0\.009 >= Number\(invoice\.total\)/);
  assert.match(api, /FILE_PROVIDER_SETTLEMENT_VERIFIED/);
  assert.match(api, /TRUSTED_GATEWAY/);
  assert.match(api, /proof\.scope !== scope/);
});
test('partial delivery validates text lines and bounded PDF pages', () => {
  assert.match(api, /PDFDocument\.load/);
  assert.match(api, /PDFDocument\.create/);
  assert.match(api, /target\.copyPages\(source, indexes\)/);
  assert.match(api, /pdf\.getPageCount\(\)/);
  assert.match(api, /endLine as number\) - \(startLine as number\) > 499/);
  assert.match(api, /slice\(request\.startLine! - 1, request\.endLine!\)/);
  assert.match(api, /HTTP_ONLY/);
  assert.match(api, /OWNER_FILE_HTTP_RESPONSE_INTERRUPTED/);
});
test('existing HR and ERP records are only indexed through their permission-protected endpoints', () => {
  assert.match(tenant, /api\.get<\{ data: HrDocumentIndex\[\] \}>\('\/hr\/employee-documents'\)/);
  assert.match(tenant, /api\.get<InvoiceIndex\[\] \| \{ data: InvoiceIndex\[\] \}>\('\/erp\/invoices'\)/);
  assert.match(tenant, /Promise\.allSettled/);
  assert.match(tenant, /status: 'denied'/);
  assert.doesNotMatch(api, /employeeDocument\.findMany/);
  assert.doesNotMatch(api, /invoice\.findMany/);
});
test('actual owner decisions and tenant requests are wired to the server', () => {
  assert.match(owner, /api\.post\('\/owner-files\/owner\/decide'/);
  assert.match(tenant, /api\.post\('\/owner-files\/requests'/);
  assert.match(tenant, /responseType:'blob'/);
});

test('file, personal request, owner approval and audit endpoints paginate with validated offsets', () => {
  assert.match(api, /private offset\(value: string \| undefined\): number/);
  assert.match(api, /Number\.isSafeInteger\(offset\)/);
  assert.match(api, /@Query\('offset'\) offsetParam\?: string/g);
  assert.match(api, /skip: this\.offset\(offsetParam\), take: 100/);
  assert.match(api, /skip: offset, take: 200/);
  assert.match(api, /skip: this\.offset\(offsetParam\), take: 100/);
  assert.match(owner, /loadMoreAudits/);
  assert.match(owner, /owner\/audit/);
  assert.match(tenant, /loadMoreFiles/);
  assert.match(tenant, /loadMoreRequests/);
});
test('file download audit failures are observable, never silently swallowed', () => {
  assert.match(api, /OWNER_FILE_HTTP_AUDIT_WRITE_FAILED/);
  assert.doesNotMatch(api, /catch\(\(\) => undefined\)/);
});
