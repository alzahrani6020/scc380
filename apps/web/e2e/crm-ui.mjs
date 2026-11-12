import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';

const tokenPayload = Buffer.from(JSON.stringify({
  type: 'access',
  exp: Math.floor(Date.now() / 1000) + 60 * 60,
}), 'utf8').toString('base64url');
const accessToken = `x.${tokenPayload}.y`;

const deal = {
  id: 'd1',
  title: 'Browser Deal',
  description: 'Clear description',
  contactId: 'ct1',
  companyId: 'co1',
  pipelineId: 'p1',
  pipelineStageId: 's1',
  value: '125000',
  currency: 'SAR',
  stage: 'LEAD',
  probability: 25,
  expectedClose: '2026-12-31T00:00:00.000Z',
};

const activity = {
  id: 'a1',
  type: 'TASK',
  subject: 'Browser Activity',
  description: 'Clear activity description',
  contactId: 'ct1',
  dealId: 'd1',
  scheduledAt: '2026-12-20T09:00:00.000Z',
  remindAt: '2026-12-20T08:00:00.000Z',
  completedAt: null,
  contact: { id: 'ct1', firstName: 'Ali', lastName: 'A' },
  deal: { id: 'd1', title: 'Browser Deal' },
};

const contact = { id: 'ct1', firstName: 'Ali', lastName: 'A', email: 'ali@example.test' };
const company = { id: 'co1', name: 'Browser Company', isActive: true };
const pipeline = {
  id: 'p1',
  name: 'Browser Pipeline',
  isDefault: true,
  isActive: true,
  stages: [{ id: 's1', name: 'Browser Stage', code: 'BROWSER', order: 1, probability: 25, isActive: true }],
};

let dealPatch = null;
let activityPatch = null;

function json(body, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}

async function installApiMock(page) {
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^\/api/, '');
    const method = req.method();

    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204 });
      return;
    }

    if (method === 'GET' && path === '/auth/me') {
      await route.fulfill(json({ email: 'browser@example.test', role: 'ADMIN', firstName: 'Browser', lastName: 'Test' }));
      return;
    }
    if (method === 'GET' && path === '/alerts/counts') {
      await route.fulfill(json({ total: 0 }));
      return;
    }

    if (method === 'GET' && path === '/crm/pipelines') {
      await route.fulfill(json([pipeline]));
      return;
    }

    if (method === 'GET' && path === '/crm/contacts/ct1') {
      await route.fulfill(json(contact));
      return;
    }
    if (method === 'GET' && path === '/crm/contacts') {
      await route.fulfill(json({ data: [contact], count: 1, page: 1, limit: 20 }));
      return;
    }

    if (method === 'GET' && path === '/crm/companies/co1') {
      await route.fulfill(json(company));
      return;
    }
    if (method === 'GET' && path === '/crm/companies') {
      await route.fulfill(json({ data: [company], count: 1, page: 1, limit: 20 }));
      return;
    }

    if (method === 'GET' && path === '/crm/deals/d1') {
      await route.fulfill(json(deal));
      return;
    }
    if (method === 'GET' && path === '/crm/deals') {
      await route.fulfill(json({ data: [deal], count: 1, page: 1, limit: 25 }));
      return;
    }
    if (method === 'PATCH' && path === '/crm/deals/d1') {
      dealPatch = req.postDataJSON();
      await route.fulfill(json({ ...deal, ...dealPatch }));
      return;
    }

    if (method === 'GET' && path === '/crm/activities/a1') {
      await route.fulfill(json(activity));
      return;
    }
    if (method === 'GET' && path === '/crm/activities') {
      await route.fulfill(json({ data: [activity], count: 1, page: 1, limit: 25 }));
      return;
    }
    if (method === 'PATCH' && path === '/crm/activities/a1') {
      activityPatch = req.postDataJSON();
      await route.fulfill(json({ ...activity, ...activityPatch }));
      return;
    }

    await route.fulfill(json({ message: `Unmocked API route: ${method} ${path}` }, 500));
  });
}

function fieldByLabel(page, label, control) {
  return page.locator('label').filter({ hasText: label }).first().locator('..').locator(control);
}

function comboboxByLabel(page, label) {
  return page.locator('label').filter({ hasText: label }).first().locator('..').locator('button[aria-haspopup="listbox"]');
}

async function clearCombobox(page, label, clearLabel) {
  await comboboxByLabel(page, label).click();
  await page.getByRole('button', { name: clearLabel, exact: true }).click();
}

async function testDeals(page) {
  await page.goto(`${BASE}/dashboard/crm/deals`);
  await page.getByText('Browser Deal', { exact: true }).waitFor();

  const row = page.locator('.scc-card-hover').filter({ hasText: 'Browser Deal' }).first();
  await row.hover();
  await row.locator('button').first().click();
  await page.getByText('تعديل صفقة', { exact: true }).waitFor();

  await clearCombobox(page, 'الشركة', 'بدون شركة');
  await fieldByLabel(page, 'مسار المبيعات', 'select').selectOption('');
  await fieldByLabel(page, 'القيمة', 'input').fill('');
  await fieldByLabel(page, 'تاريخ الإغلاق المتوقع', 'input').fill('');
  await fieldByLabel(page, 'الوصف', 'textarea').fill('');

  await page.getByRole('button', { name: 'حفظ', exact: true }).click();
  await page.waitForFunction(() => !document.body.innerText.includes('تعديل صفقة'));

  assert.ok(dealPatch, 'Deal PATCH was not sent');
  assert.equal(dealPatch.companyId, null);
  assert.equal(dealPatch.pipelineId, null);
  assert.equal(dealPatch.pipelineStageId, null);
  assert.equal(dealPatch.value, null);
  assert.equal(dealPatch.expectedClose, null);
  assert.equal(dealPatch.description, null);
}

async function testActivities(page) {
  await page.goto(`${BASE}/dashboard/crm/activities`);
  await page.getByText('Browser Activity', { exact: true }).waitFor();

  const row = page.locator('.scc-card-hover').filter({ hasText: 'Browser Activity' }).first();
  await row.getByTitle('تعديل').click();
  await page.getByText('تعديل النشاط', { exact: true }).waitFor();

  await clearCombobox(page, 'جهة الاتصال', 'بدون جهة اتصال');
  await clearCombobox(page, 'الصفقة', 'بدون صفقة');
  await fieldByLabel(page, 'موعد النشاط', 'input').fill('');
  await fieldByLabel(page, 'موعد التذكير', 'input').fill('');
  await fieldByLabel(page, 'الوصف', 'textarea').fill('');

  await page.getByRole('button', { name: 'حفظ', exact: true }).click();
  await page.waitForFunction(() => !document.body.innerText.includes('تعديل النشاط'));

  assert.ok(activityPatch, 'Activity PATCH was not sent');
  assert.equal(activityPatch.contactId, null);
  assert.equal(activityPatch.dealId, null);
  assert.equal(activityPatch.scheduledAt, null);
  assert.equal(activityPatch.remindAt, null);
  assert.equal(activityPatch.description, null);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
await context.addCookies([{
  name: 'accessToken',
  value: accessToken,
  url: BASE,
}]);
await context.addInitScript(({ token }) => {
  localStorage.setItem('accessToken', token);
  localStorage.setItem('refreshToken', 'browser-refresh-token');
  localStorage.setItem('role', 'ADMIN');
  localStorage.setItem('tenantSlug', 'browser-tenant');
  localStorage.setItem('tenantId', 'browser-tenant-id');
}, { token: accessToken });

const page = await context.newPage();
await installApiMock(page);

try {
  await testDeals(page);
  await testActivities(page);
  console.log('CRM_BROWSER_E2E: PASS');
} catch (error) {
  console.error('CRM_BROWSER_E2E: FAIL');
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
