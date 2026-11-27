// P0 HR employee list/write/reload acceptance in a disposable Chromium simulation.
// Every /api request is intercepted; no production employee can be read or modified.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.SCC_PLAYWRIGHT_PATH || '/tmp/scc-browser-test/node_modules/playwright');

async function main() {
  const origin = process.env.TEST_WEB_ORIGIN || 'http://127.0.0.1:3102';
  if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) {
    throw new Error('HR_BROWSER_ACCEPTANCE_REFUSES_NONLOCAL_TARGET');
  }
  fs.mkdirSync('apps/web/test/artifacts', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const encoded = Buffer.from(JSON.stringify({
      type: 'access', sub: 'fixture', exp: Math.floor(Date.now() / 1000) + 3600,
    })).toString('base64url');
    await page.context().addCookies([{ name: 'accessToken', value: 'ci.' + encoded + '.ci', url: origin }]);
    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'ci-only-hr-simulated');
      localStorage.setItem('role', 'ADMIN');
      localStorage.setItem('tenantId', 'tenant-a-simulated');
    });

    let mode = 'fail';
    let employee = null;
    const businessWrites = [];
    await page.route('**/api/**', async route => {
      const req = route.request();
      const url = new URL(req.url());
      const path = url.pathname;
      const method = req.method();
      const respond = (data, status = 200) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
      if (path === '/api/auth/me' && method === 'GET') return respond({
        role: 'ADMIN', tenantId: 'tenant-a-simulated', email: 'ci-hr@example.test',
      });
      if (path === '/api/hr/departments' && method === 'GET') return respond({ data: [] });
      if (path === '/api/users' && method === 'GET') return respond({ data: [] });
      if (path === '/api/hr/employees' && method === 'GET') {
        if (mode === 'fail') return respond({ message: 'Simulated HTTP 500' }, 500);
        if (mode === 'malformed') return respond({ data: [], totalPages: 1 });
        return respond({
          data: employee ? [employee] : [],
          count: employee ? 1 : 0,
          page: 1, limit: 25, totalPages: 1,
        });
      }
      if (path === '/api/hr/employees' && method === 'POST') {
        const payload = req.postDataJSON();
        businessWrites.push({ type: 'POST', body: payload });
        employee = { id: 'hr-test-fixture-1', ...payload };
        return respond({ id: employee.id, ...employee }, 201);
      }
      if (path === '/api/hr/employees/hr-test-fixture-1' && method === 'PATCH') {
        if (!employee) return respond({ message: 'No fixture' }, 404);
        const patch = req.postDataJSON();
        businessWrites.push({ type: 'PATCH', body: patch });
        employee = { ...employee, ...patch };
        return respond(employee);
      }
      if (path === '/api/alerts/counts') return respond({ total: 0 });
      return respond({}, 404);
    });

    await page.goto(origin + '/dashboard/hr/employees', { waitUntil: 'domcontentloaded' });
    await page.getByRole('alert').filter({ hasText: 'تعذر التحقق من بيانات الموظفين' })
      .waitFor({ timeout: 12000 });
    assert.equal(await page.getByText('لا يوجد موظفون مطابقون.').count(), 0,
      'HTTP 500 must never be treated as an empty HR department');
    await page.screenshot({ path: 'apps/web/test/artifacts/SIMULATION-hr-data-unavailable.png', fullPage: true, animations: 'disabled' });

    mode = 'healthy';
    await page.getByRole('button', { name: 'إعادة المحاولة' }).click();
    await page.getByText('لا يوجد موظفون مطابقون.').waitFor({ timeout: 12000 });
    assert.equal(await page.getByText('عدد الموظفين غير متحقق').count(), 0);
    await page.getByRole('button', { name: 'إضافة موظف' }).click();
    const dialog = page.getByRole('dialog', { name: 'موظف جديد' });
    await dialog.getByRole('textbox', { name: 'الكود' }).fill('P0-EM-01');
    await dialog.getByRole('textbox', { name: 'الاسم الأول' }).fill('P0');
    await dialog.getByRole('textbox', { name: 'الاسم الأخير' }).fill('Employee');
    await dialog.getByLabel('تاريخ التعيين').fill('2026-11-27');
    await dialog.getByRole('button', { name: 'إنشاء' }).click();
    await page.getByText('P0 Employee', { exact: true }).waitFor({ timeout: 12000 });
    assert.equal(businessWrites.filter(r => r.type === 'POST').length, 1);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByText('P0 Employee', { exact: true }).waitFor({ timeout: 12000 });

    const card = page.locator('.scc-card-hover').filter({ hasText: 'P0 Employee' });
    await card.hover();
    await card.getByRole('button', { name: 'تعديل موظف' }).click();
    const editDialog = page.getByRole('dialog', { name: 'تعديل موظف' });
    await editDialog.getByRole('textbox', { name: 'الاسم الأخير' }).fill('Employee Revised');
    await editDialog.getByRole('button', { name: 'حفظ', exact: true }).click();
    await page.getByText('P0 Employee Revised', { exact: true }).waitFor({ timeout: 12000 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByText('P0 Employee Revised', { exact: true }).waitFor({ timeout: 12000 });
    assert.equal(employee.lastName, 'Employee Revised');
    assert.equal(businessWrites.filter(r => r.type === 'PATCH').length, 1);
    await page.screenshot({ path: 'apps/web/test/artifacts/SIMULATION-hr-employee-reopened.png', fullPage: true, animations: 'disabled' });
    console.log('PASS P0_HR_CREATE_EDIT_SAVE_RELOAD_SIMULATED_API');

    mode = 'malformed';
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('alert').filter({ hasText: 'تعذر التحقق من بيانات الموظفين' })
      .waitFor({ timeout: 12000 });
    assert.equal(await page.getByText('لا يوجد موظفون مطابقون.').count(), 0);
    console.log('PASS P0_HR_MALFORMED_API_NOT_FAKE_ZERO');
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
