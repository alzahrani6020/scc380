'use strict';

// Temporary diagnostic only. Do not merge into PR #205 or production branches.
// Baseline: cb3f2d76537113833ea274547e495e413752772c.
// No application bootstrap, business-table reads, mutations, or SQL HTTP route.
// A healthy HTTP listener means process liveness, NOT schema compatibility.
// Suspend the temporary service after collecting the report. Do not self-exit:
// a platform restart could otherwise repeat this one-shot metadata capture.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const EXPECTED_DATABASE = 'scc_main_qbf1';
const EXPECTED_HOST = 'dpg-dboalnjrjlhs73asosf0-a';
const EXPECTED_SCHEMA = 'public';
const EXPECTED_MIGRATION = '20261119070000_reconcile_pos_tables';
const EXPECTED_CHECKSUM = '007a7fd82d6493138cdd85f239b2728a94a5f154f68268d4fd9516e19883f696';
const BASELINE_SHA = 'cb3f2d76537113833ea274547e495e413752772c';
let emitted = false;
let server;
let failureStage = 'SOURCE_CHECKSUM';
const FAILURE_STAGES = new Set(['SOURCE_CHECKSUM', 'CONFIGURATION', 'CLIENT_INIT',
  'READ_ONLY_TRANSACTION', 'CONTEXT', 'TABLES', 'ENUMS', 'COLUMNS', 'CONSTRAINTS',
  'UNIQUE_INDEXES', 'ACCOUNTING_READINESS', 'MIGRATIONS', 'HEALTH']);

function emitOnce(report) {
  if (emitted) return;
  emitted = true;
  if (!report) {
    const stage = FAILURE_STAGES.has(failureStage) ? failureStage : 'INTERNAL';
    process.stdout.write('POS_SCHEMA_PREFLIGHT_FAILED_' + stage + '\n');
    return;
  }
  process.stdout.write('POS_SCHEMA_PREFLIGHT_REPORT_BEGIN\n' +
    JSON.stringify(report, (_key, value) => typeof value === 'bigint' ? value.toString() : value, 2) +
    '\nPOS_SCHEMA_PREFLIGHT_REPORT_END\n');
}

function healthListener() {
  if (server) return;
  failureStage = 'HEALTH';
  const port = Number(process.env.PORT || 10000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    emitOnce(null);
    process.exitCode = 1;
    return;
  }
  server = http.createServer((req, res) => {
    const isHealth = (req.method === 'GET' || req.method === 'HEAD') && req.url === '/healthz';
    res.writeHead(isHealth ? 200 : 404, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(req.method === 'HEAD' ? undefined : isHealth ? 'ok\n' : 'not found\n');
    req.resume();
  });
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  server.keepAliveTimeout = 1000;
  server.on('error', () => { emitOnce(null); process.exitCode = 1; });
  server.listen(port, '0.0.0.0');
}

// Suppress unexpected error text too: driver errors can contain connection details.
process.on('uncaughtException', () => { emitOnce(null); healthListener(); });
process.on('unhandledRejection', () => { emitOnce(null); healthListener(); });
process.on('SIGTERM', () => {
  if (!server) return process.exit(0);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
});
process.on('SIGINT', () => process.emit('SIGTERM'));

async function captureMetadata() {
  const migrationPath = path.resolve(__dirname,
    '../../../packages/database/prisma/migrations', EXPECTED_MIGRATION, 'migration.sql');
  const checksum = crypto.createHash('sha256').update(fs.readFileSync(migrationPath)).digest('hex');
  if (checksum !== EXPECTED_CHECKSUM) throw new Error('SOURCE_MISMATCH');

  failureStage = 'CONFIGURATION';
  const url = new URL(process.env.DATABASE_URL || '');
  if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
      url.hostname !== EXPECTED_HOST || !['', '5432'].includes(url.port) ||
      decodeURIComponent(url.pathname.slice(1)) !== EXPECTED_DATABASE ||
      (url.searchParams.has('schema') && url.searchParams.get('schema') !== EXPECTED_SCHEMA)) {
    throw new Error('TARGET_MISMATCH');
  }
  url.searchParams.set('schema', EXPECTED_SCHEMA);
  url.searchParams.set('connection_limit', '1');
  url.searchParams.set('connect_timeout', '10');
  url.searchParams.set('pool_timeout', '5');
  // Both URLs stay in process memory. Never print them or any environment object.
  const datasourceUrl = url.toString();
  process.env.DIRECT_URL = datasourceUrl;
  failureStage = 'CLIENT_INIT';
  const { PrismaClient } = require('@prisma/client');
  const client = new PrismaClient({ datasourceUrl, log: [], errorFormat: 'minimal' });
  try {
    failureStage = 'READ_ONLY_TRANSACTION';
    return await client.$transaction(async (tx) => {
      // The first transaction statement prohibits all persistent writes.
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      await tx.$executeRaw`SET LOCAL statement_timeout = '10s'`;
      await tx.$executeRaw`SET LOCAL lock_timeout = '1s'`;
      await tx.$executeRaw`SET LOCAL idle_in_transaction_session_timeout = '15s'`;
      await tx.$executeRaw`SET LOCAL search_path = public`;
      failureStage = 'CONTEXT';
      const [context] = await tx.$queryRaw`
        SELECT pg_catalog.current_database() AS database_name,
               pg_catalog.current_schema() AS schema_name,
               pg_catalog.current_setting('transaction_read_only') AS read_only,
               pg_catalog.current_setting('transaction_isolation') AS isolation,
               pg_catalog.current_setting('statement_timeout') AS statement_timeout,
               pg_catalog.current_setting('lock_timeout') AS lock_timeout,
               pg_catalog.has_schema_privilege('public', 'USAGE') AS schema_usage_privilege,
               pg_catalog.has_schema_privilege('public', 'CREATE') AS schema_create_privilege,
               (pg_catalog.to_regclass('public.branches') IS NOT NULL) AS migration_would_attempt_branch_fks
      `;
      if (!context || context.database_name !== EXPECTED_DATABASE ||
          context.schema_name !== EXPECTED_SCHEMA || context.read_only !== 'on' ||
          context.isolation !== 'repeatable read') throw new Error('READ_CONTEXT_MISMATCH');

      failureStage = 'TABLES';
      const tables = await tx.$queryRaw`
        WITH expected(name) AS (VALUES ('pos_sessions'), ('pos_orders'), ('pos_order_items'),
          ('pos_payments'), ('products'), ('stock_movements'), ('tenants'), ('users'),
          ('branches'), ('_prisma_migrations'))
        SELECT e.name AS table_name, c.oid IS NOT NULL AS present,
               c.relkind::text AS relation_kind, c.relrowsecurity AS row_security,
               c.relforcerowsecurity AS forced_row_security,
               CASE WHEN c.oid IS NOT NULL AND e.name IN ('tenants','products','branches')
                 THEN pg_catalog.has_table_privilege(c.oid, 'REFERENCES') ELSE NULL END AS references_privilege,
               CASE WHEN c.oid IS NOT NULL AND e.name = '_prisma_migrations'
                 THEN pg_catalog.has_table_privilege(c.oid, 'SELECT') ELSE NULL END AS select_privilege
        FROM expected e
        LEFT JOIN pg_catalog.pg_namespace n ON n.nspname = 'public'
        LEFT JOIN pg_catalog.pg_class c ON c.relnamespace = n.oid AND c.relname = e.name
        ORDER BY e.name
      `;
      failureStage = 'ENUMS';
      const enums = await tx.$queryRaw`
        WITH expected(name) AS (VALUES ('SessionStatus'), ('PosOrderStatus'),
          ('PosPaymentMethod'), ('StockMovementType'))
        SELECT x.name AS type_name, t.oid IS NOT NULL AS present, t.typtype::text AS type_kind,
               COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder)
                 FILTER (WHERE e.enumlabel IS NOT NULL), ARRAY[]::text[]) AS labels
        FROM expected x
        LEFT JOIN pg_catalog.pg_namespace n ON n.nspname = 'public'
        LEFT JOIN pg_catalog.pg_type t ON t.typnamespace = n.oid AND t.typname = x.name
        LEFT JOIN pg_catalog.pg_enum e ON e.enumtypid = t.oid
        GROUP BY x.name, t.oid, t.typtype
        ORDER BY x.name
      `;
      failureStage = 'COLUMNS';
      const columns = await tx.$queryRaw`
        SELECT c.relname::text AS table_name, a.attname::text AS column_name,
               a.attnum::integer AS ordinal, pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
               a.attnotnull AS not_null, a.atthasdef AS has_default,
               a.attidentity::text AS identity_kind, a.attgenerated::text AS generated_kind
        FROM pg_catalog.pg_attribute a
        JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND a.attnum > 0 AND NOT a.attisdropped AND (
          c.relname IN ('pos_sessions','pos_orders','pos_order_items','pos_payments','stock_movements')
          OR (c.relname = 'products' AND a.attname IN
            ('id','tenantId','name','salePrice','taxRate','currentStock','costPrice','isActive','isService'))
          OR (c.relname = 'users' AND a.attname IN ('id','tenantId','preferences'))
          OR (c.relname = 'tenants' AND a.attname IN ('id','settings'))
          OR (c.relname = 'branches' AND a.attname IN ('id','tenantId')))
        ORDER BY c.relname, a.attnum
      `;
      failureStage = 'CONSTRAINTS';
      const constraints = await tx.$queryRaw`
        SELECT c.relname::text AS table_name, k.conname::text AS constraint_name,
               k.contype::text AS constraint_kind, k.convalidated AS validated,
               k.condeferrable AS deferrable, k.condeferred AS initially_deferred,
               ARRAY(SELECT a.attname::text
                 FROM pg_catalog.unnest(k.conkey) WITH ORDINALITY AS x(num, ord)
                 JOIN pg_catalog.pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = x.num
                 ORDER BY x.ord) AS columns,
               rn.nspname::text AS referenced_schema, r.relname::text AS referenced_table,
               ARRAY(SELECT a.attname::text
                 FROM pg_catalog.unnest(k.confkey) WITH ORDINALITY AS x(num, ord)
                 JOIN pg_catalog.pg_attribute a ON a.attrelid = k.confrelid AND a.attnum = x.num
                 ORDER BY x.ord) AS referenced_columns,
               k.confdeltype::text AS on_delete, k.confupdtype::text AS on_update,
               (k.conbin IS NOT NULL) AS has_check_expression
        FROM pg_catalog.pg_constraint k
        JOIN pg_catalog.pg_class c ON c.oid = k.conrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_catalog.pg_class r ON r.oid = k.confrelid
        LEFT JOIN pg_catalog.pg_namespace rn ON rn.oid = r.relnamespace
        WHERE n.nspname = 'public' AND c.relname IN
          ('pos_sessions','pos_orders','pos_order_items','pos_payments','products','stock_movements','tenants','branches')
        ORDER BY c.relname, k.conname
      `;
      failureStage = 'UNIQUE_INDEXES';
      const uniqueIndexes = await tx.$queryRaw`
        SELECT c.relname::text AS table_name, ic.relname::text AS index_name,
               am.amname::text AS access_method, i.indisprimary AS primary_key,
               i.indisvalid AS valid, i.indisready AS ready, i.indislive AS live,
               (i.indpred IS NOT NULL) AS partial, (i.indexprs IS NOT NULL) AS expression,
               ARRAY(SELECT COALESCE(a.attname::text, '<expression>')
                 FROM pg_catalog.unnest(i.indkey::smallint[]) WITH ORDINALITY AS x(num, ord)
                 LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = x.num
                 WHERE x.ord <= i.indnkeyatts ORDER BY x.ord) AS key_columns
        FROM pg_catalog.pg_index i
        JOIN pg_catalog.pg_class c ON c.oid = i.indrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_catalog.pg_class ic ON ic.oid = i.indexrelid
        JOIN pg_catalog.pg_am am ON am.oid = ic.relam
        WHERE n.nspname = 'public' AND i.indisunique AND c.relname IN
          ('pos_sessions','pos_orders','pos_order_items','pos_payments','products','stock_movements','tenants','branches')
        ORDER BY c.relname, ic.relname
      `;

      failureStage = 'UNIQUE_INDEXES';
      const allPosIndexes = await tx.$queryRaw`
        SELECT c.relname::text AS table_name, ic.relname::text AS index_name,
          i.indisunique AS unique, i.indisvalid AS valid, i.indisready AS ready,
          i.indpred IS NOT NULL AS partial, i.indexprs IS NOT NULL AS expression,
          ARRAY(SELECT COALESCE(a.attname::text, '<expression>')
            FROM pg_catalog.unnest(i.indkey::smallint[]) WITH ORDINALITY AS x(num, ord)
            LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = x.num
            WHERE x.ord <= i.indnkeyatts ORDER BY x.ord) AS key_columns
        FROM pg_catalog.pg_index i
        JOIN pg_catalog.pg_class c ON c.oid = i.indrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_catalog.pg_class ic ON ic.oid = i.indexrelid
        WHERE n.nspname = 'public' AND c.relname IN
          ('pos_sessions','pos_orders','pos_order_items','pos_payments')
        ORDER BY c.relname, ic.relname
      `;
      const posDefaults = await tx.$queryRaw`
        SELECT c.relname::text AS table_name, a.attname::text AS column_name,
          pg_catalog.pg_get_expr(d.adbin, d.adrelid) AS expression
        FROM pg_catalog.pg_attrdef d
        JOIN pg_catalog.pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
        JOIN pg_catalog.pg_class c ON c.oid = d.adrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname IN
          ('pos_sessions','pos_orders','pos_order_items','pos_payments')
        ORDER BY c.relname, a.attname
      `;
      failureStage = 'MIGRATIONS';
      const migrationTable = tables.find((t) => t.table_name === '_prisma_migrations');
      let migrationHistory = [];
      if (migrationTable && migrationTable.present) {
        // Refuse a view/foreign-table substitute. Do not select migration logs.
        if (!['r', 'p'].includes(migrationTable.relation_kind)) throw new Error('INVALID_MIGRATION_TABLE');
        migrationHistory = await tx.$queryRaw`
          SELECT migration_name, checksum, started_at, finished_at, rolled_back_at, applied_steps_count
          FROM public._prisma_migrations
          ORDER BY started_at DESC, migration_name
          LIMIT 1001
        `;
      }
      const migrationHistoryTruncated = migrationHistory.length > 1000;
      if (migrationHistoryTruncated) throw new Error('MIGRATION_HISTORY_TOO_LARGE');
      const expectedEntries = migrationHistory.filter((m) => m.migration_name === EXPECTED_MIGRATION);
      // Additional release gate: aggregate counts only, never account identities,
      // customer data, journal amounts, or user identifiers.
      failureStage = 'ACCOUNTING_READINESS';
      const [financialReadiness] = await tx.$queryRaw`
        WITH active_tenants AS (
          SELECT id, settings
          FROM public.tenants WHERE status = 'ACTIVE'
        ), required_roles(role, fallback_code) AS (
          VALUES ('CASH','1110'), ('INVENTORY','1130'),
                 ('VAT_PAYABLE','2110'), ('SALES_REVENUE','4100'), ('COGS','5600')
        ), role_checks AS (
          SELECT t.id AS tenant_id, r.role,
            COALESCE(NULLIF(t.settings->'accounting'->'accountMapping'->>r.role, ''), r.fallback_code) AS code
          FROM active_tenants t CROSS JOIN required_roles r
        ), ready AS (
          SELECT rc.tenant_id, COUNT(a.id) AS available
          FROM role_checks rc LEFT JOIN public.chart_of_accounts a
            ON a."tenantId"=rc.tenant_id AND a.code=rc.code AND a."isActive"=true
          GROUP BY rc.tenant_id
        )
        SELECT
          (SELECT COUNT(*)::integer FROM active_tenants) AS active_tenants,
          (SELECT COUNT(*)::integer FROM ready WHERE available=5) AS all_required_accounts_ready,
          (SELECT COUNT(*)::integer FROM ready WHERE available<5) AS missing_required_accounts,
          (SELECT COUNT(*)::integer FROM public.products WHERE "isActive"=true AND "isService"=false AND "currentStock">0) AS in_stock_products,
          (SELECT COUNT(*)::integer FROM public.pos_sessions WHERE status='OPEN') AS open_pos_sessions,
          (SELECT COUNT(*)::integer FROM public.pos_orders) AS prior_pos_orders
      `;
      failureStage = 'MIGRATIONS';
      const runtimeSha = process.env.RENDER_GIT_COMMIT || '';
      return {
        report: 'POS_SCHEMA_PREFLIGHT', status: 'METADATA_CAPTURED', capturedAt: new Date().toISOString(),
        baselineSha: BASELINE_SHA, probeSha: /^[a-f0-9]{40}$/.test(runtimeSha) ? runtimeSha : null,
        expectedHost: EXPECTED_HOST,
        context, tables, enums, columns, constraints, uniqueIndexes, allPosIndexes, posDefaults, financialReadiness,
        expectedMigration: {
          name: EXPECTED_MIGRATION, expectedChecksum: EXPECTED_CHECKSUM, sourceChecksumVerified: true,
          recorded: expectedEntries.length > 0,
          appliedWithMatchingChecksum: expectedEntries.some((m) =>
            m.checksum === EXPECTED_CHECKSUM && m.finished_at !== null && m.rolled_back_at === null),
        },
        migrationHistory,
        limits: ['Metadata only; no business rows or counts.',
          'Defaults, check expressions, index expressions, and migration logs are not emitted.',
          'This report does not approve migration, schema changes, or production sales.'],
      };
    }, { isolationLevel: 'RepeatableRead', timeout: 45000, maxWait: 5000 });
  } finally {
    // Never expose driver exception text, including on disconnect.
    await client.$disconnect().catch(() => {});
  }
}

captureMetadata().then((report) => emitOnce(report)).catch(() => emitOnce(null)).finally(healthListener);
