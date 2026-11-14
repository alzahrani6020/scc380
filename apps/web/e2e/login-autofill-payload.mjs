// Regression: browser/password-manager autofill may change DOM without React onChange.
// Verify real form submission serializes the DOM values and does not send empty strings.
// Local UI and fully mocked API ONLY; no login attempts on production.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  let observed = null;
  await page.route('**/api/auth/login', async route => {
    const req = route.request();
    observed = { method: req.method(), data: req.postDataJSON() };
    await route.fulfill({
      status: 401, contentType: 'application/json',
      body: JSON.stringify({ message: 'Invalid credentials / بيانات الدخول غير صحيحة' })
    });
  });
  await page.goto('http://127.0.0.1:3000/auth/login', { waitUntil: 'domcontentloaded' });
  // Set property using native setter without firing input/change events.
  // React state remains empty; DOM elements contain the autofilled values.
  await page.evaluate(() => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(document.querySelector('input[name="email"]'), 'QA.AutoFill@Example.Test');
    set.call(document.querySelector('input[name="password"]'), 'test-only-placeholder');
  });
  await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
  try {
    await page.waitForFunction(() => document.querySelector('form')?.querySelector('div.text-red-400') !== null, null, { timeout: 4000 });
  } catch { /* Request evidence is authoritative; DOM error diagnostics below. */ }
  const diagnostic = await page.evaluate(() => ({
    emailHasValue: Boolean(document.querySelector('input[name="email"]')?.value),
    passwordHasValue: Boolean(document.querySelector('input[name="password"]')?.value),
    browserValidationEmail: document.querySelector('input[name="email"]')?.validity?.valid,
    browserValidationPassword: document.querySelector('input[name="password"]')?.validity?.valid,
    errorVisible: document.body.innerText.includes('Invalid credentials'),
  }));
  console.log(JSON.stringify({
    diagnostic: 'autofill',
    requestObserved: Boolean(observed),
    emailPresent: diagnostic.emailHasValue,
    passwordPresent: diagnostic.passwordHasValue,
    emailBrowserValid: diagnostic.browserValidationEmail,
    passwordBrowserValid: diagnostic.browserValidationPassword,
    errorVisible: diagnostic.errorVisible,
  }));
  assert.ok(observed, 'Login submit did not send a POST request');
  assert.equal(observed?.method, 'POST');
  assert.deepEqual(observed?.data, {
    email: 'qa.autofill@example.test',
    password: 'test-only-placeholder'
  }, 'Login request must use actual DOM values');
  // Reproduce the exact NestJS ValidationPipe array response shown in the
  // screenshot. The UI must not concatenate raw English diagnostics.
  const validationPage = await browser.newPage();
  await validationPage.route('**/api/auth/login', async route => {
    await route.fulfill({
      status: 400, contentType: 'application/json',
      body: JSON.stringify({
        statusCode: 400,
        message: [
          'email must be shorter than or equal to 254 characters',
          'email must be an email',
          'password must be shorter than or equal to 128 characters',
          'password must be longer than or equal to 1 characters',
          'password must be a string',
        ],
        error: 'Bad Request'
      })
    });
  });
  await validationPage.goto('http://127.0.0.1:3000/auth/login', { waitUntil: 'domcontentloaded' });
  await validationPage.locator('input[name="email"]').fill('qa.validation@example.test');
  await validationPage.locator('input[name="password"]').fill('placeholder-test-only');
  await validationPage.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
  await validationPage.getByText('لم يستقبل الخادم بيانات الدخول بالشكل المطلوب. تحقق من الحقول ثم حاول لاحقًا.', { exact: true }).waitFor({ timeout: 15000 });
  assert.equal(await validationPage.getByText('email must be an email').count(), 0, 'Raw validation details must not leak to UI');
  await validationPage.close();
  console.log(JSON.stringify({
    status: 'PASS', scope: 'login-autofill-payload', requestBodyValidated: true, validationArrayLocalized: true,
    passwordNotLogged: true, productionRequests: 0
  }));
} catch (err) {
  console.error(JSON.stringify({ status: 'FAIL', scope: 'login-autofill-payload',
    reason: String(err.message).slice(0, 300) }));
  process.exitCode = 1;
} finally {
  await browser.close();
}
