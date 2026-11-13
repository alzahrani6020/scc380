const assert = require('node:assert/strict');

const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3101';
const password = process.env.SMOKE_PASSWORD;
if (!password) throw new Error('SMOKE_PASSWORD is required');

const users = {
  ADMIN: { email: 'admin-a@role-smoke.invalid', tenant: 'role-smoke-a' },
  MANAGER: { email: 'manager-a@role-smoke.invalid', tenant: 'role-smoke-a' },
  AUDITOR: { email: 'auditor-a@role-smoke.invalid', tenant: 'role-smoke-a' },
  READONLY: { email: 'readonly-a@role-smoke.invalid', tenant: 'role-smoke-a' },
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
  let payload = null;
  const text = await res.text();
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

async function expectStatus(role, token, path, expected, options = {}) {
  const r = await request(path, { token, ...options });
  const allowed = Array.isArray(expected) ? expected : [expected];
  assert.ok(
    allowed.includes(r.status),
    `${role} ${options.method || 'GET'} ${path}: expected ${allowed.join('/')}, got ${r.status}: ${JSON.stringify(r.payload)}`,
  );
  console.log(`PASS ${role} ${options.method || 'GET'} ${path} -> ${r.status}`);
  return r;
}

async function main() {
  const root = await request('/');
  assert.equal(root.status, 200);
  assert.equal(root.payload?.message, 'SCC API is running');
  console.log('PASS public root -> 200');

  const tokens = {};
  for (const role of Object.keys(users)) {
    tokens[role] = await login(role);
    const me = await expectStatus(role, tokens[role], '/auth/me', 200);
    assert.equal(me.payload?.role, role);
  }

  // ADMIN: full tenant HR administration, but no self-escalation or cross-tenant reach.
  await expectStatus('ADMIN', tokens.ADMIN, '/users', 200);
  await expectStatus('ADMIN', tokens.ADMIN, '/tenants/role-smoke-tenant-a', 200);
  await expectStatus('ADMIN', tokens.ADMIN, '/tenants/role-smoke-tenant-b', 403);
  await expectStatus('ADMIN', tokens.ADMIN, '/users/role-smoke-admin-a', 403, {
    method: 'PATCH',
    body: { role: 'SUPER_ADMIN' },
  });
  await expectStatus('ADMIN', tokens.ADMIN, '/hr/payroll-runs', 200);
  await expectStatus('ADMIN', tokens.ADMIN, '/hr/recruitment/openings', 200);
  await expectStatus('ADMIN', tokens.ADMIN, '/hr/training/courses', 200);
  await expectStatus('ADMIN', tokens.ADMIN, '/hr/recruitment/openings', 201, {
    method: 'POST',
    body: { code: 'ROLE-SMOKE-ADMIN', title: 'Role Smoke Admin' },
  });
  await expectStatus('ADMIN', tokens.ADMIN, '/hr/training/courses', 201, {
    method: 'POST',
    body: { code: 'ROLE-SMOKE-TR-ADMIN', title: 'Role Smoke Training' },
  });

  // MANAGER: operational HR and performance write; no user/tenant admin, payroll write,
  // recruitment write, or training administration.
  await expectStatus('MANAGER', tokens.MANAGER, '/users', 403);
  await expectStatus('MANAGER', tokens.MANAGER, '/tenants/role-smoke-tenant-a', 403);
  await expectStatus('MANAGER', tokens.MANAGER, '/hr/payroll-runs', 200);
  await expectStatus('MANAGER', tokens.MANAGER, '/hr/payroll-runs', 403, {
    method: 'POST',
    body: { year: 2099, month: 12 },
  });
  await expectStatus('MANAGER', tokens.MANAGER, '/hr/recruitment/openings', 200);
  await expectStatus('MANAGER', tokens.MANAGER, '/hr/recruitment/openings', 403, {
    method: 'POST',
    body: { code: 'ROLE-SMOKE-MANAGER', title: 'Must Be Forbidden' },
  });
  await expectStatus('MANAGER', tokens.MANAGER, '/hr/performance', 200);
  await expectStatus('MANAGER', tokens.MANAGER, '/hr/performance', 404, {
    method: 'POST',
    body: {
      employeeId: 'role-smoke-missing-employee',
      periodStart: '2099-01-01T00:00:00.000Z',
      periodEnd: '2099-12-31T00:00:00.000Z',
    },
  });
  await expectStatus('MANAGER', tokens.MANAGER, '/hr/training/courses', 200);
  await expectStatus('MANAGER', tokens.MANAGER, '/hr/training/courses', 403, {
    method: 'POST',
    body: { code: 'ROLE-SMOKE-TR-MANAGER', title: 'Must Be Forbidden' },
  });

  // Read-only roles: all scoped reads work; writes are denied; cross-tenant reads are denied.
  for (const role of ['AUDITOR', 'READONLY']) {
    const token = tokens[role];
    await expectStatus(role, token, '/users', 200);
    await expectStatus(role, token, '/tenants/role-smoke-tenant-a', 200);
    await expectStatus(role, token, '/tenants/role-smoke-tenant-b', 403);
    await expectStatus(role, token, '/hr/payroll-runs', 200);
    await expectStatus(role, token, '/hr/recruitment/openings', 200);
    await expectStatus(role, token, '/hr/performance', 200);
    await expectStatus(role, token, '/hr/training/courses', 200);
    await expectStatus(role, token, '/hr/payroll-runs', 403, {
      method: 'POST',
      body: { year: 2098, month: role === 'AUDITOR' ? 10 : 11 },
    });
    await expectStatus(role, token, '/hr/recruitment/openings', 403, {
      method: 'POST',
      body: { code: `ROLE-SMOKE-${role}`, title: 'Must Be Forbidden' },
    });
    await expectStatus(role, token, '/hr/training/courses', 403, {
      method: 'POST',
      body: { code: `ROLE-SMOKE-TR-${role}`, title: 'Must Be Forbidden' },
    });
  }

  console.log('ROLE_MATRIX_SMOKE_PASS');
}

main().catch((error) => {
  console.error('ROLE_MATRIX_SMOKE_FAIL');
  console.error(error?.stack || error);
  process.exit(1);
});
