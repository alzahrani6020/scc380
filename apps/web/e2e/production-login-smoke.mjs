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
  const uiEvidence = { status: 'PASS', scope: 'login-ui', url: base + '/auth/login', http: response.status(), emailInput: true, passwordInput: true, loginButtonEnabled: true, pageErrors: errors.length };
  console.log(JSON.stringify(uiEvidence));
  if (process.argv.includes('--ui-only')) {
    // The UI gate does not claim authorization or token rotation has been tested.
    console.log(JSON.stringify({ status: 'UNKNOWN', scope: 'anonymous-security', reason: 'not requested in UI-only mode' }));
    console.log(JSON.stringify({ status: 'UNKNOWN', scope: 'real-session-rotation', reason: 'requires a dedicated authorized test identity' }));
  } else {
    // One bounded unauthenticated probe per endpoint; never retry on 429.
    const forbidden = await page.evaluate(async () => {
      const r = await fetch('/api/crm/contacts', { method: 'GET', credentials: 'omit', cache: 'no-store' });
      return r.status;
    });
    if (forbidden === 429) {
      outcome = 'BLOCKED';
      console.error(JSON.stringify({ status: outcome, scope: 'anonymous-security', reason: 'HTTP 429 rate limiting prevents CRM authorization assertion', anonymousCrmStatus: forbidden }));
      process.exitCode = 2;
    } else {
      assert.ok([401, 403].includes(forbidden), 'Anonymous CRM expected 401/403, got ' + forbidden);
      const refresh = await page.evaluate(async () => {
        const r = await fetch('/api/auth/refresh', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          credentials: 'omit', body: '{}', cache: 'no-store'
        });
        return r.status;
      });
      if (refresh === 429) {
        outcome = 'BLOCKED';
        console.error(JSON.stringify({ status: outcome, scope: 'anonymous-security', reason: 'HTTP 429 rate limiting prevents refresh assertion', anonymousCrmStatus: forbidden, anonymousRefreshStatus: refresh }));
        process.exitCode = 2;
      } else {
        assert.ok([400, 401, 422].includes(refresh), 'Anonymous refresh expected 400/401/422, got ' + refresh);
        console.log(JSON.stringify({ status: 'PASS', scope: 'anonymous-security', anonymousCrmStatus: forbidden, anonymousRefreshStatus: refresh }));
      }
    }
    console.log(JSON.stringify({ status: 'UNKNOWN', scope: 'real-session-rotation', reason: 'requires a dedicated authorized test identity' }));
  }
} catch (error) {
  console.error(JSON.stringify({ status: outcome, reason: String(error.message).slice(0, 500), realSessionRotation: 'UNKNOWN' }));
  process.exitCode = 1;
} finally {
  await browser.close();
}
