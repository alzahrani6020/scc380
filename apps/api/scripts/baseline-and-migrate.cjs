const { execFileSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const SCHEMA = 'packages/database/prisma/schema.prisma';

const historical = [
  '20260514013541_init',
  '20260514081656_add_tenant_id_to_all_models',
  '20261111174000_add_crm_relations',
];

function runPrisma(args) {
  execFileSync('pnpm', ['exec', 'prisma', ...args, '--schema', SCHEMA], {
    cwd: '/app',
    stdio: 'inherit',
    env: process.env,
  });
}

async function tableExists(name) {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT to_regclass($1) AS name',
    `public.${name}`,
  );
  return Boolean(rows?.[0]?.name);
}

async function columnState(table, column) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT is_nullable
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    table,
    column,
  );
  return rows?.[0] || null;
}

async function constraintsPresent(names) {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT conname FROM pg_constraint WHERE conname = ANY($1::text[])',
    names,
  );
  const found = new Set(rows.map((r) => r.conname));
  return names.every((name) => found.has(name));
}

async function appliedMigrations() {
  const exists = await tableExists('_prisma_migrations');
  if (!exists) return new Set();
  const rows = await prisma.$queryRawUnsafe(
    'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL',
  );
  return new Set(rows.map((r) => r.migration_name));
}

async function verifyInit() {
  const tables = [
    'tenants','users','contacts','deals','activities','invoices','invoice_items',
    'employees','departments','vehicles','fleet_trips',
  ];
  for (const table of tables) {
    if (!(await tableExists(table))) throw new Error(`BASELINE_BLOCKED init missing table: ${table}`);
  }
}

async function verifyTenantMigration() {
  const requiredNotNull = [
    'activities','contacts','deals','departments','employees','fleet_trips',
    'invoice_items','invoices','vehicles',
  ];
  for (const table of requiredNotNull) {
    const column = await columnState(table, 'tenantId');
    if (!column) throw new Error(`BASELINE_BLOCKED tenant migration missing ${table}.tenantId`);
    if (column.is_nullable !== 'NO') {
      throw new Error(`BASELINE_BLOCKED tenant migration expected NOT NULL: ${table}.tenantId`);
    }
  }
  const userTenant = await columnState('users', 'tenantId');
  if (!userTenant) throw new Error('BASELINE_BLOCKED tenant migration missing users.tenantId');

  const constraints = [
    'users_tenantId_fkey','contacts_tenantId_fkey','deals_tenantId_fkey',
    'activities_tenantId_fkey','invoices_tenantId_fkey','invoice_items_tenantId_fkey',
    'employees_tenantId_fkey','departments_tenantId_fkey','vehicles_tenantId_fkey',
    'fleet_trips_tenantId_fkey',
  ];
  if (!(await constraintsPresent(constraints))) {
    throw new Error('BASELINE_BLOCKED tenant migration foreign keys incomplete');
  }
}

async function verifyCrmRelations() {
  const constraints = [
    'contacts_assignedToId_fkey',
    'deals_contactId_fkey',
    'deals_assignedToId_fkey',
    'activities_contactId_fkey',
    'activities_dealId_fkey',
    'activities_assignedToId_fkey',
  ];
  if (!(await constraintsPresent(constraints))) {
    throw new Error('BASELINE_BLOCKED CRM relation constraints incomplete');
  }
}

async function resolveIfNeeded(applied, migration, verify) {
  if (applied.has(migration)) return;
  await verify();
  console.log(`PRISMA_BASELINE_RESOLVE ${migration}`);
  runPrisma(['migrate', 'resolve', '--applied', migration]);
  applied.add(migration);
}

(async () => {
  const hasExistingSchema = await tableExists('tenants');
  const applied = await appliedMigrations();

  if (hasExistingSchema) {
    await resolveIfNeeded(applied, historical[0], verifyInit);
    await resolveIfNeeded(applied, historical[1], verifyTenantMigration);
    await resolveIfNeeded(applied, historical[2], verifyCrmRelations);
  }

  console.log('PRISMA_MIGRATE_DEPLOY_START');
  runPrisma(['migrate', 'deploy']);
  console.log('PRISMA_MIGRATE_DEPLOY_PASS');
})()
  .catch((error) => {
    console.error('PRISMA_MIGRATION_GATE_FAIL', error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
