// Isolated real-Chromium exercise of the deployed WEB client 401->refresh->retry.
// API responses are browser-mocked: this is NOT proof of production API token rotation.
// Never uses real credentials or posts to production.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base = 'https://dr-talal-h-alzahrani.com';
const token = exp => 'x.' + Buffer.from(JSON.stringify({ type: 'access', exp })).toString('base64url') + '.y';
const oldToken = token(Math.floor(Date.now() / 1000) - 120);
const newToken = token(Math.floor(Date.now() / 1000) + 3600);
const browser = await chromium.launch({ headless: true });
const counts = { refresh: 0, crmUnauthorized: 0, crmAuthorized: 0, meUnauthorized: 0 };
try {
  const context = await browser.newContext({ locale: 'ar-SA' });
  await context.addCookies([
    { name: 'accessToken', value: oldToken, url: base },
    { name: '__Host-scc_refresh', value: 'synthetic-isolated-cookie', url: base, httpOnly: true, secure: true, sameSite: 'Strict' }
  ]);
  await context.addInitScript(({ old }) => {
    localStorage.setItem('accessToken', old);
    localStorage.setItem('role', 'ADMIN');
    localStorage.setItem('tenantSlug', 'isolated-browser-tenant');
    localStorage.setItem('scc_remember', '1');
  }, { old: oldToken });
  const page = await context.newPage();
  const reply = async (route, status, data, extras = {}) => {
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data), ...extras });
  };
  await page.route('**/api/**', async route => {
    const req = route.request();
    const pathname = new URL(req.url()).pathname;
    const authorization = req.headers()['authorization'] || '';
    if (pathname === '/api/auth/session') {
      const body = req.postDataJSON();
      if (req.method() !== 'POST' || body?.action !== 'refresh') {
        await reply(route, 400, { message: 'wrong refresh action' });
        return;
      }
      counts.refresh++;
      await reply(route, 200, {
        accessToken: newToken,
        user: { email: 'isolated@example.test', role: 'ADMIN', tenantSlug: 'isolated-browser-tenant', tenantId: 'isolated-tenant-id' }
      }, { headers: { 'set-cookie': '__Host-scc_refresh=synthetic-rotated-cookie; HttpOnly; Secure; SameSite=Strict; Path=/' } });
      return;
    }
    if (pathname === '/api/auth/me') {
      if (authorization !== 'Bearer ' + newToken) {
        counts.meUnauthorized++;
        await reply(route, 401, { message: 'Expired access token' });
      } else {
        await reply(route, 200, { email: 'isolated@example.test', role: 'ADMIN', firstName: 'Isolated' });
      }
      return;
    }
    if (pathname === '/api/crm/contacts') {
      if (authorization !== 'Bearer ' + newToken) {
        counts.crmUnauthorized++;
        await reply(route, 401, { message: 'Expired access token' });
      } else {
        counts.crmAuthorized++;
        await reply(route, 200, { data: [], count: 0, page: 1, limit: 25 });
      }
      return;
    }
    await reply(route, 200, { data: [], count: 0, total: 0 });
  });
  const nav = await page.goto(base + '/dashboard/crm/contacts', { waitUntil: 'domcontentloaded', timeout: 90000 });
  assert.equal(nav?.status(), 200, 'Expired access token + valid refresh cookie must not trigger middleware login redirect');
  await page.getByText('لا توجد جهات اتصال بعد', { exact: true }).waitFor({ timeout: 30000 });
  assert.ok(counts.crmUnauthorized >= 1, 'CRM must first receive old access token and reject it with 401');
  assert.ok(counts.refresh >= 1, 'Browser must request session refresh');
  assert.ok(counts.crmAuthorized >= 1, 'Browser must replay CRM request using new access token');
  const stored = await page.evaluate(() => localStorage.getItem('accessToken'));
  assert.equal(stored, newToken, 'Browser must store rotated access token');
  console.log(JSON.stringify({ status: 'PASS', scope: 'deployed-web-client-with-mocked-api', checks: counts, loadedCrmAfterRefresh: true, refreshedAccessStored: true, productionApiRotation: 'UNKNOWN' }));
} catch (err) {
  console.error(JSON.stringify({ status: 'FAIL', scope: 'deployed-web-client-with-mocked-api', reason: String(err.message).slice(0, 700), counts }));
  process.exitCode = 1;
} finally { await browser.close(); }
