// SCC380 P0 disposable browser acceptance. LOCALHOST ONLY, mocked API.
// This does not authenticate to production or claim a real production session.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.SCC_PLAYWRIGHT_PATH || '/tmp/scc-browser-test/node_modules/playwright');
const { Buffer } = require('node:buffer');

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const base = process.env.TEST_WEB_ORIGIN || 'http://127.0.0.1:3102';
    const origin = new URL(base);
    if (!['localhost', '127.0.0.1'].includes(origin.hostname)) {
      throw new Error('P0_BROWSER_TEST_REFUSES_NONLOCAL_TARGET');
    }
    // The middleware only checks exp/type for page navigation. The API never
    // sees a real credential: all /api requests are intercepted locally.
    const payload = Buffer.from(JSON.stringify({
      type: 'access', sub: 'ci-browser-fixture', exp: Math.floor(Date.now() / 1000) + 1800,
    })).toString('base64url');
    await page.context().addCookies([{
      name: 'accessToken', value: 'ci.' + payload + '.ci', url: base,
    }]);
    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'ci-browser-fixture-token');
      localStorage.setItem('role', 'ADMIN');
      localStorage.setItem('tenantSlug', 'ci-company-a');
      localStorage.setItem('tenantId', 'ci-tenant-a');
    });
    const requests = [];
    let failing = true;
    await page.route('**/api/**', async route => {
      const u = new URL(route.request().url());
      requests.push({ path: u.pathname, method: route.request().method() });
      const path = u.pathname;
      if (path === '/api/auth/me') {
        return route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ email: 'ci@example.test', role: 'ADMIN',
            tenantId: 'ci-tenant-a' }) });
      }
      if (path === '/api/analytics/dashboard') {
        if (failing) return route.fulfill({ status: 503, contentType: 'application/json',
          body: JSON.stringify({ message: 'CI simulated outage' }) });
        return route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ counts: { contacts: 0, deals: 0, employees: 0,
            vehicles: 0, invoices: 0 }, revenue: { invoices: 0 } }) });
      }
      if (path === '/api/analytics/revenue-trend') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      }
      if (path === '/api/analytics/crm' || path === '/api/analytics/erp' ||
        path === '/api/analytics/fleet') {
        return route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ byStage: [], byStatus: [] }) });
      }
      return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    });
    await page.goto(base + '/dashboard', { waitUntil: 'domcontentloaded' });
    const alert = page.getByRole('alert');
    // Axios retries 503 for a bounded number of attempts, so this timeout
    // includes its total local backoff. No real API or external calls.
    await alert.getByText('تعذر التحقق من بيانات لوحة التحكم').waitFor({ timeout: 65000 });
    assert.equal(await page.getByText('جهات الاتصال', { exact: true }).count(), 0,
      'must not render a fabricated 0 while stats are unknown');
    const refresh = page.getByRole('button', { name: 'إعادة المحاولة' });
    assert.equal(await refresh.isVisible(), true, 'retry button must be usable');
    failing = false;
    await refresh.click();
    await page.getByText('جهات الاتصال', { exact: true }).waitFor({ timeout: 45000 });
    assert.equal(await page.getByText('لا توجد بيانات إيرادات').isVisible(), true);
    assert.equal(await alert.getByText('تعذر التحقق من بيانات لوحة التحكم').count(), 0);
    assert.ok(requests.some(r => r.path === '/api/analytics/dashboard'));
    assert.ok(requests.every(r => r.method === 'GET'),
      'browser read-only acceptance must never write any data');
    console.log('PASS P0_BROWSER_ERROR_RETRY_REAL_ZERO_LOCAL_SIMULATION');
    await page.setViewportSize({ width: 390, height: 740 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByText('جهات الاتصال', { exact: true }).waitFor({ timeout: 45000 });
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, 'dashboard must not overflow mobile viewport: ' + overflow);
    console.log('PASS P0_BROWSER_MOBILE_NO_OVERFLOW');
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
