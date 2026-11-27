import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isVerifiedDashboardPayload } from '../src/lib/dashboard-data-integrity';

const valid = {
  counts: { contacts: 5, deals: 0, employees: 3, vehicles: 2, invoices: 1 },
  revenue: { invoices: '1250.00', deals: 0 },
};
const crm = { byStage: [] };
const erp = { byStatus: [] };
const fleet = { byStatus: [] };

test('a genuine zero count is valid when server explicitly returns it', () => {
  assert.equal(isVerifiedDashboardPayload(valid, [], crm, erp, fleet), true);
});

test('missing, failed or incomplete analytics must never render fabricated zeros', () => {
  assert.equal(isVerifiedDashboardPayload(null, [], crm, erp, fleet), false);
  assert.equal(isVerifiedDashboardPayload({ counts: {}, revenue: {} }, [], crm, erp, fleet), false);
  assert.equal(isVerifiedDashboardPayload(valid, [], null, erp, fleet), false);
  assert.equal(isVerifiedDashboardPayload(valid, [], crm, null, fleet), false);
  assert.equal(isVerifiedDashboardPayload(valid, [], crm, erp, null), false);
});

test('reject malformed, negative, or missing business totals', () => {
  for (const count of [null, undefined, -1, NaN, 2.5, '0']) {
    assert.equal(isVerifiedDashboardPayload({
      ...valid, counts: { ...valid.counts, employees: count },
    }, [], crm, erp, fleet), false);
  }
  for (const revenue of [undefined, null, '', 'not-a-number', -100]) {
    assert.equal(isVerifiedDashboardPayload({
      ...valid, revenue: { invoices: revenue },
    }, [], crm, erp, fleet), false);
  }
});

test('valid counts still require all expected analytics result arrays', () => {
  assert.equal(isVerifiedDashboardPayload(valid, null, crm, erp, fleet), false);
  assert.equal(isVerifiedDashboardPayload(valid, [], {}, erp, fleet), false);
  assert.equal(isVerifiedDashboardPayload(valid, [], crm, {}, fleet), false);
  assert.equal(isVerifiedDashboardPayload(valid, [], crm, erp, {}), false);
});
