// Read-only browser smoke against the deployed SCC380 login page.
// Never submits credentials or modifies production data.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = 'https://dr-talal-h-alzahrani.com';
const browser = await chromium.launch({ headless: true });
let outcome = 'FAIL';
try {
  const page = await browser.newPage({ locale: 'ar-SA', timezoneId: 'Asia/Riyadh' });
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  const response = await page.goto(base + '/auth/login', { waitUntil: 'domcontentloaded', timeout: 90000 });
  assert.equal(response?.status(), 200, 'Production login page must return 200');
  await page.locator('input[type="email"]').waitFor({ timeout: 25000 });
  assert.equal(await page.locator('input[type="password"]').count(), 1, 'Password input missing');
  const loginButton = page.getByRole('button', { name: /تسجيل الدخول/ });
  assert.equal(await loginButton.count(), 1, 'Login submit button missing');
  assert.ok(await loginButton.isEnabled(), 'Login submit disabled without attempting authentication');
  assert.equal(errors.length, 0, 'Browser runtime errors: ' + errors.join('; '));
  // Check routing/authorization through browser's own network path, without credentials.
  const forbidden = await page.evaluate(async () => {
    const r = await fetch('/api/crm/contacts', { method: 'GET', credentials: 'omit', cache: 'no-store' });
    return r.status;
  });
  assert.ok([401, 403].includes(forbidden), 'Anonymous CRM expected 401/403, got ' + forbidden);
  const unauthenticatedRefresh = await page.evaluate(async () => {
    const r = await fetch('/api/auth/refresh', {
      method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'omit',
      body: '{}', cache: 'no-store'
    });
    return r.status;
  });
  assert.ok([400, 401, 422, 429].includes(unauthenticatedRefresh), 'Anonymous refresh expected 400/401/422/429, got ' + unauthenticatedRefresh);
  outcome = 'PASS';
  console.log(JSON.stringify({ status: outcome, url: base + '/auth/login', http: response.status(), emailInput: true, passwordInput: true, anonymousCrmStatus: forbidden, anonymousRefreshStatus: unauthenticatedRefresh, pageErrors: errors.length, realSessionRotation: 'UNKNOWN' }));
} catch (error) {
  console.error(JSON.stringify({ status: outcome, reason: String(error.message).slice(0, 500), realSessionRotation: 'UNKNOWN' }));
  process.exitCode = 1;
} finally {
  await browser.close();
}
