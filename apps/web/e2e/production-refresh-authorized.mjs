// SCC380 authorized production auth acceptance. Opt-in, dedicated QA identity only.
// IMPORTANT: This test creates a real login session and audit entry and logs out afterwards.
// Never run against an employee account, or automatically in PR workflows.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const SITE = 'https://dr-talal-h-alzahrani.com';
const email = process.env.SCC_QA_EMAIL || '';
const password = process.env.SCC_QA_PASSWORD || '';
const slug = process.env.SCC_QA_TENANT_SLUG || '';
const explicit = process.env.SCC_QA_APPROVED_PRODUCTION_SESSION === 'YES';
const output = { status: 'UNKNOWN', scope: 'real-production-refresh-acceptance', evidence: {}, remaining: [] };
function finish(status, message) {
  output.status = status;
  output.remaining.push(message);
  // Never print tokens, cookies, request/response bodies, or credentials.
  console.log(JSON.stringify(output));
  process.exitCode = status === 'PASS' ? 0 : status === 'FAIL' ? 1 : 2;
}
if (!explicit || !email || !password || !slug) {
  finish('BLOCKED', 'Dedicated QA identity, tenant and explicit authorization are required (SCC_QA_* variables)');
} else {
  const browser = await chromium.launch({ headless: true });
  let page;
  try {
    const context = await browser.newContext({ locale: 'ar-SA', timezoneId: 'Asia/Riyadh' });
    page = await context.newPage();
    await page.goto(SITE + '/auth/login', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole('button', { name: /تسجيل الدخول/ }).click();
    try {
      await page.waitForURL(/\/dashboard(?:\/|$)/, { timeout: 45000 });
    } catch {
      finish('BLOCKED', 'QA account could not complete login (possibly 2FA, rate limiting or wrong credentials)');
      await browser.close();
      process.exit();
    }
    const initial = await page.evaluate(() => ({
      tokenPresent: !!(localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')),
      tenant: localStorage.getItem('tenantSlug') || sessionStorage.getItem('tenantSlug')
    }));
    assert.ok(initial.tokenPresent, 'Access token not stored after login');
    assert.equal(initial.tenant, slug, 'QA tenant mismatch: do not continue with another tenant');

    const cookie = (await context.cookies(SITE)).find(c => c.name === '__Host-scc_refresh');
    assert.ok(cookie?.httpOnly && cookie?.secure, 'Real HttpOnly Secure refresh cookie not present');
    output.evidence.realRefreshCookiePresent = true;

    // Force only the access credential to expire while preserving the REAL
    // server-issued HttpOnly refresh session. This verifies web+API+DB rotation
    // without waiting for the production access-token lifetime.
    const expired = 'x.' + Buffer.from(JSON.stringify({
      type: 'access', exp: Math.floor(Date.now()/1000) - 3600
    })).toString('base64url') + '.x';
    await page.evaluate(value => {
      if (localStorage.getItem('accessToken')) localStorage.setItem('accessToken', value);
      if (sessionStorage.getItem('accessToken')) sessionStorage.setItem('accessToken', value);
      document.cookie = 'accessToken=' + encodeURIComponent(value) + '; path=/; SameSite=lax';
    }, expired);

    const events = [];
    page.on('response', response => {
      const url = new URL(response.url());
      if (url.origin !== SITE) return;
      if (url.pathname === '/api/auth/session' || url.pathname.startsWith('/api/crm/contacts')) {
        events.push({ path: url.pathname, status: response.status() });
      }
    });

    const navigated = await page.goto(SITE + '/dashboard/crm/contacts', { waitUntil: 'domcontentloaded', timeout: 90000 });
    assert.equal(navigated?.status(), 200, 'Middleware redirected expired access despite valid refresh');
    await page.waitForFunction(() => {
      const current = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
      return !!current && current.split('.').length === 3 && current !== document.cookie.match(/never-existing-cookie=([^;]+)/)?.[1];
    }, null, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2500);
    const rotated = (await context.cookies(SITE)).find(c => c.name === '__Host-scc_refresh');
    const tokenAfter = await page.evaluate(() => localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken'));
    const hasRefresh200 = events.some(e => e.path === '/api/auth/session' && e.status === 200);
    const hasCrm200 = events.some(e => e.path.startsWith('/api/crm/contacts') && e.status === 200);
    const hasCrm401 = events.some(e => e.path.startsWith('/api/crm/contacts') && e.status === 401);
    const rateLimited = events.some(e => e.status === 429);
    output.evidence = {
      realRefreshCookiePresent: true,
      refreshHttp200: hasRefresh200,
      crmInitially401: hasCrm401,
      crmRetried200: hasCrm200,
      refreshedAccessPresent: !!tokenAfter && tokenAfter !== expired,
      refreshCookieRotated: Boolean(rotated?.value && rotated.value !== cookie.value),
      rateLimited
    };
    if (rateLimited) finish('BLOCKED', 'API rate limited the acceptance test; do not retry automatically');
    else if (hasRefresh200 && hasCrm200 && tokenAfter && tokenAfter !== expired && rotated?.value !== cookie.value) {
      finish('PASS', 'Web, real API and DB-backed refresh rotation observed; CRM read resumed');
    } else finish('FAIL', 'Real refresh or CRM retry acceptance condition not met');
    // The logout action is performed through the same-origin route; it revokes
    // ONLY the freshly-created QA session. No other user sessions are touched.
    if (page) {
      try {
        await page.evaluate(async () => fetch('/api/auth/session', {
          method: 'POST', credentials: 'same-origin', cache: 'no-store',
          headers: { 'Content-Type': 'application/json', 'x-scc-auth-intent': '1' },
          body: JSON.stringify({ action: 'logout' })
        }).then(r => r.status));
      } catch { /* Closing the browser still drops its local session. */ }
    }
  } catch (err) {
    if (output.status === 'UNKNOWN') finish('FAIL', String(err.message).slice(0, 200));
  } finally {
    await browser.close();
  }
}
