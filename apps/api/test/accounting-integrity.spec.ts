import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = (relative: string) => readFileSync(join(process.cwd(), relative), 'utf8');

test('posted journals are immutable and closed periods are enforced', () => {
  const service = src('src/finance/journal-entries.service.ts');
  assert.match(service, /existing\.status === 'POSTED'/);
  assert.match(service, /Posted journal entries are immutable/);
  assert.match(service, /Posted journal entries cannot be deleted/);
  assert.match(service, /financialPeriod\.findFirst/);
  assert.match(service, /isClosed:\s*true/);
  assert.match(service, /Exactly one of debitAmount or creditAmount/);
  assert.match(service, /Active chart account not found for tenant/);
});

test('journal reversal is non-destructive and creates an opposite posted entry', () => {
  const service = src('src/finance/journal-entries.service.ts');
  const controller = src('src/finance/journal-entries.controller.ts');
  assert.match(controller, /@Post\(':id\/reverse'\)/);
  assert.match(service, /debitAmount:\s*existing\.creditAmount/);
  assert.match(service, /creditAmount:\s*existing\.debitAmount/);
  assert.match(service, /status:\s*'POSTED'/);
});

test('financial statements consume posted journals and expose period filters', () => {
  const service = src('src/reports/reports.service.ts');
  const controller = src('src/reports/reports.controller.ts');
  assert.match(service, /status:\s*'POSTED'/);
  assert.match(controller, /@Query\('from'\)/);
  assert.match(controller, /@Query\('to'\)/);
  assert.match(controller, /@Query\('asOfDate'\)/);
});

test('VAT input comes from supplier invoices instead of synthetic expense VAT', () => {
  const service = src('src/reports/reports.service.ts');
  assert.match(service, /prisma\.supplierInvoice\.aggregate/);
  assert.doesNotMatch(service, /prisma\.expense\.aggregate/);
  assert.doesNotMatch(service, /\*\s*0\.15/);
});

test('supplier invoices preserve explicit zero VAT and block overpayment', () => {
  const service = src('src/supplier-invoice/supplier-invoice.service.ts');
  const controller = src('src/supplier-invoice/supplier-invoice.controller.ts');
  assert.match(service, /invoiceData\.taxAmount \?\?/);
  assert.match(service, /تتجاوز الرصيد المتبقي/);
  assert.doesNotMatch(controller, /@Headers\('x-tenant-id'\)/);
  assert.doesNotMatch(controller, /@Headers\('x-user-role'\)/);
  assert.match(controller, /req\.user\?\.tenantId/);
});

test('chart accounts with ledger history cannot be deleted', () => {
  const service = src('src/finance/chart-of-accounts.service.ts');
  assert.match(service, /prisma\.journalEntry\.count/);
  assert.match(service, /cannot be deleted; deactivate it instead/);
});


test('journal header-line migration is additive and preserves legacy journal table', () => {
  const migration = readFileSync(
    join(process.cwd(), '../../packages/database/prisma/migrations/20261112162000_add_journal_header_lines/migration.sql'),
    'utf8',
  );
  assert.match(migration, /CREATE TABLE "journal_entry_headers"/);
  assert.match(migration, /CREATE TABLE "journal_entry_lines"/);
  assert.match(migration, /journal_entry_lines_amount_check/);
  assert.doesNotMatch(migration, /ALTER TABLE "journal_entries"/i);
  assert.doesNotMatch(migration, /(^|\n)\s*DROP\s+/i);
  assert.doesNotMatch(migration, /(^|\n)\s*TRUNCATE\s+/i);
  assert.doesNotMatch(migration, /(^|\n)\s*DELETE\s+FROM\s+/i);
});

test('accounting posting core enforces balanced transactional double-entry', () => {
  const service = src('src/accounting-core/accounting-posting.service.ts');
  assert.match(service, /lines\.length < 2/);
  assert.match(service, /Journal is not balanced/);
  assert.match(service, /prisma\.\$transaction/);
  assert.match(service, /journalEntryHeader\.create/);
  assert.match(service, /sourceType/);
  assert.match(service, /sourceId/);
});

test('approved payroll runs can post one balanced multi-line accrual journal', () => {
  const service = src('src/hr/payroll-runs.service.ts');
  const controller = src('src/hr/payroll-runs.controller.ts');
  assert.match(controller, /@Post\(':id\/post-accounting'\)/);
  assert.match(controller, /@RequirePermissions\('hr:write', 'erp:write'\)/);
  assert.match(service, /sourceType:\s*'PAYROLL_RUN'/);
  assert.match(service, /gross - \(net \+ deductions\)/);
  assert.match(service, /expenseAccountId/);
  assert.match(service, /netPayableAccountId/);
  assert.match(service, /gosiPayableAccountId/);
  assert.match(service, /taxPayableAccountId/);
  assert.match(service, /otherDeductionAccountId/);
});

test('account mapping is tenant-aware and supports explicit tenant overrides', () => {
  const service = src('src/accounting-core/account-mapping.service.ts');
  assert.match(service, /DEFAULT_CODES/);
  assert.match(service, /readAccounting\(settings\)\.accountMapping/);
  assert.match(service, /autoPostingEnabled === true/);
  assert.match(service, /resolveInTransaction/);
  assert.match(service, /tenantId, code: \{ in: codes \}, isActive: true/);
  assert.match(service, /Missing active accounting mappings/);
  assert.doesNotMatch(service, /findFirst\(\{\s*where:\s*\{\s*code:/);
});


test('dual write is atomic and preserves deterministic legacy line numbers', () => {
  const service = src('src/accounting-core/accounting-dual-write.service.ts');
  assert.match(service, /prisma\.\$transaction/);
  assert.match(service, /postInTransaction\(tx, input\)/);
  assert.match(service, /async postInTransaction\(tx: Prisma\.TransactionClient/);
  assert.match(service, /tx\.journalEntry\.createMany/);
  assert.match(service, /entryNumber: \`LEG-\$\{input\.tenantId\}-\$\{input\.entryNumber\}-L\$\{index \+ 1\}\`/);
  assert.match(service, /status:\s*JournalStatus\.POSTED/);
});


test('production startup blocks conflicting accounting-core migration state before migrate deploy', () => {
  const script = src('scripts/baseline-and-migrate.cjs');
  assert.match(script, /verifyAccountingCorePreconditions/);
  assert.match(script, /ACCOUNTING_CORE_BLOCKED/);
  assert.match(script, /journal_entry_headers/);
  assert.match(script, /journal_entry_lines/);
  assert.match(script, /assertEnumCompatibility/);
  assert.match(script, /ACCOUNTING_LEGACY_PREFLIGHT/);
  assert.match(script, /await verifyAccountingCorePreconditions\(applied\)/);
  assert.ok(
    script.indexOf('await verifyAccountingCorePreconditions(applied)') <
      script.indexOf("console.log('PRISMA_MIGRATE_DEPLOY_START')"),
  );
});


test('invoice schema reconciliation is additive only', () => {
  const migration = readFileSync(
    join(process.cwd(), '../../packages/database/prisma/migrations/20261112163000_reconcile_invoice_zatca_columns/migration.sql'),
    'utf8',
  );
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "zatcaSignedXml"/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "retentionUntil"/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "productId"/);
  assert.doesNotMatch(migration, /(^|\n)\s*DROP\s+/i);
  assert.doesNotMatch(migration, /(^|\n)\s*TRUNCATE\s+/i);
  assert.doesNotMatch(migration, /(^|\n)\s*DELETE\s+FROM\s+/i);
  assert.doesNotMatch(migration, /(^|\n)\s*UPDATE\s+["a-z]/i);
});


test('accounting dependency reconciliation is additive and startup-gated', () => {
  const migration = readFileSync(
    join(process.cwd(), '../../packages/database/prisma/migrations/20261112164000_reconcile_accounting_dependencies/migration.sql'),
    'utf8',
  );
  const startup = src('scripts/baseline-and-migrate.cjs');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "chart_of_accounts"/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "financial_periods"/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "journal_entries"/);
  assert.doesNotMatch(migration, /(^|\n)\s*DROP\s+/i);
  assert.doesNotMatch(migration, /(^|\n)\s*TRUNCATE\s+/i);
  assert.doesNotMatch(migration, /(^|\n)\s*DELETE\s+FROM\s+/i);
  assert.doesNotMatch(migration, /(^|\n)\s*UPDATE\s+["a-z]/i);
  assert.match(startup, /verifyAccountingDependenciesPreconditions/);
  assert.match(startup, /ACCOUNTING_DEPENDENCIES_BLOCKED/);
  assert.match(startup, /await verifyAccountingDependenciesPreconditions\(applied\)/);
});

test('customer payment schema reconciliation is additive and startup-gated', () => {
  const migration = readFileSync(
    join(process.cwd(), '../../packages/database/prisma/migrations/20261112165000_reconcile_customer_payments/migration.sql'),
    'utf8',
  );
  const startup = src('scripts/baseline-and-migrate.cjs');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "payments"/);
  assert.match(migration, /CREATE TYPE "PaymentMethod"/);
  assert.match(migration, /CREATE TYPE "PaymentStatus"/);
  assert.doesNotMatch(migration, /(^|\n)\s*DROP\s+/i);
  assert.doesNotMatch(migration, /(^|\n)\s*TRUNCATE\s+/i);
  assert.doesNotMatch(migration, /(^|\n)\s*DELETE\s+FROM\s+/i);
  assert.match(startup, /verifyPaymentSchemaPreconditions/);
  assert.match(startup, /PAYMENT_SCHEMA_BLOCKED/);
  assert.match(startup, /await verifyPaymentSchemaPreconditions\(applied\)/);
});


test('supplier AP schema reconciliation is additive and startup-gated', () => {
  const migration = readFileSync(
    join(process.cwd(), '../../packages/database/prisma/migrations/20261112170000_reconcile_supplier_ap_accounting/migration.sql'),
    'utf8',
  );
  const startup = src('scripts/baseline-and-migrate.cjs');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "suppliers"/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "supplier_invoices"/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "supplier_invoice_items"/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "supplier_payments"/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "accountId"/);
  assert.doesNotMatch(migration, /(^|\n)\s*DROP\s+/i);
  assert.doesNotMatch(migration, /(^|\n)\s*TRUNCATE\s+/i);
  assert.doesNotMatch(migration, /(^|\n)\s*DELETE\s+FROM\s+/i);
  assert.doesNotMatch(migration, /(^|\n)\s*UPDATE\s+["a-z]/i);
  assert.match(startup, /verifySupplierApPreconditions/);
  assert.match(startup, /SUPPLIER_AP_BLOCKED/);
  assert.match(startup, /await verifySupplierApPreconditions\(applied\)/);
});



test('expense accounting is explicit-account, additive, and reversal-safe', () => {
  const migration = readFileSync(
    join(process.cwd(), '../../packages/database/prisma/migrations/20261112171000_reconcile_expense_accounting/migration.sql'),
    'utf8',
  );
  const startup = src('scripts/baseline-and-migrate.cjs');
  const service = src('src/finance/expenses.service.ts');
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "debitAccountId"/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "creditAccountId"/);
  assert.doesNotMatch(migration, /(^|\n)\s*(DROP|TRUNCATE|DELETE\s+FROM)\s+/i);
  assert.match(startup, /verifyExpenseAccountingPreconditions/);
  assert.match(service, /requires debitAccountId and creditAccountId/);
  assert.match(service, /sourceType:\s*'EXPENSE'/);
  assert.match(service, /postInTransaction\(tx/);
  assert.match(service, /Posted expense cannot be deleted/);
});


test('unified reports read modern headers plus historical legacy without double-counting dual-write mirrors', () => {
  const service = src('src/reports/reports.service.ts');
  assert.match(service, /prisma\.journalEntry\.groupBy/);
  assert.match(service, /prisma\.journalEntryLine\.groupBy/);
  assert.match(service, /startsWith:\s*'LEG-'/);
  assert.match(service, /journalEntry:\s*this\.modernHeaderWhere/);
  assert.match(service, /getUnifiedLedgerRows/);
  assert.match(service, /getGeneralLedger[\s\S]*getUnifiedLedgerRows/);
  assert.match(service, /getCashFlow[\s\S]*getUnifiedLedgerRows/);
});
