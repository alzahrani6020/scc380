import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { evaluateProductAccess, type ProductEntitlement } from '../src/billing/product-entitlement-policy';

const now = new Date('2026-11-15T12:00:00Z');
const active: ProductEntitlement = {
  product: 'crm', state: 'ACTIVE',
  startsAt: new Date('2026-11-01T00:00:00Z'),
  endsAt: new Date('2026-12-01T00:00:00Z'),
};

test('grants subscribed CRM only for its authenticated tenant', () => {
  assert.equal(evaluateProductAccess('a', 'a', [active], 'crm', now), true);
  assert.equal(evaluateProductAccess('a', 'b', [active], 'crm', now), false);
  assert.equal(evaluateProductAccess('a', undefined, [active], 'crm', now), false);
});
test('denies other programs and absent subscriptions', () => {
  assert.equal(evaluateProductAccess('a', 'a', [active], 'hr', now), false);
  assert.equal(evaluateProductAccess('a', 'a', [], 'crm', now), false);
});
test('denies revoked, suspended, expired and future entitlements', () => {
  for (const state of ['SUSPENDED', 'EXPIRED', 'CANCELLED'] as const) {
    assert.equal(evaluateProductAccess('a', 'a', [{ ...active, state }], 'crm', now), false);
  }
  assert.equal(evaluateProductAccess('a', 'a', [{ ...active, startsAt: new Date('2026-12-20') }], 'crm', now), false);
  assert.equal(evaluateProductAccess('a', 'a', [{ ...active, endsAt: now }], 'crm', now), false);
});
test('trial access is bounded and invalid dates deny', () => {
  assert.equal(evaluateProductAccess('a', 'a', [{ ...active, state: 'TRIAL' }], 'crm', now), true);
  assert.equal(evaluateProductAccess('a', 'a', [{ ...active, startsAt: new Date(NaN) }], 'crm', now), false);
});
