import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const src = (name: string) => readFileSync(join(process.cwd(), 'src/real-estate', name), 'utf8');

test('units cannot reference another tenant property or move after leasing', () => {
  const code = src('units.service.ts');
  assert.ok(code.includes("withTenant({ id: data.propertyId }, tenantId)"));
  assert.ok(code.includes("withTenant({ id: data.propertyId }, tenantId)"));
  assert.ok(code.includes("Unit cannot move to another property after a lease exists"));
});

test('leases validate property-unit same-tenant association and immutable scheduled terms', () => {
  const code = src('lease-contracts.service.ts');
  assert.ok(code.includes("withTenant({ id: unitId, propertyId }, tenantId)"));
  assert.ok(code.includes("Contract end date must be after start date"));
  assert.ok(code.includes("Contract financial terms cannot change after instalments are scheduled"));
  assert.ok(code.includes("changedTerms"));
});

test('rent receivables must belong to same contract/tenant and cannot be fabricated as settled', () => {
  const code = src('rent-payments.service.ts');
  assert.ok(code.includes("withTenant({ id: dto.contractId }, tenantId)"));
  assert.ok(code.includes("contract.propertyId !== dto.propertyId || contract.unitId !== dto.unitId"));
  assert.ok(code.includes("New rent receivables must start pending"));
  assert.ok(code.includes("Settled rent receivables cannot be edited"));
  assert.ok(code.includes("Cannot edit rent receivable identity, amount or settlement state"));
});
