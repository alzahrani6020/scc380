import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const src = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

test('asset custody uses the existing FixedAsset model and database active-assignment guard', () => {
  const schema = src('../../packages/database/prisma/schema.prisma');
  const migration = src('../../packages/database/prisma/migrations/20261112191500_asset_custody/migration.sql');
  assert.match(schema, /model AssetCustodyAssignment/);
  assert.match(schema, /asset\s+FixedAsset\s+@relation/);
  assert.match(migration, /asset_custody_one_active_asset_key/);
  assert.match(migration, /WHERE "status" = 'ACTIVE'/);
  assert.doesNotMatch(migration, /CREATE TABLE "fixed_assets"/);
});

test('custody service is tenant scoped and closes assignments explicitly', () => {
  const service = src('src/hr/asset-custody.service.ts');
  assert.match(service, /tenantWhere\(tenantId\)/);
  assert.match(service, /Fixed asset already has an active custody assignment/);
  assert.match(service, /Only active employees can receive custody/);
  assert.match(service, /status:\s*dto\.status/);
  assert.match(service, /returnedById/);
});

test('offboarding cannot complete while active custody remains', () => {
  const lifecycle = src('src/hr/hr-lifecycle.service.ts');
  assert.match(lifecycle, /lifecycle\.type === 'OFFBOARDING'/);
  assert.match(lifecycle, /assetCustodyAssignment\.count/);
  assert.match(lifecycle, /Employee still has active asset custody assignments/);
});

test('asset custody migration is additive', () => {
  const migration = src('../../packages/database/prisma/migrations/20261112191500_asset_custody/migration.sql');
  assert.match(migration, /CREATE TABLE "asset_custody_assignments"/);
  assert.match(migration, /asset_custody_status_check/);
  assert.doesNotMatch(migration, /(^|\n)\s*DROP\s+/i);
  assert.doesNotMatch(migration, /(^|\n)\s*TRUNCATE\s+/i);
  assert.doesNotMatch(migration, /(^|\n)\s*DELETE\s+FROM\s+/i);
});
