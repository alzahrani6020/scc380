import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const dbUrl = new URL(process.env.DATABASE_URL || '');
if (process.env.SCC380_TEST_DATABASE_ISOLATED !== 'YES' ||
    dbUrl.hostname !== '127.0.0.1' || dbUrl.pathname !== '/ownerfiles_ci' ||
    process.env.NODE_ENV !== 'test') {
  throw new Error('STOP: isolated ownerfiles_ci PostgreSQL is mandatory');
}
const requireApi = createRequire(new URL('../../api/package.json', import.meta.url));
const { prisma } = requireApi('@scc/database');
const { JwtService } = requireApi('@nestjs/jwt');
const jwt = new JwtService({ secret: process.env.JWT_SECRET });
const base = 'http://127.0.0.1:3000';
const uid = 'browserci_' + randomBytes(7).toString('hex');
const configuredOwner = 'owner-browser-ci@example.test';
const tenants = [], users = [], sessions = [];
let browser;
const signIn = async (person) => {
  const token = jwt.sign({ sub:person.id,email:person.email,role:person.role,
    tenantId:person.tenantId,type:'access',sid:person.sid }, { expiresIn:'15m' });
  const context = await browser.newContext({acceptDownloads:true});
  await context.addCookies([{name:'accessToken',value:token,url:base,sameSite:'Lax'}]);
  await context.addInitScript(tokenValue => {
    localStorage.setItem('accessToken',tokenValue);
    localStorage.setItem('role','ADMIN');
  },token);
  const page=await context.newPage();
  return {context,page,token};
};
async function checkPage(page, path, heading) {
  const response = await page.goto(base+path,{waitUntil:'domcontentloaded'});
  assert.equal(response?.status(),200, path + ': HTTP 200 expected');
  await page.getByRole('heading',{name:heading}).waitFor({timeout:25000});
  assert.equal(page.url().includes('/auth/login'),false);
}
async function waitForRequest(requesterId, scope) {
  for(let i=0;i<30;i++){
    const r=await prisma.ownerFileRequest.findFirst({
      where:{requesterId,scope},orderBy:{createdAt:'desc'}
    });
    if(r) return r;
    await new Promise(resolve=>setTimeout(resolve,300));
  }
  throw new Error('Browser request never reached database');
}
async function downloadAndVerify(page,expected,requestId) {
  const responses = [];
  const onResponse = (response) => {
    if (response.url().includes('/owner-files/requests/') && response.url().includes('/download')) {
      responses.push({status:response.status(), contentType:response.headers()['content-type'] || null});
    }
  };
  page.on('response', onResponse);
  const event = page.waitForEvent('download',{timeout:15000});
  try {
    await page.locator('section').filter({hasText:requestId}).getByRole('button',{name:'تنزيل بعد التحقق'}).click();
    const item = await event.catch(async error => {
      const notice = await page.getByRole('status').allTextContents().catch(() => []);
      throw new Error('Browser download missing; API responses=' + JSON.stringify(responses)
        + '; visible notices=' + JSON.stringify(notice), {cause:error});
    });
    const path = await item.path();
    assert.ok(path,'Browser must save a real download');
    assert.equal(await readFile(path,'utf8'),expected);
    assert.equal(await item.failure(),null);
  } finally {
    page.off('response', onResponse);
  }
}
try {
  browser=await chromium.launch({headless:true});
  const tenant=await prisma.tenant.create({data:{name:uid,slug:uid}});
  tenants.push(tenant.id);
  const tenantB=await prisma.tenant.create({data:{name:uid+'-other',slug:uid+'-other'}});
  tenants.push(tenantB.id);
  async function user(suffix,tenantId) {
    const row=await prisma.user.create({data:{
      email:suffix==='owner' ? configuredOwner : uid+'-'+suffix+'@example.test',firstName:'Browser',lastName:suffix,
      role:'ADMIN',status:'ACTIVE',tenantId
    }});
    users.push(row.id);
    const sid=uid+'-'+suffix+'-session';
    await prisma.session.create({data:{id:sid,tenantId,userId:row.id,
      token:uid+'-'+suffix+'-tokenhash',expiresAt:new Date(Date.now()+900000)}});
    sessions.push(sid);
    return {...row,sid};
  }
  const requester=await user('requester',tenant.id);
  const owner=await user('owner',tenant.id);
  const outsider=await user('outsider',tenantB.id);
  // Explicit CI guard: the owner email must be configured to this fixture, never production.
  assert.equal(process.env.SCC380_ACTIVITY_OWNER_EMAIL,configuredOwner);
  const applicant=await signIn(requester);
  const principal=await signIn(owner);
  const foreign=await signIn(outsider);
  // Emulate one upstream 503 while Render wakes up. A safe GET should
  // recover without re-submitting any upload, payment or approval.
  let initialReadFaults=0;
  await applicant.page.route('**/api/owner-files', async route => {
    if (route.request().method() === 'GET' && initialReadFaults === 0) {
      initialReadFaults++;
      await route.fulfill({status:503,contentType:'application/json',body:'{"message":"Service temporarily unavailable"}'});
      return;
    }
    await route.continue();
  });
  await checkPage(applicant.page,'/downloads/files','مركز ملفات الشركة');
  await applicant.page.getByText('لا توجد ملفات تجارية مسجلة لهذه الشركة.').waitFor({timeout:20000});
  assert.equal(initialReadFaults,1,'Transient simulated 503 must be exercised');
  await checkPage(principal.page,'/owner/files','مراجعة الملفات وقرارات التنزيل');
  // Legacy deep link must land in the single owner console, not a second dashboard.
  const ownerUrl = new URL(principal.page.url());
  assert.equal(ownerUrl.pathname,'/owner','Legacy owner file route must redirect to the single console');
  assert.equal(ownerUrl.searchParams.get('tab'),'files','Files tab must be selected');
  await principal.page.getByRole('navigation',{name:'أقسام لوحة المالك الموحدة'}).waitFor();
  // New directories are read-only and remain within the same owner console.
  await principal.page.getByRole('button',{name:'الشركات',exact:true}).click();
  await principal.page.getByRole('heading',{name:'الشركات المصرح بعرضها'}).waitFor();
  assert.equal(new URL(principal.page.url()).pathname,'/owner');
  await principal.page.getByRole('button',{name:'المستخدمون',exact:true}).click();
  await principal.page.getByRole('heading',{name:'المستخدمون المصرح بعرضهم'}).waitFor();
  assert.equal(new URL(principal.page.url()).searchParams.get('tab'),'users');
  await principal.page.getByRole('button',{name:'طلبات الملفات',exact:true}).click();
  await principal.page.getByRole('heading',{name:'مراجعة الملفات وقرارات التنزيل'}).waitFor();
  // Continue with actual approval/download/revocation checks unchanged.

  await checkPage(foreign.page,'/downloads/files','مركز ملفات الشركة');
  const page=applicant.page;
  await page.getByRole('textbox',{name:'عنوان الملف'}).fill('Browser acceptance');
  await page.locator('input[type=file]').setInputFiles({
    name:'acceptance.txt',mimeType:'text/plain',buffer:Buffer.from('alpha\nbeta\ngamma')
  });
  await page.getByRole('button',{name:'رفع الملف'}).click();
  await page.getByText('سُجل الملف في مساحة الشركة.').waitFor();
  await page.locator('select').first().selectOption({index:1});
  await page.getByRole('button',{name:'إرسال طلب تنزيل'}).click();
  await page.getByText(/سُجل الطلب/).waitFor();
  const full=await waitForRequest(requester.id,'FULL');
  // A request awaiting owner approval must never grant download access.
  const pendingStatus = await page.evaluate(async ({id,token}) => {
    const response=await fetch('/api/owner-files/requests/'+id+'/download',{
      headers:{Authorization:'Bearer '+token}});
    return response.status;
  },{id:full.id,token:applicant.token});
  assert.equal(pendingStatus,403,'Pending request must deny download');
  // Upload and request creation are audited atomically, including tenant and actor.
  const uploadAudit = await prisma.auditLog.findFirst({
    where: { tenantId:tenant.id, userId:requester.id, action:'OWNER_FILE_UPLOADED' }
  });
  assert.ok(uploadAudit,'Commercial upload must create a durable audit entry');
  const requestAudit = await prisma.auditLog.findFirst({
    where: { tenantId:tenant.id, userId:requester.id, action:'OWNER_FILE_REQUEST_CREATED', entityId:full.id }
  });
  assert.ok(requestAudit,'File request creation must create an audit entry');
  // Even the configured owner cannot approve their own request.
  const selfRequest = await prisma.ownerFileRequest.create({ data: {
    tenantId:tenant.id, fileId:full.fileId, requesterId:owner.id, scope:'FULL'
  }});
  const selfApproval = await principal.page.evaluate(async ({id,token}) => {
    const response = await fetch('/api/owner-files/owner/decide', {
      method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
      body:JSON.stringify({requestId:id,decision:'APPROVE'})
    });
    return response.status;
  },{id:selfRequest.id,token:principal.token});
  assert.equal(selfApproval,403,'Owner must not approve own request');
  const selfAfter=await prisma.ownerFileRequest.findUnique({where:{id:selfRequest.id}});
  assert.equal(selfAfter?.status,'PENDING','Rejected self approval must not change request');
  const foreignResponse=await foreign.page.evaluate(async ({id,token}) => {
    const response=await fetch('/api/owner-files/requests/'+id+'/download',{
      headers:{Authorization:'Bearer '+token}});
    return response.status;
  },{id:full.id,token:foreign.token});
  assert.equal(foreignResponse,404,'Foreign tenant download must not disclose request');
  await principal.page.getByRole('button',{name:'تحديث',exact:true}).click();
  // Owner search and status filter must expose the pending request.
  await principal.page.getByRole('textbox',{name:'البحث في الطلبات'}).fill(full.id);
  await principal.page.getByLabel('حالة الطلب').selectOption('PENDING');
  await principal.page.getByText(full.id,{exact:false}).first().waitFor();
  await principal.page.getByLabel('حالة الطلب').selectOption('ALL');
  await principal.page.getByRole('textbox',{name:'البحث في الطلبات'}).fill('');
  await principal.page.locator('section').filter({hasText:full.id})
    .getByRole('button',{name:'موافقة'}).click();
  await principal.page.getByText(/APPROVED/).first().waitFor();
  // The owner must observe a durable decision after reloading the page.
  await principal.page.reload({waitUntil:'domcontentloaded'});
  await principal.page.getByText(/APPROVED/).first().waitFor();
  const decisionAudit=await prisma.auditLog.findFirst({where:{
    tenantId:tenant.id,entityType:'OWNER_FILE_REQUEST',entityId:full.id,action:'OWNER_FILE_APPROVED'
  }});
  assert.ok(decisionAudit,'Approved decision must create durable audit entry');
  await page.getByRole('button',{name:'تحديث الطلبات'}).click();
  await downloadAndVerify(page,'alpha\nbeta\ngamma',full.id);
  const finishDeadline=Date.now()+7000;
  let deliveryAudit;
  while(Date.now()<finishDeadline){
    deliveryAudit=await prisma.auditLog.findFirst({where:{
      tenantId:tenant.id,entityType:'OWNER_FILE_REQUEST',entityId:full.id,
      action:'OWNER_FILE_HTTP_RESPONSE_FINISHED'
    }});
    if(deliveryAudit)break;
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  assert.ok(deliveryAudit,'Full download must log finished HTTP response');
  await principal.page.locator('section').filter({hasText:full.id})
    .getByRole('button',{name:'إلغاء السماح'}).click();
  await principal.page.getByText(/REVOKED/).first().waitFor();
  await page.getByRole('button',{name:'تحديث الطلبات'}).click();
  const forbidden=await page.evaluate(async ({id,token}) => {
    const response=await fetch('/api/owner-files/requests/'+id+'/download',{
      headers:{Authorization:'Bearer '+token}});
    return response.status;
  },{id:full.id,token:applicant.token});
  assert.equal(forbidden,403,'Revoked download must be forbidden by API');
  await page.locator('select').nth(1).selectOption('PARTIAL');
  await page.locator('input[type=number]').first().fill('2');
  await page.locator('input[type=number]').nth(1).fill('2');
  await page.getByRole('button',{name:'إرسال طلب تنزيل'}).click();
  await page.getByText(/سُجل الطلب/).waitFor();
  const partial=await waitForRequest(requester.id,'PARTIAL');
  await principal.page.getByRole('button',{name:'تحديث',exact:true}).click();
  // Do not approve the older self-request; act on the exact partial request ID.
  const partialPanel = principal.page.locator('section').filter({hasText:partial.id});
  await partialPanel.getByRole('button',{name:'موافقة'}).click();
  await partialPanel.getByText(/APPROVED/).waitFor();
  // Wait for the actual database commit, not merely a UI text match.
  let approvedPartial;
  const approvalDeadline=Date.now()+8000;
  while (Date.now()<approvalDeadline) {
    approvedPartial=await prisma.ownerFileRequest.findUnique({where:{id:partial.id}});
    if(approvedPartial?.status==='APPROVED')break;
    await new Promise(resolve=>setTimeout(resolve,150));
  }
  if(approvedPartial?.status!=='APPROVED') {
    const notice=await principal.page.locator('[role="alert"]').allTextContents().catch(()=>[]);
    throw new Error('Partial approval not persisted; status='+String(approvedPartial?.status)+
      '; notices='+JSON.stringify(notice));
  }
  await page.getByRole('button',{name:'تحديث الطلبات'}).click();
  await downloadAndVerify(page,'beta',partial.id);
  const forbiddenAudit=await prisma.auditLog.findFirst({where:{
    tenantId:tenant.id,entityType:'OWNER_FILE_REQUEST',entityId:full.id,
    action:'OWNER_FILE_DELIVERY_DENIED'
  }});
  assert.ok(forbiddenAudit,'Denied delivery must be recorded in audit log');
  const revokeAudit=await prisma.auditLog.findFirst({where:{
    tenantId:tenant.id,entityType:'OWNER_FILE_REQUEST',entityId:full.id,
    action:'OWNER_FILE_REVOKED'
  }});
  assert.ok(revokeAudit,'Revocation must be recorded in audit log');
  // Audit pagination: generate only tenant-scoped synthetic CI events and verify
  // that the owner can navigate beyond the original 100-event cutoff.
  await prisma.auditLog.createMany({
    data: Array.from({ length: 105 }, (_, index) => ({
      tenantId:tenant.id, userId:requester.id, entityType:'OWNER_FILE_REQUEST',
      entityId:full.id, action:'OWNER_FILE_PAGINATION_TEST',
      newValues:{ testIndex:index },
    })),
  });
  await principal.page.getByRole('button',{name:'تحديث',exact:true}).click();
  await principal.page.getByRole('button',{name:'تحميل 100 حدث أقدم'}).waitFor();
  await principal.page.getByRole('button',{name:'تحميل 100 حدث أقدم'}).click();
  await principal.page.getByText(/سجل الموافقات ومحاولات التسليم — 1\d\d حدث محمّل/).waitFor();
  const olderAuditResponse=await principal.page.evaluate(async token => {
    const response=await fetch('/api/owner-files/owner/audit?offset=100', {
      headers:{Authorization:'Bearer '+token}
    });
    return {status:response.status,rows:response.ok?(await response.json()).length:0};
  },principal.token);
  assert.equal(olderAuditResponse.status,200,'Owner audit offset must be available');
  assert.ok(olderAuditResponse.rows>0,'Audit second page must contain older events');
  console.log('STATUS: PASS - OWNER_FILES_REAL_BROWSER_DOWNLOAD_AND_REVOKE');
  console.log('EVIDENCE: Chromium saved FULL and PARTIAL files; bytes matched; revoked HTTP 403; foreign tenant HTTP 404');
} finally {
  if(browser) await browser.close();
  if(tenants.length) {
    // Keep cleanup strictly limited to randomly-namespaced CI records.
    await prisma.auditLog.deleteMany({where:{tenantId:{in:tenants},entityType:'OWNER_FILE_REQUEST'}});
    await prisma.ownerFileRequest.deleteMany({where:{tenantId:{in:tenants}}});
    await prisma.ownerFile.deleteMany({where:{tenantId:{in:tenants}}});
  }
  if(sessions.length) await prisma.session.deleteMany({where:{id:{in:sessions}}});
  if(users.length) await prisma.user.deleteMany({where:{id:{in:users}}});
  if(tenants.length) await prisma.tenant.deleteMany({where:{id:{in:tenants}}});
  await prisma.$disconnect();
}
