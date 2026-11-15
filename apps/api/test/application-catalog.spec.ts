import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  BONDS_APPLICATIONS,
  SHARED_FOUNDATIONS,
  normalizeApplicationSelection,
} from '../src/billing/application-catalog';

test('catalog defines exactly eleven distinct purchasable applications', () => {
  assert.equal(BONDS_APPLICATIONS.length, 11);
  assert.equal(new Set(BONDS_APPLICATIONS.map(a => a.key)).size, 11);
  assert.equal(new Set(BONDS_APPLICATIONS.map(a => a.home)).size, 11);
  assert.ok(BONDS_APPLICATIONS.every(a => a.apiRoots.length > 0));
});
test('shared foundations are not sellable products', () => {
  for (const foundation of SHARED_FOUNDATIONS) {
    assert.ok(!BONDS_APPLICATIONS.some(a => a.key === foundation));
  }
});
test('selection is additive, de-duplicated, and rejects unknown products', () => {
  assert.deepEqual(normalizeApplicationSelection(['crm', 'hr', 'crm', 'bogus']), ['crm', 'hr']);
  assert.equal(normalizeApplicationSelection(BONDS_APPLICATIONS.map(a => a.key)).length, 11);
});
