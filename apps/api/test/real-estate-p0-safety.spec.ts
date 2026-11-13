import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

test('all real estate controllers require role permissions for read and write routes', () => {
  for (const name of ['properties', 'units', 'lease-contracts', 'rent-payments']) {
    const code = src(`src/real-estate/${name}.controller.ts`);
    assert.match(code, /@UseGuards\(JwtAuthGuard, PermissionsGuard\)/);
    assert.match(code, /@RequirePermissions\('real-estate:read'\)/);
    assert.match(code, /@RequirePermissions\('real-estate:write'\)/);
  }
  const roles = src('../../packages/auth/src/permissions.ts');
  assert.match(roles, /'real-estate:\*'/);
  assert.match(roles, /'real-estate:read'/);
  assert.doesNotMatch(roles.slice(roles.indexOf('  USER:'), roles.indexOf('  AUDITOR:')), /real-estate/);
});

test('Ejar cannot fabricate registration, verification or syncing when unconfigured', () => {
  const code = src('src/real-estate/ejar.service.ts');
  assert.match(code, /ServiceUnavailableException/);
  assert.match(code, /this\.assertConfigured\(\)/);
  assert.doesNotMatch(code, /demo:\s*true/);
  assert.doesNotMatch(code, /verified:\s*true/);
  assert.doesNotMatch(code, /JSON\.stringify\(payload\).*logger/);
  assert.match(code, /encodeURIComponent\(contract\.ejarContractNumber\)/);
});

test('rent recording keeps original receivable immutable and rejects unsupported partial payments', () => {
  const code = src('src/real-estate/rent-payments.service.ts');
  const record = code.slice(code.indexOf('async recordPayment'), code.indexOf('async overdueReport'));
  assert.match(record, /Number\.isFinite\(paidAmount\)/);
  assert.match(record, /Math\.round\(paidAmount \* 100\) !== Math\.round\(expectedAmount \* 100\)/);
  assert.match(record, /updateMany\(/);
  assert.match(record, /PaymentStatus\.PENDING/);
  assert.doesNotMatch(record, /amount:\s*paidAmount/);
});

test('destructive real estate deletes are guarded until an auditable reversal exists', () => {
  assert.match(src('src/real-estate/properties.service.ts'), /dependent units, leases or expenses/);
  assert.match(src('src/real-estate/units.service.ts'), /lease history or an active lease/);
  assert.match(src('src/real-estate/lease-contracts.service.ts'), /without scheduled or collected payments/);
  assert.match(src('src/real-estate/rent-payments.service.ts'), /auditable reversal workflow/);
});
