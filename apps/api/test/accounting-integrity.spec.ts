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


test('account mapping is tenant-aware, configurable, and payment-method fail-closed', () => {
  const service = src('src/accounting-core/account-mapping.service.ts');
  assert.match(service, /DEFAULT_CODES/);
  assert.match(service, /readAccounting\(settings\)\.accountMapping/);
  assert.match(service, /autoPostingEnabled === true/);
  assert.match(service, /resolveInTransaction/);
  assert.match(service, /paymentMethodMapping/);
  assert.match(service, /Missing accounting payment-method mapping/);
  assert.match(service, /tenantId, code: \{ in: codes \}, isActive: true/);
});

test('dual write is atomic and tenant-scopes legacy entry numbers', () => {
  const service = src('src/accounting-core/accounting-dual-write.service.ts');
  assert.match(service, /postInTransaction\(tx: Prisma\.TransactionClient/);
  assert.match(service, /postInTransaction\(tx, input\)/);
  assert.match(service, /tx\.journalEntry\.createMany/);
  assert.match(service, /LEG-\$\{input\.tenantId\}-\$\{input\.entryNumber\}-L/);
  assert.match(service, /prisma\.\$transaction/);
});

test('accounting dependency reconciliation and startup gates are additive', () => {
  const migration = readFileSync(
    join(process.cwd(), '../../packages/database/prisma/migrations/20261112162500_reconcile_accounting_dependencies/migration.sql'),
    'utf8',
  );
  const startup = src('scripts/baseline-and-migrate.cjs');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "chart_of_accounts"/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "financial_periods"/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "journal_entries"/);
  assert.doesNotMatch(migration, /(^|\n)\s*DROP\s+/i);
  assert.doesNotMatch(migration, /(^|\n)\s*TRUNCATE\s+/i);
  assert.doesNotMatch(migration, /(^|\n)\s*DELETE\s+FROM\s+/i);
  assert.match(startup, /verifyAccountingDependenciesPreconditions/);
  assert.match(startup, /ACCOUNTING_SCHEMA_BLOCKED/);
  assert.ok(
    startup.indexOf('await verifyAccountingDependenciesPreconditions(applied)') <
      startup.indexOf("console.log('PRISMA_MIGRATE_DEPLOY_START')"),
  );
});

test('invoice and customer payment reconciliation are additive and startup-gated', () => {
  const invoiceMigration = readFileSync(
    join(process.cwd(), '../../packages/database/prisma/migrations/20261112163000_reconcile_invoice_zatca_columns/migration.sql'),
    'utf8',
  );
  const paymentMigration = readFileSync(
    join(process.cwd(), '../../packages/database/prisma/migrations/20261112165000_reconcile_customer_payments/migration.sql'),
    'utf8',
  );
  const startup = src('scripts/baseline-and-migrate.cjs');
  assert.match(invoiceMigration, /ADD COLUMN IF NOT EXISTS "zatcaSignedXml"/);
  assert.match(invoiceMigration, /ADD COLUMN IF NOT EXISTS "productId"/);
  assert.match(paymentMigration, /CREATE TABLE IF NOT EXISTS "payments"/);
  assert.doesNotMatch(invoiceMigration + paymentMigration, /(^|\n)\s*(DROP|TRUNCATE|DELETE\s+FROM)\s+/i);
  assert.match(startup, /verifyInvoiceAccountingPreconditions/);
  assert.match(startup, /verifyPaymentSchemaPreconditions/);
});

test('supplier AP schema and posting policy require explicit item accounts', () => {
  const migration = readFileSync(
    join(process.cwd(), '../../packages/database/prisma/migrations/20261112170000_reconcile_supplier_ap_accounting/migration.sql'),
    'utf8',
  );
  const service = src('src/supplier-invoice/supplier-invoice.service.ts');
  const startup = src('scripts/baseline-and-migrate.cjs');
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "accountId"/);
  assert.match(service, /كل بند في فاتورة المورد يحتاج accountId/);
  assert.match(service, /sourceType:\s*'SUPPLIER_INVOICE'/);
  assert.match(service, /sourceType:\s*'SUPPLIER_PAYMENT'/);
  assert.match(service, /VAT_RECEIVABLE/);
  assert.match(service, /ACCOUNTS_PAYABLE/);
  assert.match(service, /postInTransaction\(tx/);
  assert.match(startup, /verifySupplierApPreconditions/);
});

test('expense accounting is explicit-account, additive, and reversal-safe', () => {
  const migration = readFileSync(
    join(process.cwd(), '../../packages/database/prisma/migrations/20261112171000_reconcile_expense_accounting/migration.sql'),
    'utf8',
  );
  const service = src('src/finance/expenses.service.ts');
  const startup = src('scripts/baseline-and-migrate.cjs');
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "debitAccountId"/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "creditAccountId"/);
  assert.doesNotMatch(migration, /(^|\n)\s*(DROP|TRUNCATE|DELETE\s+FROM)\s+/i);
  assert.match(service, /requires debitAccountId and creditAccountId/);
  assert.match(service, /sourceType:\s*'EXPENSE'/);
  assert.match(service, /Posted expense cannot be deleted/);
  assert.match(startup, /verifyExpenseAccountingPreconditions/);
});

test('invoice and payment services use caller-owned transactions for accounting', () => {
  const invoices = src('src/erp/invoices.service.ts');
  const payments = src('src/finance/payments.service.ts');
  assert.match(invoices, /prisma\.\$transaction/);
  assert.match(invoices, /postInTransaction\(tx/);
  assert.match(invoices, /sourceType:\s*'INVOICE'/);
  assert.match(payments, /prisma\.\$transaction/);
  assert.match(payments, /sourceType:\s*'PAYMENT'/);
  assert.match(payments, /Payment exceeds invoice outstanding balance/);
  assert.match(payments, /Completed payment cannot be deleted/);
});
