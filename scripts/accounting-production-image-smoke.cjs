const assert = require('node:assert/strict');

const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3101';
const password = process.env.SMOKE_PASSWORD;
if (!password) throw new Error('SMOKE_PASSWORD is required');

const users = {
  ADMIN: { email: 'accounting-admin-a@prod-smoke.invalid', tenant: 'accounting-prod-smoke-a' },
  READONLY: { email: 'accounting-readonly-a@prod-smoke.invalid', tenant: 'accounting-prod-smoke-a' },
};

async function request(path, { method = 'GET', token, body, tenantSlug } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (tenantSlug) headers['x-tenant-slug'] = tenantSlug;
  const res = await fetch(base + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  return { status: res.status, payload };
}

async function login(role) {
  const cfg = users[role];
  const r = await request('/auth/login', {
    method: 'POST',
    tenantSlug: cfg.tenant,
    body: { email: cfg.email, password },
  });
  assert.equal(r.status, 201, `${role} login expected 201, got ${r.status}: ${JSON.stringify(r.payload)}`);
  assert.ok(r.payload?.accessToken, `${role} login missing accessToken`);
  assert.equal(r.payload?.user?.role, role);
  return r.payload.accessToken;
}

async function expectStatus(label, token, path, expected, options = {}) {
  const r = await request(path, { token, ...options });
  const allowed = Array.isArray(expected) ? expected : [expected];
  assert.ok(
    allowed.includes(r.status),
    `${label} ${options.method || 'GET'} ${path}: expected ${allowed.join('/')}, got ${r.status}: ${JSON.stringify(r.payload)}`,
  );
  console.log(`PASS ${label} ${options.method || 'GET'} ${path} -> ${r.status}`);
  return r;
}

function ids(payload) {
  const rows = Array.isArray(payload) ? payload : payload?.data;
  assert.ok(Array.isArray(rows), `Expected array payload, got ${JSON.stringify(payload)}`);
  return rows.map((row) => row.id);
}

async function main() {
  const root = await request('/');
  assert.equal(root.status, 200);
  assert.equal(root.payload?.message, 'SCC API is running');
  console.log('PASS public root -> 200');

  const admin = await login('ADMIN');
  const readonly = await login('READONLY');

  const adminMe = await expectStatus('ADMIN', admin, '/auth/me', 200);
  assert.equal(adminMe.payload?.role, 'ADMIN');
  const readonlyMe = await expectStatus('READONLY', readonly, '/auth/me', 200);
  assert.equal(readonlyMe.payload?.role, 'READONLY');

  const cc = await expectStatus('ADMIN', admin, '/finance/cost-centers', 200);
  assert.deepEqual(ids(cc.payload), ['acct-smoke-cc-a']);

  const categories = await expectStatus('ADMIN', admin, '/finance/fixed-assets/categories', 200);
  assert.deepEqual(ids(categories.payload), ['acct-smoke-fa-cat-a']);

  const assets = await expectStatus('ADMIN', admin, '/finance/fixed-assets', 200);
  assert.deepEqual(ids(assets.payload), ['acct-smoke-fa-a']);

  const budgets = await expectStatus('ADMIN', admin, '/finance/budgets', 200);
  assert.deepEqual(ids(budgets.payload), ['acct-smoke-budget-a']);

  const fxConfig = await expectStatus('ADMIN', admin, '/finance/fx/config', 200);
  assert.equal(fxConfig.payload?.baseCurrency, 'SAR');

  const rates = await expectStatus('ADMIN', admin, '/finance/fx/rates', 200);
  assert.deepEqual(ids(rates.payload), ['acct-smoke-fx-a']);

  const products = await expectStatus('ADMIN', admin, '/inventory/products', 200);
  assert.deepEqual(ids(products.payload), ['acct-smoke-product-a']);

  const vatReturns = await expectStatus('ADMIN', admin, '/finance/vat-returns', 200);
  assert.deepEqual(ids(vatReturns.payload), []);
  const vatConfig = await expectStatus('ADMIN', admin, '/finance/vat-returns/config', 200);
  assert.equal(vatConfig.payload?.baseCurrency, 'SAR');

  for (const path of [
    '/finance/cost-centers',
    '/finance/fixed-assets/categories',
    '/finance/fixed-assets',
    '/finance/budgets',
    '/finance/fx/config',
    '/finance/fx/rates',
    '/inventory/products',
    '/finance/vat-returns',
    '/finance/vat-returns/config',
  ]) {
    await expectStatus('READONLY', readonly, path, 200);
  }

  await expectStatus('READONLY', readonly, '/finance/cost-centers', 403, {
    method: 'POST',
    body: { name: 'MUST NOT CREATE', code: 'DENY' },
  });
  await expectStatus('READONLY', readonly, '/finance/budgets', 403, {
    method: 'POST',
    body: { year: 2099, name: 'MUST NOT CREATE' },
  });
  await expectStatus('READONLY', readonly, '/finance/fx/rates', 403, {
    method: 'POST',
    body: {
      fromCurrency: 'USD',
      toCurrency: 'SAR',
      rate: 3.75,
      effectiveDate: '2099-01-01',
    },
  });
  await expectStatus('READONLY', readonly, '/finance/vat-returns', 403, {
    method: 'POST',
    body: {
      periodStart: '2099-01-01',
      periodEnd: '2099-03-31',
    },
  });

  console.log('ACCOUNTING_PRODUCTION_IMAGE_SMOKE_PASS');
}

main().catch((error) => {
  console.error('ACCOUNTING_PRODUCTION_IMAGE_SMOKE_FAIL');
  console.error(error?.stack || error);
  process.exit(1);
});
