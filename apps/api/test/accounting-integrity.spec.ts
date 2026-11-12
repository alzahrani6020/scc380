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
