// Opt-in integration acceptance using a dedicated approved QA account ONLY.
// Creates a real session, rotates its refresh token and revokes that session on exit.
// Never configured for automatic PR runs. Never print credentials or token values.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const ORIGIN = 'https://dr-talal-h-alzahrani.com';
const required = ['SCC_QA_EMAIL', 'SCC_QA_PASSWORD', 'SCC_QA_TENANT_SLUG'];
const authorized = process.env.SCC_QA_APPROVED_PRODUCTION_SESSION === 'YES';
const missing = required.filter(key => !process.env[key]);
const result = { scope: 'authorized-production-auth-refresh', status: 'BLOCKED', evidence: {}, remaining: [] };

if (!authorized || missing.length) {
  result.remaining.push('Approved isolated QA login is required; no production request attempted');
  console.log(JSON.stringify(result));
  process.exitCode = 2;
} else {
  let browser;
  let context;
  let page;
  let loginCompleted = false;
  let logoutStatus = null;
  try {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({ locale: 'ar-SA', timezoneId: 'Asia/Riyadh' });
    page = await context.newPage();
    const loginPage = await page.goto(ORIGIN + '/auth/login', { waitUntil: 'domcontentloaded', timeout: 90000 });
    assert.equal(loginPage?.status(), 200, 'Login page unavailable');
    await page.locator('input[type="email"]').fill(process.env.SCC_QA_EMAIL);
    await page.locator('input[type="password"]').fill(process.env.SCC_QA_PASSWORD);
    await page.getByRole('button', { name: /تسجيل الدخول/ }).click();
    await page.waitForURL(/\/dashboard(?:\/|$)/, { timeout: 45000 });
    loginCompleted = true;

    const original = await page.evaluate(() => ({
      token: localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken'),
      tenant: localStorage.getItem('tenantSlug') || sessionStorage.getItem('tenantSlug'),
    }));
    assert.ok(original.token, 'No access token after QA login');
    assert.equal(original.tenant, process.env.SCC_QA_TENANT_SLUG, 'Tenant differs from authorized QA tenant');
    const before = (await context.cookies(ORIGIN)).find(c => c.name === '__Host-scc_refresh');
    assert.ok(before?.value && before.httpOnly && before.secure, 'Secure HttpOnly refresh session missing');
    result.evidence.login = true;
    result.evidence.tenantMatched = true;
    result.evidence.secureRefreshCookie = true;

    // Force ONLY the access credential to an expired token, without changing the
    // genuine server-issued refresh cookie. This is an expiry simulation, not a
    // timed expiry of a genuine JWT.
    const expired = 'x.' + Buffer.from(JSON.stringify({
      type: 'access', exp: Math.floor(Date.now() / 1000) - 3600
    })).toString('base64url') + '.x';
    await page.evaluate(value => {
      if (localStorage.getItem('accessToken')) localStorage.setItem('accessToken', value);
      if (sessionStorage.getItem('accessToken')) sessionStorage.setItem('accessToken', value);
      document.cookie = 'accessToken=' + encodeURIComponent(value) + '; path=/; SameSite=Lax';
    }, expired);

    const events = [];
    page.on('response', response => {
      const u = new URL(response.url());
      if (u.origin !== ORIGIN) return;
      if (u.pathname === '/api/auth/session' || u.pathname.startsWith('/api/crm/contacts')) {
        events.push({ path: u.pathname, status: response.status() });
      }
    });
    const nav = await page.goto(ORIGIN + '/dashboard/crm/contacts', { waitUntil: 'domcontentloaded', timeout: 90000 });
    assert.equal(nav?.status(), 200, 'Expired access with refresh cookie was redirected');
    await page.waitForFunction(value => {
      const stored = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
      return !!stored && stored !== value;
    }, expired, { timeout: 35000 });

    // Wait for the retried CRM GET to finish (no data mutation).
    await page.waitForFunction(() => document.body?.innerText.includes('لا توجد جهات اتصال بعد') ||
      document.body?.innerText.includes('إدارة العملاء'), null, { timeout: 30000 });
    await page.waitForTimeout(800);
    const after = (await context.cookies(ORIGIN)).find(c => c.name === '__Host-scc_refresh');
    const refreshed = await page.evaluate(() => localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken'));
    const statuses = key => events.filter(x => x.path.startsWith(key)).map(x => x.status);
    const crm = statuses('/api/crm/contacts');
    const session = statuses('/api/auth/session');
    result.evidence = {
      login: true, tenantMatched: true, secureRefreshCookie: true,
      crm401: crm.includes(401), refresh200: session.includes(200),
      crmRetried200: crm.includes(200), newAccessStored: Boolean(refreshed && refreshed !== expired),
      realCookieRotated: Boolean(after?.value && after.value !== before.value),
      rateLimited: events.some(x => x.status === 429)
    };
    if (result.evidence.rateLimited) {
      result.status = 'BLOCKED';
      result.remaining.push('429 rate limit prevents confirmation; no automatic retry');
    } else if (result.evidence.crm401 && result.evidence.refresh200 &&
      result.evidence.crmRetried200 && result.evidence.newAccessStored &&
      result.evidence.realCookieRotated) {
      result.status = 'PASS';
    } else {
      result.status = 'FAIL';
      result.remaining.push('Missing 401 -> refresh 200 -> CRM 200 or cookie rotation evidence');
    }
  } catch (error) {
    // Do not include raw exception strings that might contain sensitive URLs.
    result.status = loginCompleted ? 'FAIL' : 'BLOCKED';
    result.remaining.push(loginCompleted ? 'Authenticated session sequence did not meet acceptance' :
      'QA login could not complete (possible 2FA, throttling or credential issue)');
  } finally {
    // Always attempt to revoke only this newly opened QA session.
    if (loginCompleted && page && !page.isClosed()) {
      try {
        logoutStatus = await page.evaluate(async () => {
          const r = await fetch('/api/auth/session', {
            method: 'POST', credentials: 'same-origin', cache: 'no-store',
            headers: { 'Content-Type': 'application/json', 'x-scc-auth-intent': '1' },
            body: JSON.stringify({ action: 'logout' }),
          });
          return r.status;
        });
      } catch { logoutStatus = null; }
    }
    if (browser) await browser.close();
    result.evidence.qaLogoutStatus = logoutStatus;
    if (loginCompleted && logoutStatus !== 200) {
      // Cleanup failure is never a PASS. Report need for session revocation.
      result.status = 'FAIL';
      result.remaining.push('QA session revocation not confirmed; revoke QA session independently');
    }
    console.log(JSON.stringify(result));
    process.exitCode = result.status === 'PASS' ? 0 : result.status === 'FAIL' ? 1 : 2;
  }
}
