// Browser regression for the production-reported login HTTP 429 case.
// Runs against the LOCAL web build; intercept the actual same-origin /api/auth/login rewrite, without production requests.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ locale: 'ar-SA' });
  let attempts = 0;
  await page.route('http://127.0.0.1:3000/api/auth/login', async route => {
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
  await page.getByText(/تعذر تسجيل الدخول \(429\)/).waitFor({ timeout: 15000 });
  await page.getByRole('status').getByText(/يمكن إعادة المحاولة بعد 2 دقيقة/).waitFor();
  assert.equal(attempts, 1, 'The error must never trigger a retry');
  assert.equal(await page.locator('button[type="submit"]').isDisabled(), true, 'Throttle period must prevent repeated submissions');
  await page.waitForTimeout(250);
  assert.equal(attempts, 1, 'Unexpected background retry');
  console.log(JSON.stringify({ status: 'PASS', scope: 'local-browser-429-regression', localizedError: true, respectsRetryAfter: true, noAutomaticRetry: true, attempts }));
  // A cold-start 503 is not an invalid-password response and MUST NOT
  // trigger automatic replay of a POST carrying credentials.
  const recoveryPage = await browser.newPage({ locale: 'ar-SA' });
  let coldStartAttempts = 0;
  await recoveryPage.route('http://127.0.0.1:3000/api/auth/login', async route => {
    coldStartAttempts += 1;
    await route.fulfill({ status: 503, contentType: 'application/json',
      body: JSON.stringify({ message: 'Service Unavailable' }) });
  });
  await recoveryPage.goto('http://127.0.0.1:3000/auth/login', { waitUntil: 'domcontentloaded' });
  await recoveryPage.locator('input[type="email"]').fill('qa@example.test');
  await recoveryPage.locator('input[type="password"]').fill('mock-only-password');
  await recoveryPage.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
  await recoveryPage.getByText(/خدمة تسجيل الدخول غير متاحة مؤقتًا/).waitFor({ timeout: 15000 });
  await recoveryPage.waitForTimeout(300);
  assert.equal(coldStartAttempts, 1, 'Transient 503 must never replay credential POST automatically');
  await recoveryPage.close();
  console.log(JSON.stringify({ status: 'PASS', scope: 'local-browser-503-regression', noAutomaticReplay: true, attempts: coldStartAttempts }));
} catch (e) {
  console.error(JSON.stringify({ status: 'FAIL', scope: 'local-browser-429-regression', reason: String(e.message).slice(0, 300) }));
  process.exitCode = 1;
} finally {
  await browser.close();
}
