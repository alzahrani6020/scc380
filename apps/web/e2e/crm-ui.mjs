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
let dealPost = null;
let activityPost = null;
let dealDeleteId = null;
let activityDeleteId = null;
let activityCompletePatch = null;
let failNextDealList = false;
let failNextDealPost = false;
let failNextActivityPost = false;
let companyPost = null;
let companyPatch = null;
let companyDeleteId = null;
let contactPost = null;
let contactPatch = null;
let contactDeleteId = null;
let csvExportRequested = false;
let csvImportPreview = null;
let csvImportExecute = null;
let failNextOverview = false;
let invalidCsvPreview = false;
let invalidCsvExecuteAttempted = false;
let pipelinePost = null;
let pipelinePatch = null;
let pipelineDeleteId = null;
let stagePost = null;
let stagePatch = null;
let stageDeleteId = null;
let lifecycleMode = false;
const lifecycle = {
  company: null,
  contact: null,
  pipeline: null,
  stage: null,
  deal: null,
  activity: null,
};
const dealListQueries = [];
const activityListQueries = [];
const contactListQueries = [];
const companyListQueries = [];

function queryObject(url) {
  return Object.fromEntries(url.searchParams.entries());
}

async function waitUntil(predicate, message, timeoutMs = 6000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(message);
}

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
    if (method === 'GET' && path === '/analytics/dashboard') {
      if (failNextOverview) {
        failNextOverview = false;
        await route.fulfill(json({ message: 'forced overview failure' }, 500));
        return;
      }
      await route.fulfill(json({
        counts: {
          contacts: lifecycleMode && lifecycle.contact ? 2 : 1,
          deals: lifecycleMode && lifecycle.deal ? 2 : 1,
        },
        revenue: { deals: 125000 },
      }));
      return;
    }
    if (method === 'GET' && path === '/analytics/crm') {
      await route.fulfill(json({
        stageBreakdown: [
          { key: 'LEAD', label: 'LEAD', source: 'legacy', count: lifecycleMode && lifecycle.deal ? 2 : 1 },
        ],
        bySource: [{ source: 'OTHER', _count: { id: lifecycleMode && lifecycle.contact ? 2 : 1 } }],
      }));
      return;
    }

    if (method === 'GET' && path === '/crm/pipelines') {
      if (lifecycleMode && lifecycle.pipeline) {
        await route.fulfill(json([lifecycle.pipeline, pipeline]));
      } else {
        await route.fulfill(json([pipeline]));
      }
      return;
    }
    if (method === 'POST' && path === '/crm/pipelines') {
      pipelinePost = req.postDataJSON();
      const created = { id: 'p-new', stages: [], ...pipelinePost };
      if (lifecycleMode) lifecycle.pipeline = created;
      await route.fulfill(json(created, 201));
      return;
    }
    if (method === 'PATCH' && path === '/crm/pipelines/p1') {
      pipelinePatch = req.postDataJSON();
      await route.fulfill(json({ ...pipeline, ...pipelinePatch }));
      return;
    }
    if (method === 'DELETE' && path === '/crm/pipelines/p1') {
      pipelineDeleteId = 'p1';
      await route.fulfill({ status: 204 });
      return;
    }
    if (method === 'POST' && path === '/crm/pipelines/p1/stages') {
      stagePost = req.postDataJSON();
      await route.fulfill(json({ id: 's-new', ...stagePost }, 201));
      return;
    }
    if (method === 'PATCH' && path === '/crm/pipelines/p1/stages/s1') {
      stagePatch = req.postDataJSON();
      await route.fulfill(json({ ...pipeline.stages[0], ...stagePatch }));
      return;
    }
    if (method === 'DELETE' && path === '/crm/pipelines/p1/stages/s1') {
      stageDeleteId = 's1';
      await route.fulfill({ status: 204 });
      return;
    }
    if (method === 'POST' && path === '/crm/pipelines/p-new/stages') {
      stagePost = req.postDataJSON();
      const created = { id: 's-life', ...stagePost };
      lifecycle.stage = created;
      lifecycle.pipeline = { ...lifecycle.pipeline, stages: [created] };
      await route.fulfill(json(created, 201));
      return;
    }

    if (method === 'GET' && path === '/crm/contacts/ct1') {
      await route.fulfill(json(contact));
      return;
    }
    if (method === 'GET' && path === '/crm/contacts/ct-life') {
      await route.fulfill(json(lifecycle.contact || contact));
      return;
    }
    if (method === 'GET' && path === '/crm/contacts') {
      contactListQueries.push(queryObject(url));
      const data = lifecycleMode && lifecycle.contact ? [lifecycle.contact, contact] : [contact];
      await route.fulfill(json({ data, count: data.length, page: 1, limit: Number(url.searchParams.get('limit') || 20) }));
      return;
    }
    if (method === 'POST' && path === '/crm/contacts') {
      contactPost = req.postDataJSON();
      const created = { id: lifecycleMode ? 'ct-life' : 'ct-new', ...contactPost };
      if (lifecycleMode) lifecycle.contact = created;
      await route.fulfill(json(created, 201));
      return;
    }
    if (method === 'PATCH' && path === '/crm/contacts/ct1') {
      contactPatch = req.postDataJSON();
      await route.fulfill(json({ ...contact, ...contactPatch }));
      return;
    }
    if (method === 'DELETE' && path === '/crm/contacts/ct1') {
      contactDeleteId = 'ct1';
      await route.fulfill({ status: 204 });
      return;
    }
    if (method === 'GET' && path === '/crm/csv/contacts') {
      csvExportRequested = true;
      await route.fulfill({
        status: 200,
        contentType: 'text/csv; charset=utf-8',
        body: 'firstName,lastName,email\nAli,A,ali@example.test\n',
      });
      return;
    }
    if (method === 'POST' && path === '/crm/csv/contacts/import') {
      const body = req.postDataJSON();
      if (body.dryRun) {
        csvImportPreview = body;
        if (invalidCsvPreview) {
          invalidCsvPreview = false;
          await route.fulfill(json({
            totalRows: 1,
            validRows: 0,
            duplicates: [],
            errors: [{ row: 2, message: 'invalid email' }],
          }));
        } else {
          await route.fulfill(json({
            totalRows: 1,
            validRows: 1,
            duplicates: [],
            errors: [],
          }));
        }
      } else {
        if (invalidCsvPreview) invalidCsvExecuteAttempted = true;
        csvImportExecute = body;
        await route.fulfill(json({ imported: 1, skippedDuplicates: 0 }));
      }
      return;
    }

    if (method === 'GET' && path === '/crm/companies/co1') {
      await route.fulfill(json(company));
      return;
    }
    if (method === 'GET' && path === '/crm/companies/co-life') {
      await route.fulfill(json(lifecycle.company || company));
      return;
    }
    if (method === 'GET' && path === '/crm/companies') {
      companyListQueries.push(queryObject(url));
      const data = lifecycleMode && lifecycle.company ? [lifecycle.company, company] : [company];
      await route.fulfill(json({ data, count: data.length, page: 1, limit: Number(url.searchParams.get('limit') || 20) }));
      return;
    }
    if (method === 'POST' && path === '/crm/companies') {
      companyPost = req.postDataJSON();
      const created = { id: lifecycleMode ? 'co-life' : 'co-new', ...companyPost };
      if (lifecycleMode) lifecycle.company = created;
      await route.fulfill(json(created, 201));
      return;
    }
    if (method === 'PATCH' && path === '/crm/companies/co1') {
      companyPatch = req.postDataJSON();
      await route.fulfill(json({ ...company, ...companyPatch }));
      return;
    }
    if (method === 'DELETE' && path === '/crm/companies/co1') {
      companyDeleteId = 'co1';
      await route.fulfill({ status: 204 });
      return;
    }

    if (method === 'GET' && path === '/crm/deals/d1') {
      await route.fulfill(json(deal));
      return;
    }
    if (method === 'GET' && path === '/crm/deals') {
      dealListQueries.push(queryObject(url));
      if (failNextDealList) {
        failNextDealList = false;
        await route.fulfill(json({ message: 'forced list failure' }, 500));
        return;
      }
      const dealData = lifecycleMode && lifecycle.deal ? [lifecycle.deal, deal] : [deal];
      await route.fulfill(json({
        data: dealData,
        count: lifecycleMode ? dealData.length : 60,
        page: Number(url.searchParams.get('page') || 1),
        limit: Number(url.searchParams.get('limit') || 25),
      }));
      return;
    }
    if (method === 'POST' && path === '/crm/deals') {
      dealPost = req.postDataJSON();
      if (failNextDealPost) {
        failNextDealPost = false;
        await route.fulfill(json({ message: 'forced deal create failure' }, 500));
        return;
      }
      const created = { id: lifecycleMode ? 'd-life' : 'd-new', ...dealPost };
      if (lifecycleMode) lifecycle.deal = created;
      await route.fulfill(json(created, 201));
      return;
    }
    if (method === 'PATCH' && path === '/crm/deals/d1') {
      dealPatch = req.postDataJSON();
      await route.fulfill(json({ ...deal, ...dealPatch }));
      return;
    }
    if (method === 'DELETE' && path === '/crm/deals/d1') {
      dealDeleteId = 'd1';
      await route.fulfill({ status: 204 });
      return;
    }

    if (method === 'GET' && path === '/crm/activities/a1') {
      await route.fulfill(json(activity));
      return;
    }
    if (method === 'GET' && path === '/crm/activities') {
      activityListQueries.push(queryObject(url));
      const activityData = lifecycleMode && lifecycle.activity ? [lifecycle.activity, activity] : [activity];
      await route.fulfill(json({
        data: activityData,
        count: lifecycleMode ? activityData.length : 60,
        page: Number(url.searchParams.get('page') || 1),
        limit: Number(url.searchParams.get('limit') || 25),
      }));
      return;
    }
    if (method === 'POST' && path === '/crm/activities') {
      activityPost = req.postDataJSON();
      if (failNextActivityPost) {
        failNextActivityPost = false;
        await route.fulfill(json({ message: 'forced activity create failure' }, 500));
        return;
      }
      const created = { id: lifecycleMode ? 'a-life' : 'a-new', ...activityPost };
      if (lifecycleMode) lifecycle.activity = created;
      await route.fulfill(json(created, 201));
      return;
    }
    if (method === 'PATCH' && path === '/crm/activities/a1') {
      const body = req.postDataJSON();
      if (body.completedAt && Object.keys(body).length === 1) {
        activityCompletePatch = body;
      } else {
        activityPatch = body;
      }
      await route.fulfill(json({ ...activity, ...body }));
      return;
    }
    if (method === 'DELETE' && path === '/crm/activities/a1') {
      activityDeleteId = 'a1';
      await route.fulfill({ status: 204 });
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



async function chooseComboboxOption(page, label, searchPlaceholder, searchValue, optionName) {
  await comboboxByLabel(page, label).click();
  await page.getByPlaceholder(searchPlaceholder).fill(searchValue);
  await page.getByRole('option', { name: optionName, exact: true }).click();
}

async function testDealCrudAndErrors(page) {
  dealPost = null;
  dealDeleteId = null;

  await page.goto(`${BASE}/dashboard/crm/deals`);
  await page.getByText('Browser Deal', { exact: true }).waitFor();

  await page.getByRole('button', { name: 'صفقة جديدة', exact: true }).click();
  await page.getByRole('heading', { name: 'صفقة جديدة', exact: true }).waitFor();
  await fieldByLabel(page, 'العنوان', 'input').fill('Created Browser Deal');
  await chooseComboboxOption(page, 'العميل', 'ابحث بالاسم أو البريد أو الجوال...', 'Ali', 'Ali A');
  await chooseComboboxOption(page, 'الشركة', 'ابحث عن شركة...', 'Browser', 'Browser Company');
  await fieldByLabel(page, 'مسار المبيعات', 'select').selectOption('p1');
  await fieldByLabel(page, 'المرحلة الديناميكية', 'select').selectOption('s1');
  await fieldByLabel(page, 'القيمة', 'input').fill('50000');
  await fieldByLabel(page, 'الاحتمالية %', 'input').fill('40');
  await fieldByLabel(page, 'الوصف', 'textarea').fill('Created from browser E2E');
  await page.getByRole('button', { name: 'إنشاء', exact: true }).click();
  await waitUntil(() => Boolean(dealPost), 'Deal POST was not sent');
  assert.equal(dealPost.title, 'Created Browser Deal');
  assert.equal(dealPost.contactId, 'ct1');
  assert.equal(dealPost.companyId, 'co1');
  assert.equal(dealPost.pipelineId, 'p1');
  assert.equal(dealPost.pipelineStageId, 's1');
  assert.equal(dealPost.value, 50000);
  assert.equal(dealPost.probability, 40);

  const alertMessages = [];
  const onDialog = async (dialog) => {
    alertMessages.push(dialog.message());
    await dialog.accept();
  };
  page.on('dialog', onDialog);
  failNextDealPost = true;
  await page.getByRole('button', { name: 'صفقة جديدة', exact: true }).click();
  await fieldByLabel(page, 'العنوان', 'input').fill('Failing Browser Deal');
  await chooseComboboxOption(page, 'العميل', 'ابحث بالاسم أو البريد أو الجوال...', 'Ali', 'Ali A');
  await page.getByRole('button', { name: 'إنشاء', exact: true }).click();
  await waitUntil(() => alertMessages.includes('حدث خطأ'), 'Deal create failure did not surface an alert');
  await page.getByRole('heading', { name: 'صفقة جديدة', exact: true }).waitFor();
  await page.getByRole('button', { name: 'إلغاء', exact: true }).click();
  page.off('dialog', onDialog);

  failNextDealList = true;
  await page.goto(`${BASE}/dashboard/crm/deals`);
  await page.getByText('تعذر تحميل الصفقات. تحقق من الاتصال بالخادم.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'إعادة المحاولة', exact: true }).click();
  await page.getByText('Browser Deal', { exact: true }).waitFor();

  dealListQueries.length = 0;
  await page.getByRole('button', { name: 'التالي', exact: true }).click();
  await waitUntil(() => dealListQueries.some((q) => q.page === '2'), 'Deals did not reach page 2 before delete');
  page.once('dialog', (dialog) => dialog.accept());
  const row = page.locator('.scc-card-hover').filter({ hasText: 'Browser Deal' }).first();
  await row.hover();
  await row.locator('button').last().click();
  await waitUntil(() => dealDeleteId === 'd1', 'Deal DELETE was not sent');
  await waitUntil(() => dealListQueries.some((q) => q.page === '1'), 'Deals did not return to page 1 after deleting the last row on page 2');
}

async function testActivityCrudAndErrors(page) {
  activityPost = null;
  activityDeleteId = null;
  activityCompletePatch = null;

  await page.goto(`${BASE}/dashboard/crm/activities`);
  await page.getByText('Browser Activity', { exact: true }).waitFor();

  await page.getByRole('button', { name: 'نشاط جديد', exact: true }).click();
  await page.getByRole('heading', { name: 'نشاط جديد', exact: true }).waitFor();
  await fieldByLabel(page, 'الموضوع', 'input').fill('Created Browser Activity');
  await chooseComboboxOption(page, 'جهة الاتصال', 'ابحث عن جهة اتصال...', 'Ali', 'Ali A');
  await chooseComboboxOption(page, 'الصفقة', 'ابحث عن صفقة...', 'Browser', 'Browser Deal');
  await fieldByLabel(page, 'الوصف', 'textarea').fill('Created activity from browser E2E');
  await page.getByRole('button', { name: 'إنشاء', exact: true }).click();
  await waitUntil(() => Boolean(activityPost), 'Activity POST was not sent');
  assert.equal(activityPost.type, 'TASK');
  assert.equal(activityPost.subject, 'Created Browser Activity');
  assert.equal(activityPost.contactId, 'ct1');
  assert.equal(activityPost.dealId, 'd1');

  failNextActivityPost = true;
  await page.getByRole('button', { name: 'نشاط جديد', exact: true }).click();
  await fieldByLabel(page, 'الموضوع', 'input').fill('Failing Browser Activity');
  await page.getByRole('button', { name: 'إنشاء', exact: true }).click();
  await page.getByRole('heading', { name: 'نشاط جديد', exact: true }).waitFor();
  await page.getByRole('button', { name: 'إلغاء', exact: true }).click();

  let row = page.locator('.scc-card-hover').filter({ hasText: 'Browser Activity' }).first();
  await row.getByTitle('إكمال').click();
  await waitUntil(() => Boolean(activityCompletePatch?.completedAt), 'Activity completion PATCH was not sent');

  activityListQueries.length = 0;
  await page.getByRole('button', { name: 'التالي', exact: true }).click();
  await waitUntil(() => activityListQueries.some((q) => q.page === '2'), 'Activities did not reach page 2 before delete');
  page.once('dialog', (dialog) => dialog.accept());
  row = page.locator('.scc-card-hover').filter({ hasText: 'Browser Activity' }).first();
  await row.getByTitle('حذف').click();
  await waitUntil(() => activityDeleteId === 'a1', 'Activity DELETE was not sent');
  await waitUntil(() => activityListQueries.some((q) => q.page === '1'), 'Activities did not return to page 1 after deleting the last row on page 2');
}




async function testInvalidCsvGuard(page) {
  invalidCsvPreview = true;
  invalidCsvExecuteAttempted = false;
  csvImportPreview = null;
  csvImportExecute = null;

  await page.goto(`${BASE}/dashboard/crm/contacts`);
  await page.getByText('Ali A', { exact: true }).waitFor();

  const alerts = [];
  const onDialog = async (dialog) => {
    alerts.push({ type: dialog.type(), message: dialog.message() });
    await dialog.accept();
  };
  page.on('dialog', onDialog);

  await page.locator('#crm-csv-import').setInputFiles({
    name: 'invalid-contacts.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('firstName,lastName,email\nBad,Email,not-an-email\n'),
  });

  await waitUntil(() => Boolean(csvImportPreview), 'Invalid CSV preview was not sent');
  await waitUntil(
    () => alerts.some((d) => d.type === 'alert' && d.message.includes('لن يتم الاستيراد حتى تصحيح الأخطاء')),
    'Invalid CSV error alert was not shown',
  );
  assert.equal(csvImportExecute, null, 'Invalid CSV unexpectedly executed import');
  assert.equal(invalidCsvExecuteAttempted, false, 'Invalid CSV reached execute phase');
  page.off('dialog', onDialog);
}

async function testOverviewRecoveryAndQuickLinks(page) {
  failNextOverview = true;
  await page.goto(`${BASE}/dashboard/crm`);
  await page.getByText('تعذر تحميل نظرة CRM. تحقق من الاتصال بالخادم ثم أعد المحاولة.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'إعادة المحاولة', exact: true }).click();
  await page.getByRole('heading', { name: 'نظرة عامة على CRM', exact: true }).waitFor();
  await page.getByText('أحدث الأنشطة', { exact: true }).waitFor();

  const links = [
    ['جهات الاتصال', '/dashboard/crm/contacts'],
    ['الشركات', '/dashboard/crm/companies'],
    ['الصفقات', '/dashboard/crm/deals'],
    ['مسارات المبيعات', '/dashboard/crm/pipelines'],
    ['الأنشطة', '/dashboard/crm/activities'],
  ];

  for (const [label, href] of links) {
    await page.goto(`${BASE}/dashboard/crm`);
    await page.getByRole('heading', { name: 'نظرة عامة على CRM', exact: true }).waitFor();
    const quickLink = page.locator('a').filter({ hasText: label }).filter({ has: page.locator('svg') }).last();
    await quickLink.click();
    await page.waitForURL((url) => url.pathname === href);
    assert.equal(new URL(page.url()).pathname, href, `Quick link ${label} did not navigate to ${href}`);
  }
}

async function testContactCrudAndCsv(page) {
  contactPost = null;
  contactPatch = null;
  contactDeleteId = null;
  csvExportRequested = false;
  csvImportPreview = null;
  csvImportExecute = null;

  await page.goto(`${BASE}/dashboard/crm/contacts`);
  await page.getByText('Ali A', { exact: true }).waitFor();

  await page.getByRole('button', { name: 'إضافة جهة اتصال', exact: true }).click();
  await page.getByRole('heading', { name: 'إضافة جهة اتصال', exact: true }).waitFor();
  await fieldByLabel(page, 'الاسم الأول', 'input').fill('Created');
  await fieldByLabel(page, 'الاسم الأخير', 'input').fill('Contact');
  await fieldByLabel(page, 'البريد الإلكتروني', 'input').fill('created@example.test');
  await fieldByLabel(page, 'الشركة', 'select').selectOption('co1');
  await page.getByRole('button', { name: 'إنشاء', exact: true }).click();
  await waitUntil(() => Boolean(contactPost), 'Contact POST was not sent');
  assert.equal(contactPost.firstName, 'Created');
  assert.equal(contactPost.lastName, 'Contact');
  assert.equal(contactPost.email, 'created@example.test');
  assert.equal(contactPost.companyId, 'co1');

  let card = page.locator('.scc-card-hover').filter({ hasText: 'Ali A' }).first();
  await card.hover();
  await card.locator('button').first().click();
  await page.getByRole('heading', { name: 'تعديل جهة اتصال', exact: true }).waitFor();
  await fieldByLabel(page, 'المسمى الوظيفي', 'input').fill('CFO');
  await fieldByLabel(page, 'الشركة', 'select').selectOption('');
  await page.getByRole('button', { name: 'حفظ التعديلات', exact: true }).click();
  await waitUntil(() => Boolean(contactPatch), 'Contact PATCH was not sent');
  assert.equal(contactPatch.jobTitle, 'CFO');
  assert.equal(contactPatch.companyId, null);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'تصدير CSV', exact: true }).click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), 'crm-contacts.csv');
  assert.equal(csvExportRequested, true);

  const dialogs = [];
  const dialogHandler = async (dialog) => {
    dialogs.push({ type: dialog.type(), message: dialog.message() });
    await dialog.accept();
  };
  page.on('dialog', dialogHandler);
  await page.locator('#crm-csv-import').setInputFiles({
    name: 'contacts.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('firstName,lastName,email\nImported,Contact,imported@example.test\n'),
  });
  await waitUntil(() => Boolean(csvImportPreview), 'CSV dry-run import was not sent');
  await waitUntil(() => Boolean(csvImportExecute), 'CSV execute import was not sent');
  assert.equal(csvImportPreview.dryRun, true);
  assert.equal(csvImportExecute.dryRun, false);
  assert.match(csvImportPreview.csv, /Imported,Contact/);
  assert.match(csvImportExecute.csv, /Imported,Contact/);
  await waitUntil(() => dialogs.some((d) => d.type === 'confirm') && dialogs.some((d) => d.type === 'alert'), 'CSV import dialogs were not shown');
  page.off('dialog', dialogHandler);

  card = page.locator('.scc-card-hover').filter({ hasText: 'Ali A' }).first();
  await card.hover();
  page.once('dialog', (dialog) => dialog.accept());
  await card.locator('button').last().click();
  await waitUntil(() => contactDeleteId === 'ct1', 'Contact DELETE was not sent');
}

async function testCompanyCrud(page) {
  companyPost = null;
  companyPatch = null;
  companyDeleteId = null;

  await page.goto(`${BASE}/dashboard/crm/companies`);
  await page.getByText('Browser Company', { exact: true }).waitFor();

  await page.getByRole('button', { name: 'شركة جديدة', exact: true }).click();
  await page.getByRole('heading', { name: 'شركة جديدة', exact: true }).waitFor();
  await fieldByLabel(page, 'الاسم', 'input').fill('Created Browser Company');
  await fieldByLabel(page, 'السجل التجاري', 'input').fill('1010101010');
  await fieldByLabel(page, 'المدينة', 'input').fill('Riyadh');
  await page.getByRole('button', { name: 'إنشاء', exact: true }).click();
  await waitUntil(() => Boolean(companyPost), 'Company POST was not sent');
  assert.equal(companyPost.name, 'Created Browser Company');
  assert.equal(companyPost.crNumber, '1010101010');
  assert.equal(companyPost.city, 'Riyadh');

  let card = page.locator('.scc-card-hover').filter({ hasText: 'Browser Company' }).first();
  await card.locator('button').first().click();
  await page.getByRole('heading', { name: 'تعديل الشركة', exact: true }).waitFor();
  await fieldByLabel(page, 'الاسم القانوني', 'input').fill('Browser Company Legal');
  await page.getByRole('button', { name: 'حفظ', exact: true }).click();
  await waitUntil(() => Boolean(companyPatch), 'Company PATCH was not sent');
  assert.equal(companyPatch.legalName, 'Browser Company Legal');

  card = page.locator('.scc-card-hover').filter({ hasText: 'Browser Company' }).first();
  page.once('dialog', (dialog) => dialog.accept());
  await card.locator('button').last().click();
  await waitUntil(() => companyDeleteId === 'co1', 'Company DELETE was not sent');
}

async function testPipelineAndStageCrud(page) {
  pipelinePost = null;
  pipelinePatch = null;
  pipelineDeleteId = null;
  stagePost = null;
  stagePatch = null;
  stageDeleteId = null;

  await page.goto(`${BASE}/dashboard/crm/pipelines`);
  await page.getByText('Browser Pipeline', { exact: true }).first().waitFor();

  await page.getByRole('button', { name: 'مسار جديد', exact: true }).click();
  await page.getByRole('heading', { name: 'مسار جديد', exact: true }).waitFor();
  await fieldByLabel(page, 'الاسم', 'input').fill('Created Browser Pipeline');
  await fieldByLabel(page, 'الوصف', 'textarea').fill('Pipeline from browser E2E');
  await page.getByRole('button', { name: 'حفظ', exact: true }).click();
  await waitUntil(() => Boolean(pipelinePost), 'Pipeline POST was not sent');
  assert.equal(pipelinePost.name, 'Created Browser Pipeline');
  assert.equal(pipelinePost.description, 'Pipeline from browser E2E');

  const pipelineButton = page.locator('button.scc-card-hover').filter({ hasText: 'Browser Pipeline' }).first();
  await pipelineButton.locator('span').filter({ has: page.locator('svg') }).first().click();
  await page.getByRole('heading', { name: 'تعديل المسار', exact: true }).waitFor();
  await fieldByLabel(page, 'الوصف', 'textarea').fill('Updated pipeline');
  await page.getByRole('button', { name: 'حفظ', exact: true }).click();
  await waitUntil(() => Boolean(pipelinePatch), 'Pipeline PATCH was not sent');
  assert.equal(pipelinePatch.description, 'Updated pipeline');

  await page.getByText('Browser Pipeline', { exact: true }).first().click();
  await page.getByRole('button', { name: 'مرحلة', exact: true }).click();
  await page.getByRole('heading', { name: 'مرحلة جديدة', exact: true }).waitFor();
  await fieldByLabel(page, 'الاسم', 'input').fill('Created Stage');
  await fieldByLabel(page, 'الكود', 'input').fill('created stage');
  await fieldByLabel(page, 'الترتيب', 'input').fill('2');
  await fieldByLabel(page, 'الاحتمالية %', 'input').fill('50');
  await page.getByRole('button', { name: 'حفظ', exact: true }).click();
  await waitUntil(() => Boolean(stagePost), 'Stage POST was not sent');
  assert.equal(stagePost.name, 'Created Stage');
  assert.equal(stagePost.code, 'CREATED_STAGE');
  assert.equal(stagePost.order, 2);
  assert.equal(stagePost.probability, 50);

  const stageRow = page.locator('.rounded-xl.border').filter({ hasText: 'Browser Stage' }).first();
  await stageRow.locator('button').first().click();
  await page.getByRole('heading', { name: 'تعديل المرحلة', exact: true }).waitFor();
  await fieldByLabel(page, 'الاحتمالية %', 'input').fill('70');
  await page.getByRole('button', { name: 'حفظ', exact: true }).click();
  await waitUntil(() => Boolean(stagePatch), 'Stage PATCH was not sent');
  assert.equal(stagePatch.probability, 70);

  const stageRow2 = page.locator('.rounded-xl.border').filter({ hasText: 'Browser Stage' }).first();
  page.once('dialog', (dialog) => dialog.accept());
  await stageRow2.locator('button').last().click();
  await waitUntil(() => stageDeleteId === 's1', 'Stage DELETE was not sent');

  const pipelineButton2 = page.locator('button.scc-card-hover').filter({ hasText: 'Browser Pipeline' }).first();
  page.once('dialog', (dialog) => dialog.accept());
  await pipelineButton2.locator('span').filter({ has: page.locator('svg') }).last().click();
  await waitUntil(() => pipelineDeleteId === 'p1', 'Pipeline DELETE was not sent');
}

async function testCrmLifecycle(page) {
  lifecycleMode = true;
  lifecycle.company = null;
  lifecycle.contact = null;
  lifecycle.pipeline = null;
  lifecycle.stage = null;
  lifecycle.deal = null;
  lifecycle.activity = null;

  await page.goto(`${BASE}/dashboard/crm/companies`);
  await page.getByRole('button', { name: 'شركة جديدة', exact: true }).click();
  await fieldByLabel(page, 'الاسم', 'input').fill('Lifecycle Company');
  await page.getByRole('button', { name: 'إنشاء', exact: true }).click();
  await waitUntil(() => lifecycle.company?.id === 'co-life', 'Lifecycle company was not created');

  await page.goto(`${BASE}/dashboard/crm/contacts`);
  await page.getByRole('button', { name: 'إضافة جهة اتصال', exact: true }).click();
  await fieldByLabel(page, 'الاسم الأول', 'input').fill('Lifecycle');
  await fieldByLabel(page, 'الاسم الأخير', 'input').fill('Contact');
  await fieldByLabel(page, 'الشركة', 'select').selectOption('co-life');
  await page.getByRole('button', { name: 'إنشاء', exact: true }).click();
  await waitUntil(() => lifecycle.contact?.id === 'ct-life', 'Lifecycle contact was not created');
  assert.equal(lifecycle.contact.companyId, 'co-life');

  await page.goto(`${BASE}/dashboard/crm/pipelines`);
  await page.getByRole('button', { name: 'مسار جديد', exact: true }).click();
  await fieldByLabel(page, 'الاسم', 'input').fill('Lifecycle Pipeline');
  await page.getByRole('button', { name: 'حفظ', exact: true }).click();
  await waitUntil(() => lifecycle.pipeline?.id === 'p-new', 'Lifecycle pipeline was not created');
  await page.getByText('Lifecycle Pipeline', { exact: true }).first().click();
  await page.getByRole('button', { name: 'مرحلة', exact: true }).click();
  await fieldByLabel(page, 'الاسم', 'input').fill('Lifecycle Stage');
  await fieldByLabel(page, 'الكود', 'input').fill('lifecycle');
  await fieldByLabel(page, 'الترتيب', 'input').fill('1');
  await fieldByLabel(page, 'الاحتمالية %', 'input').fill('30');
  await page.getByRole('button', { name: 'حفظ', exact: true }).click();
  await waitUntil(() => lifecycle.stage?.id === 's-life', 'Lifecycle stage was not created');

  await page.goto(`${BASE}/dashboard/crm/deals`);
  await page.getByRole('button', { name: 'صفقة جديدة', exact: true }).click();
  await fieldByLabel(page, 'العنوان', 'input').fill('Lifecycle Deal');
  await chooseComboboxOption(page, 'العميل', 'ابحث بالاسم أو البريد أو الجوال...', 'Lifecycle', 'Lifecycle Contact');
  await chooseComboboxOption(page, 'الشركة', 'ابحث عن شركة...', 'Lifecycle', 'Lifecycle Company');
  await fieldByLabel(page, 'مسار المبيعات', 'select').selectOption('p-new');
  await fieldByLabel(page, 'المرحلة الديناميكية', 'select').selectOption('s-life');
  await page.getByRole('button', { name: 'إنشاء', exact: true }).click();
  await waitUntil(() => lifecycle.deal?.id === 'd-life', 'Lifecycle deal was not created');
  assert.equal(lifecycle.deal.contactId, 'ct-life');
  assert.equal(lifecycle.deal.companyId, 'co-life');
  assert.equal(lifecycle.deal.pipelineId, 'p-new');
  assert.equal(lifecycle.deal.pipelineStageId, 's-life');

  await page.goto(`${BASE}/dashboard/crm/activities`);
  await page.getByRole('button', { name: 'نشاط جديد', exact: true }).click();
  await fieldByLabel(page, 'الموضوع', 'input').fill('Lifecycle Activity');
  await chooseComboboxOption(page, 'جهة الاتصال', 'ابحث عن جهة اتصال...', 'Lifecycle', 'Lifecycle Contact');
  await chooseComboboxOption(page, 'الصفقة', 'ابحث عن صفقة...', 'Lifecycle', 'Lifecycle Deal');
  await page.getByRole('button', { name: 'إنشاء', exact: true }).click();
  await waitUntil(() => lifecycle.activity?.id === 'a-life', 'Lifecycle activity was not created');
  assert.equal(lifecycle.activity.contactId, 'ct-life');
  assert.equal(lifecycle.activity.dealId, 'd-life');

  await page.goto(`${BASE}/dashboard/crm`);
  await page.getByRole('heading', { name: 'نظرة عامة على CRM', exact: true }).waitFor();
  await page.getByText('Lifecycle Activity', { exact: true }).waitFor();
  await page.getByText('Lifecycle Pipeline', { exact: true }).waitFor({ state: 'detached' }).catch(() => {});
  const cards = page.locator('.scc-card-hover');
  assert.ok(await cards.count() >= 5, 'CRM overview cards were not rendered');
  await page.getByText('أحدث الأنشطة', { exact: true }).waitFor();
  await page.getByText('Lifecycle Activity', { exact: true }).waitFor();

  lifecycleMode = false;
}

async function testDealQueryContracts(page) {
  dealListQueries.length = 0;
  companyListQueries.length = 0;

  await page.goto(`${BASE}/dashboard/crm/deals`);
  await page.getByText('Browser Deal', { exact: true }).waitFor();
  await waitUntil(
    () => dealListQueries.some((q) => q.page === '1' && q.limit === '25'),
    'Deals did not request page=1&limit=25',
  );

  await page.getByPlaceholder('البحث في كل الصفقات...').fill('needle');
  await waitUntil(
    () => dealListQueries.some((q) => q.search === 'needle' && q.page === '1'),
    'Deals search was not sent server-side after debounce',
  );

  await page.getByLabel('تصفية حسب المرحلة', { exact: true }).selectOption('QUALIFIED');
  await waitUntil(
    () => dealListQueries.some((q) => q.search === 'needle' && q.stage === 'QUALIFIED' && q.page === '1'),
    'Deals stage filter was not sent server-side',
  );

  const companyFilter = page.locator('button[aria-haspopup="listbox"]').filter({ hasText: 'كل الشركات' }).first();
  await companyFilter.click();
  await page.getByPlaceholder('ابحث عن شركة...').fill('Acme');
  await waitUntil(
    () => companyListQueries.some((q) => q.search === 'Acme' && q.limit === '20' && q.active === 'true'),
    'Company AsyncCombobox did not perform server-side search',
  );
  await page.getByRole('option', { name: 'Browser Company', exact: true }).click();
  await waitUntil(
    () => dealListQueries.some((q) => q.companyId === 'co1' && q.page === '1'),
    'Deals company filter was not sent server-side',
  );

  await page.getByLabel('تصفية حسب المسار').selectOption('p1');
  await waitUntil(
    () => dealListQueries.some((q) => q.pipelineId === 'p1' && !q.pipelineStageId && q.page === '1'),
    'Deals pipeline filter was not sent server-side',
  );

  await page.getByLabel('تصفية حسب المرحلة الديناميكية').selectOption('s1');
  await waitUntil(
    () => dealListQueries.some((q) => q.pipelineId === 'p1' && q.pipelineStageId === 's1' && q.page === '1'),
    'Deals pipeline stage filter was not sent server-side',
  );

  await page.getByRole('button', { name: 'التالي', exact: true }).click();
  await waitUntil(
    () => dealListQueries.some((q) =>
      q.page === '2' &&
      q.limit === '25' &&
      q.search === 'needle' &&
      q.stage === 'QUALIFIED' &&
      q.companyId === 'co1' &&
      q.pipelineId === 'p1' &&
      q.pipelineStageId === 's1'
    ),
    'Deals page 2 did not preserve all server-side filters',
  );
  await page.getByText('صفحة 2 من 3 — إجمالي 60', { exact: true }).waitFor();
}

async function testActivityQueryContracts(page) {
  activityListQueries.length = 0;
  contactListQueries.length = 0;
  dealListQueries.length = 0;

  await page.goto(`${BASE}/dashboard/crm/activities?dealId=d1&type=TASK`);
  await page.getByText('Browser Activity', { exact: true }).waitFor();
  await waitUntil(
    () => activityListQueries.some((q) => q.page === '1' && q.limit === '25' && q.type === 'TASK' && q.dealId === 'd1'),
    'Activities URL filters were not applied server-side',
  );

  await page.getByPlaceholder('بحث في كل الأنشطة...').fill('follow');
  await waitUntil(
    () => activityListQueries.some((q) => q.search === 'follow' && q.type === 'TASK' && q.dealId === 'd1' && q.page === '1'),
    'Activities search was not sent server-side after debounce',
  );

  await page.locator('select').first().selectOption('CALL');
  await waitUntil(
    () => activityListQueries.some((q) => q.search === 'follow' && q.type === 'CALL' && q.dealId === 'd1' && q.page === '1'),
    'Activities type filter was not sent server-side',
  );

  const contactFilter = page.locator('button[aria-haspopup="listbox"]').filter({ hasText: 'كل جهات الاتصال' }).first();
  await contactFilter.click();
  await page.getByPlaceholder('ابحث عن جهة اتصال...').fill('Ali');
  await waitUntil(
    () => contactListQueries.some((q) => q.search === 'Ali' && q.limit === '20'),
    'Contact AsyncCombobox did not perform server-side search',
  );
  await page.getByRole('option', { name: 'Ali A', exact: true }).click();
  await waitUntil(
    () => activityListQueries.some((q) => q.contactId === 'ct1' && q.page === '1'),
    'Activities contact filter was not sent server-side',
  );

  const selectedDealFilter = page.locator('button[aria-haspopup="listbox"]').filter({ hasText: 'Browser Deal' }).first();
  await selectedDealFilter.click();
  await page.getByRole('button', { name: 'كل الصفقات', exact: true }).click();

  const emptyDealFilter = page.locator('button[aria-haspopup="listbox"]').filter({ hasText: 'كل الصفقات' }).first();
  await emptyDealFilter.click();
  await page.getByPlaceholder('ابحث عن صفقة...').fill('Renewal');
  await waitUntil(
    () => dealListQueries.some((q) => q.search === 'Renewal' && q.limit === '20'),
    'Deal AsyncCombobox did not perform server-side search',
  );
  await page.getByRole('option', { name: 'Browser Deal', exact: true }).click();
  await waitUntil(
    () => activityListQueries.some((q) => q.dealId === 'd1' && q.contactId === 'ct1' && q.type === 'CALL' && q.search === 'follow' && q.page === '1'),
    'Activities deal filter was not restored server-side',
  );

  await page.getByRole('button', { name: 'التالي', exact: true }).click();
  await waitUntil(
    () => activityListQueries.some((q) =>
      q.page === '2' &&
      q.limit === '25' &&
      q.search === 'follow' &&
      q.type === 'CALL' &&
      q.contactId === 'ct1' &&
      q.dealId === 'd1'
    ),
    'Activities page 2 did not preserve all server-side filters',
  );
  await page.getByText('صفحة 2 من 3 — إجمالي 60', { exact: true }).waitFor();
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
  await testDealQueryContracts(page);
  await testActivityQueryContracts(page);
  await testDealCrudAndErrors(page);
  await testActivityCrudAndErrors(page);
  await testContactCrudAndCsv(page);
  await testInvalidCsvGuard(page);
  await testOverviewRecoveryAndQuickLinks(page);
  await testCompanyCrud(page);
  await testPipelineAndStageCrud(page);
  await testCrmLifecycle(page);
  console.log('CRM_BROWSER_E2E: PASS');
} catch (error) {
  console.error('CRM_BROWSER_E2E: FAIL');
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
