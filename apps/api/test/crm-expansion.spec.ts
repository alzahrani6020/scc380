import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseCsv, csvCell } from '../src/crm/crm-csv.service';

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const root = (path: string) => readFileSync(join(process.cwd(), '../..', path), 'utf8');

test('CSV parser handles quoted commas, quotes and CRLF dynamically', () => {
  const rows = parseCsv('firstName,lastName,companyName\r\n"Ali","A","ACME, Riyadh"\r\n"Sa""eed","B","X"');
  assert.deepEqual(rows, [
    ['firstName', 'lastName', 'companyName'],
    ['Ali', 'A', 'ACME, Riyadh'],
    ['Sa"eed', 'B', 'X'],
  ]);
  assert.equal(csvCell('ACME, Riyadh'), '"ACME, Riyadh"');
  assert.equal(csvCell('a"b'), '"a""b"');
});

test('CRM schema defines tenant-owned companies and dynamic pipelines', () => {
  const schema = root('packages/database/prisma/schema.prisma');
  assert.match(schema, /model Company \{/);
  assert.match(schema, /model Pipeline \{/);
  assert.match(schema, /model PipelineStage \{/);
  assert.match(schema, /company\s+Company\?\s+@relation\("CompanyDeals"/);
  assert.match(schema, /pipeline\s+Pipeline\?\s+@relation/);
  assert.match(schema, /pipelineStage\s+PipelineStage\?\s+@relation/);
});

test('CRM expansion migration is additive and guarded', () => {
  const migration = root('packages/database/prisma/migrations/20261111190000_add_crm_companies_pipelines/migration.sql');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "companies"/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "pipelines"/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "pipeline_stages"/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "companyId"/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "pipelineStageId"/);
  assert.doesNotMatch(migration, /(^|\n)\s*DROP\s+/i);
  assert.doesNotMatch(migration, /(^|\n)\s*TRUNCATE\s+/i);
  assert.doesNotMatch(migration, /(^|\n)\s*DELETE\s+FROM\s+/i);
  assert.doesNotMatch(migration, /(^|\n)\s*UPDATE\s+["a-z]/i);
});

test('production startup is fail-closed on Prisma migration gate', () => {
  const dockerfile = src('Dockerfile');
  const gate = src('scripts/baseline-and-migrate.cjs');
  assert.match(dockerfile, /baseline-and-migrate\.cjs && node apps\/api\/dist\/main\.js/);
  assert.match(gate, /BASELINE_BLOCKED/);
  assert.match(gate, /PRISMA_MIGRATE_DEPLOY_PASS/);
  assert.match(gate, /migrate', 'resolve'/);
  assert.match(gate, /migrate', 'deploy'/);
  assert.match(gate, /CRM_EXPANSION_BLOCKED legacy deals\.pipelineId/);
  assert.match(gate, /audit_logs_tenantId_fkey/);
  assert.match(gate, /invoice_items_invoiceId_fkey/);
});

test('CRM module registers company pipeline and CSV controllers/services', () => {
  const module = src('src/crm/crm.module.ts');
  for (const symbol of ['CompaniesController','CompaniesService','PipelinesController','PipelinesService','CrmCsvController','CrmCsvService']) {
    assert.match(module, new RegExp(symbol));
  }
});

test('deal service enforces tenant-safe dynamic pipeline references', () => {
  const service = src('src/crm/deals.service.ts');
  assert.match(service, /Pipeline stage does not belong to the selected pipeline/);
  assert.match(service, /Company not found in your tenant/);
  assert.match(service, /Pipeline not found in your tenant/);
  assert.match(service, /Pipeline stage not found in your tenant/);
  assert.match(service, /data\.pipelineId = dto\.pipelineId \|\| stage\.pipelineId/);
});

test('CSV workflow has preview, duplicate detection and bounded imports', () => {
  const service = src('src/crm/crm-csv.service.ts');
  assert.match(service, /MAX_CSV_BYTES = 1024 \* 1024/);
  assert.match(service, /MAX_ROWS = 1000/);
  assert.match(service, /Duplicate email inside CSV/);
  assert.match(service, /dryRun/);
  assert.match(service, /skippedDuplicates/);
});
