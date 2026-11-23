import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const api = read('src/owner-files/owner-files.controller.ts');
const schema = read('../../packages/database/prisma/schema.prisma');
const migration = read('../../packages/database/prisma/migrations/20261122010000_owner_file_center/migration.sql');
const owner = read('../web/src/app/owner/files/page.tsx');
const tenant = read('../web/src/app/downloads/files/page.tsx');

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
test('actual owner decisions and tenant requests are wired to the server', () => {
  assert.match(owner, /api\.post\('\/owner-files\/owner\/decide'/);
  assert.match(tenant, /api\.post\('\/owner-files\/requests'/);
  assert.match(tenant, /responseType:'blob'/);
});
