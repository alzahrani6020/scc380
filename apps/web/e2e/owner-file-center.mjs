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
  await checkPage(applicant.page,'/downloads/files','مركز ملفات الشركة');
  await checkPage(principal.page,'/owner/files','مركز ملفات المالك — مراجعة الطلبات');
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
  const foreignResponse=await foreign.page.evaluate(async ({id,token}) => {
    const response=await fetch('/api/owner-files/requests/'+id+'/download',{
      headers:{Authorization:'Bearer '+token}});
    return response.status;
  },{id:full.id,token:foreign.token});
  assert.equal(foreignResponse,404,'Foreign tenant download must not disclose request');
  await principal.page.getByRole('button',{name:'تحديث'}).click();
  await principal.page.getByRole('button',{name:'موافقة'}).first().click();
  await principal.page.getByText(/APPROVED/).first().waitFor();
  await page.getByRole('button',{name:'تحديث الطلبات'}).click();
  await downloadAndVerify(page,'alpha\nbeta\ngamma',full.id);
  await principal.page.getByRole('button',{name:'إلغاء السماح'}).first().click();
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
  await principal.page.getByRole('button',{name:'تحديث'}).click();
  await principal.page.getByRole('button',{name:'موافقة'}).first().click();
  await principal.page.getByText(/APPROVED/).first().waitFor();
  await page.getByRole('button',{name:'تحديث الطلبات'}).click();
  await downloadAndVerify(page,'beta',partial.id);
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
