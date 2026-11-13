import assert from 'node:assert/strict';
import { createServer } from 'node:http';

const origin = 'http://127.0.0.1:3000';
let nextRefresh = 1;
let lastLogout = '';
const server = createServer(async (req, res) => {
  if (req.method !== 'POST' || !req.url?.startsWith('/api/auth/')) {
    res.writeHead(404).end();
    return;
  }
  let raw = '';
  for await (const chunk of req) raw += chunk.toString();
  const body = JSON.parse(raw || '{}');
  const route = req.url.split('/').pop();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  if (route === 'login' && body.email === 'user@example.test' && body.password === 'test-only-pass') {
    res.end(JSON.stringify({
      accessToken: 'test-access',
      refreshToken: 'refresh-1',
      user: { id: 'test-user', email: 'user@example.test', role: 'ADMIN', tenantId: 'tenant-test' },
    }));
    return;
  }
  if (route === 'refresh' && typeof body.refreshToken === 'string' &&
      (body.refreshToken.startsWith('refresh-') || body.refreshToken === 'legacy-token')) {
    nextRefresh++;
    res.end(JSON.stringify({
      accessToken: 'test-access-' + nextRefresh,
      refreshToken: 'refresh-' + nextRefresh,
      user: { id: 'test-user', email: 'user@example.test', role: 'ADMIN', tenantId: 'tenant-test' },
    }));
    return;
  }
  if (route === 'logout') {
    lastLogout = body.refreshToken;
    res.end(JSON.stringify({ message: 'Logged out successfully' }));
    return;
  }
  res.writeHead(401).end(JSON.stringify({ message: 'Invalid credentials' }));
});
const listen = () => new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(3001, '127.0.0.1', resolve);
});

async function exchange(body, opts = {}) {
  return fetch(origin + '/api/auth/session', {
    method: 'POST',
    headers: {
      Origin: opts.origin || origin,
      'Content-Type': 'application/json',
      'x-scc-auth-intent': opts.intent ?? '1',
      ...(opts.cookie ? { Cookie: opts.cookie } : {}),
    },
    body: JSON.stringify(body),
    redirect: 'manual',
  });
}

try {
  await listen();
  const crossSite = await exchange({ action: 'login', email: 'user@example.test', password: 'test-only-pass' }, {
    origin: 'https://attacker.example.test',
  });
  assert.equal(crossSite.status, 403, 'cross-site requests must not reach upstream auth');

  const missingHeader = await exchange({ action: 'login', email: 'user@example.test', password: 'test-only-pass' }, {
    intent: '0',
  });
  assert.equal(missingHeader.status, 403, 'custom CSRF header required');

  const login = await exchange({ action: 'login', email: 'user@example.test', password: 'test-only-pass', remember: true });
  assert.equal(login.status, 200, 'login exchange must succeed');
  const loginBody = await login.json();
  assert.equal(loginBody.accessToken, 'test-access');
  assert.equal('refreshToken' in loginBody, false, 'refresh token must not be exposed in JSON');
  const issuedCookie = login.headers.get('set-cookie') || '';
  assert.match(issuedCookie, /__Host-scc_refresh=refresh-1/);
  assert.match(issuedCookie, /httponly/i);
  assert.match(issuedCookie, /secure/i);
  assert.match(issuedCookie, /samesite=strict/i);
  assert.match(issuedCookie, /path=\//i);
  assert.match(login.headers.get('cache-control') || '', /no-store/);

  const rotated = await exchange({ action: 'refresh' }, { cookie: issuedCookie.split(';')[0] });
  assert.equal(rotated.status, 200, 'cookie-only refresh must succeed');
  const rotatedBody = await rotated.json();
  assert.equal(rotatedBody.accessToken, 'test-access-2');
  assert.equal('refreshToken' in rotatedBody, false);
  const rotatedCookie = rotated.headers.get('set-cookie') || '';
  assert.match(rotatedCookie, /__Host-scc_refresh=refresh-2/);

  const oldMigration = await exchange({ action: 'migrate', refreshToken: 'legacy-token' });
  assert.equal(oldMigration.status, 200, 'legacy refresh should migrate through server');
  const migrationBody = await oldMigration.json();
  assert.equal('refreshToken' in migrationBody, false);

  const logout = await exchange({ action: 'logout' }, { cookie: rotatedCookie.split(';')[0] });
  assert.equal(logout.status, 200);
  assert.equal(lastLogout, 'refresh-2', 'logout must revoke the cookie-backed session');
  assert.match(logout.headers.get('set-cookie') || '', /max-age=0/i);

  process.stdout.write('AUTH_COOKIE_HTTP_E2E_PASS\n');
} finally {
  await new Promise((resolve) => server.close(resolve));
}
