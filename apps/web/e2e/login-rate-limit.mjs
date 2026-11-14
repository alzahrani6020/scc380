// Browser regression for the production-reported login HTTP 429 case.
// Runs against the LOCAL web build with a mocked auth endpoint: no production requests.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ locale: 'ar-SA' });
  let attempts = 0;
  await page.route('**/api/auth/login', async route => {
    attempts += 1;
    await route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({ statusCode: 429, retryAfter: 120, message: 'Too many authentication attempts.' }),
    });
  });
  await page.goto('http://127.0.0.1:3000/auth/login', { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').fill('qa@example.test');
  await page.locator('input[type="password"]').fill('mock-only-password');
  const submit = page.getByRole('button', { name: 'تسجيل الدخول', exact: true });
  await submit.click();
  await page.getByText('تم تقييد محاولات تسجيل الدخول مؤقتًا لحماية الحساب. انتظر قبل إعادة المحاولة.').waitFor({ timeout: 15000 });
  await page.getByRole('status').getByText(/دقيقة تقريبًا/).waitFor();
  assert.equal(attempts, 1, 'The error must never trigger a retry');
  assert.equal(await page.locator('button[type="submit"]').isDisabled(), true, 'Throttle period must prevent repeated submissions');
  await page.waitForTimeout(250);
  assert.equal(attempts, 1, 'Unexpected background retry');
  console.log(JSON.stringify({ status: 'PASS', scope: 'local-browser-429-regression', localizedError: true, respectsRetryAfter: true, noAutomaticRetry: true, attempts }));
} catch (e) {
  console.error(JSON.stringify({ status: 'FAIL', scope: 'local-browser-429-regression', reason: String(e.message).slice(0, 300) }));
  process.exitCode = 1;
} finally {
  await browser.close();
}
