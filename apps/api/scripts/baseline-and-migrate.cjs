const { execFileSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const historical = [
  '20260514013541_init',
  '20260514081656_add_tenant_id_to_all_models',
  '20261111174000_add_crm_relations',
];

const hrCoreMigration = '20261112130000_reconcile_hr_core';
const hrIntegrityMigration = '20261112134500_hr_finance_integrity_p0';
const hrCoreTables = ['leaves', 'attendances', 'payrolls', 'shifts'];

function runPrisma(args) {
  execFileSync('pnpm', ['--dir', 'packages/database', 'exec', 'prisma', ...args, '--schema', 'prisma/schema.prisma'], {
    cwd: '/app',
    stdio: 'inherit',
    env: process.env,
  });
}

async function tableExists(name) {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT to_regclass($1)::text AS name',
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

async function enumExists(name) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT EXISTS (
       SELECT 1
       FROM pg_type t
       JOIN pg_namespace n ON n.oid = t.typnamespace
       WHERE n.nspname = 'public' AND t.typname = $1
     ) AS exists`,
    name,
  );
  return Boolean(rows?.[0]?.exists);
}

async function columnsPresent(table, names) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = ANY($2::text[])`,
    table,
    names,
  );
  const found = new Set(rows.map((r) => r.column_name));
  return names.every((name) => found.has(name));
}


async function enumValues(name) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT e.enumlabel AS value
       FROM pg_type t
       JOIN pg_enum e ON e.enumtypid = t.oid
       WHERE t.typname = $1
       ORDER BY e.enumsortorder`,
    name,
  );
  return rows.map((row) => row.value);
}

function assertEnumCompatibility(name, actual, expected) {
  if (actual.length === 0) return;
  const missing = expected.filter((value) => !actual.includes(value));
  if (missing.length > 0) {
    throw new Error(
      `ACCOUNTING_CORE_BLOCKED enum ${name} missing values: ${missing.join(',')}`,
    );
  }
}

async function verifyAccountingCorePreconditions(applied) {
  const migration = '20261112162000_add_journal_header_lines';
  if (applied.has(migration)) return;

  const headerExists = await tableExists('journal_entry_headers');
  const linesExist = await tableExists('journal_entry_lines');
  if (headerExists || linesExist) {
    throw new Error(
      `ACCOUNTING_CORE_BLOCKED unexpected pre-existing tables header=${headerExists} lines=${linesExist}`,
    );
  }

  if (!(await tableExists('tenants'))) {
    throw new Error('ACCOUNTING_CORE_BLOCKED tenants table missing');
  }

  assertEnumCompatibility(
    'AccountType',
    await enumValues('AccountType'),
    ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'],
  );
  assertEnumCompatibility(
    'JournalType',
    await enumValues('JournalType'),
    ['GENERAL', 'ADJUSTING', 'CLOSING', 'REVERSING'],
  );
  assertEnumCompatibility(
    'JournalStatus',
    await enumValues('JournalStatus'),
    ['DRAFT', 'POSTED', 'REVERSED'],
  );

  const financeDependencyColumns = {
    chart_of_accounts: ['id','tenantId','code','name','type','balance','isActive','createdAt','updatedAt'],
    financial_periods: ['id','tenantId','name','year','startDate','endDate','isClosed','createdAt'],
    journal_entries: ['id','tenantId','entryNumber','date','description','debitAmount','creditAmount','accountId','type','status','createdAt'],
  };
  for (const [table, columns] of Object.entries(financeDependencyColumns)) {
    if ((await tableExists(table)) && !(await columnsPresent(table, columns))) {
      throw new Error(`ACCOUNTING_CORE_BLOCKED incomplete columns: ${table}`);
    }
  }

  if (await tableExists('journal_entries')) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE "accountId" IS NULL)::int AS null_account,
         COUNT(*) FILTER (WHERE status::text = 'POSTED')::int AS posted,
         COUNT(*) FILTER (WHERE status::text = 'DRAFT')::int AS draft,
         COUNT(*) FILTER (WHERE status::text = 'REVERSED')::int AS reversed,
         COUNT(DISTINCT "tenantId")::int AS tenants
       FROM "journal_entries"`,
    );
    const stats = rows?.[0] || {};
    console.log(
      'ACCOUNTING_LEGACY_PREFLIGHT',
      JSON.stringify({
        total: Number(stats.total || 0),
        nullAccount: Number(stats.null_account || 0),
        posted: Number(stats.posted || 0),
        draft: Number(stats.draft || 0),
        reversed: Number(stats.reversed || 0),
        tenants: Number(stats.tenants || 0),
      }),
    );
  } else {
    console.log('ACCOUNTING_LEGACY_PREFLIGHT', JSON.stringify({ legacyTable: false }));
  }
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
    'users_tenantId_fkey','audit_logs_tenantId_fkey','contacts_tenantId_fkey','deals_tenantId_fkey',
    'activities_tenantId_fkey','invoices_tenantId_fkey','invoice_items_tenantId_fkey','invoice_items_invoiceId_fkey',
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

async function verifyCrmExpansionPreconditions(applied) {
  if (applied.has('20261111190000_add_crm_companies_pipelines')) return;
  if (!(await tableExists('deals'))) return;

  const pipelineTableExists = await tableExists('pipelines');
  if (!pipelineTableExists) {
    const pipelineColumn = await columnState('deals', 'pipelineId');
    if (pipelineColumn) {
      const rows = await prisma.$queryRawUnsafe(
        'SELECT COUNT(*)::int AS count FROM "deals" WHERE "pipelineId" IS NOT NULL',
      );
      const count = Number(rows?.[0]?.count || 0);
      if (count > 0) {
        throw new Error(`CRM_EXPANSION_BLOCKED legacy deals.pipelineId values=${count}; manual mapping required`);
      }
    }
  }
}

async function reconcileHrCore(applied) {
  if (applied.has(hrCoreMigration)) return;

  const states = [];
  for (const table of hrCoreTables) {
    states.push([table, await tableExists(table)]);
  }
  const existing = states.filter(([, exists]) => exists).map(([table]) => table);

  if (existing.length === 0) {
    console.log('HR_CORE_RECONCILE fresh schema: migration will create HR core tables');
    return;
  }

  if (existing.length !== hrCoreTables.length) {
    throw new Error(
      `HR_CORE_RECONCILE_BLOCKED partial schema existing=${existing.join(',')} expected=${hrCoreTables.join(',')}`,
    );
  }

  const requiredEnums = ['LeaveType', 'LeaveStatus', 'AttendanceStatus', 'PayrollStatus'];
  for (const name of requiredEnums) {
    if (!(await enumExists(name))) {
      throw new Error(`HR_CORE_RECONCILE_BLOCKED missing enum: ${name}`);
    }
  }

  const columnSets = {
    leaves: ['id','tenantId','employeeId','type','startDate','endDate','days','status','createdAt','updatedAt'],
    attendances: ['id','tenantId','employeeId','date','status','createdAt'],
    payrolls: ['id','tenantId','employeeId','month','year','basicSalary','netSalary','status','createdAt','updatedAt'],
    shifts: ['id','tenantId','employeeId','name','startTime','isRecurring','daysOfWeek','createdAt','updatedAt'],
  };

  for (const [table, columns] of Object.entries(columnSets)) {
    if (!(await columnsPresent(table, columns))) {
      throw new Error(`HR_CORE_RECONCILE_BLOCKED incomplete columns: ${table}`);
    }
  }

  const constraints = [
    'leaves_tenantId_fkey','leaves_employeeId_fkey',
    'attendances_tenantId_fkey','attendances_employeeId_fkey',
    'payrolls_tenantId_fkey','payrolls_employeeId_fkey',
    'shifts_tenantId_fkey','shifts_employeeId_fkey',
  ];
  if (!(await constraintsPresent(constraints))) {
    throw new Error('HR_CORE_RECONCILE_BLOCKED foreign keys incomplete');
  }

  console.log(`PRISMA_BASELINE_RESOLVE ${hrCoreMigration}`);
  runPrisma(['migrate', 'resolve', '--applied', hrCoreMigration]);
  applied.add(hrCoreMigration);
}

async function verifyHrIntegrityPreconditions(applied) {
  if (applied.has(hrIntegrityMigration)) return;
  if (!(await tableExists('payrolls'))) return;

  const duplicatePayrolls = await prisma.$queryRawUnsafe(
    `SELECT "tenantId", "employeeId", "year", "month", COUNT(*)::int AS count
       FROM "payrolls"
       GROUP BY "tenantId", "employeeId", "year", "month"
       HAVING COUNT(*) > 1
       LIMIT 10`,
  );
  if (duplicatePayrolls.length > 0) {
    const sample = duplicatePayrolls
      .map((row) => `${row.tenantId}:${row.employeeId}:${row.year}-${row.month} x${row.count}`)
      .join(',');
    throw new Error(`HR_INTEGRITY_BLOCKED duplicate payroll periods: ${sample}`);
  }

  console.log('HR_INTEGRITY_PREFLIGHT_PASS');
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
    await verifyCrmExpansionPreconditions(applied);
    await reconcileHrCore(applied);
    await verifyHrIntegrityPreconditions(applied);
  }

  await verifyAccountingCorePreconditions(applied);

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
