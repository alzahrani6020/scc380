import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@scc/database';
import { OwnerFilesController } from '../src/owner-files/owner-files.controller';

const conn = process.env.DIRECT_URL || process.env.DATABASE_URL || '';
if (process.env.SCC380_TEST_DATABASE_ISOLATED !== 'YES' ||
    !/^(postgresql|postgres):\/\//.test(conn) ||
    !/localhost|127\.0\.0\.1/.test(new URL(conn).hostname) ||
    new URL(conn).pathname !== '/ownerfiles_ci') {
  throw new Error('Refusing DB test outside isolated localhost ownerfiles_ci');
}
const id = 'fileci_' + process.pid + '_' + Date.now();
const ownerEmail = id + '_owner@example.test';
const adminAEmail = id + '_a@example.test';
const adminBEmail = id + '_b@example.test';

test('PostgreSQL file center: two tenants, audited approval, partial/full, cross-tenant refusal', async () => {
  const controller = new OwnerFilesController();
  const tenants: string[] = [];
  const users: string[] = [];
  const makeReq = (user: any) => ({ user });
  const tenant = async (suffix: string) => {
    const t = await prisma.tenant.create({ data: { name: id + suffix, slug: id + suffix } });
    tenants.push(t.id); return t;
  };
  const createUser = async (email: string, tenantId: string) => {
    const u = await prisma.user.create({ data: { email, firstName: 'CI', lastName: 'Test', role: 'ADMIN',
      tenantId, emailVerified: true, status: 'ACTIVE' } });
    users.push(u.id);
    return { userId: u.id, tenantId, email, role: 'ADMIN', sessionId: 'isolated-fixture-not-real-session' };
  };
  const previous = process.env.SCC380_ACTIVITY_OWNER_EMAIL;
  try {
    const a = await tenant('a');
    const b = await tenant('b');
    const owner = await createUser(ownerEmail, a.id);
    const alice = await createUser(adminAEmail, a.id);
    const bob = await createUser(adminBEmail, b.id);
    process.env.SCC380_ACTIVITY_OWNER_EMAIL = ownerEmail;
    const file = await controller.upload(makeReq(alice), {
      title: 'CI file', fileName: 'ci.txt', mimeType: 'text/plain',
      contentBase64: Buffer.from('one\ntwo\nthree\nfour').toString('base64'),
    });
    assert.ok(file.id);
    const listA = await controller.list(makeReq(alice));
    const listB = await controller.list(makeReq(bob));
    assert.equal(listA.some(x => x.id === file.id), true);
    assert.equal(listB.some(x => x.id === file.id), false);
    await assert.rejects(controller.request(makeReq(bob), { fileId: file.id, scope: 'FULL' }), /File not found/);
    await assert.rejects(controller.request(makeReq(alice), {
      fileId: file.id, scope: 'PARTIAL', startLine: 2, endLine: 800,
    }), /Partial delivery/);
    const full = await controller.request(makeReq(alice), { fileId: file.id, scope: 'FULL' });
    const partial = await controller.request(makeReq(alice), { fileId: file.id,
      scope: 'PARTIAL', startLine: 2, endLine: 3 });
    assert.equal(full.status, 'PENDING');
    await assert.rejects(controller.decide(makeReq(alice), { requestId: full.id, decision: 'APPROVE' }), /Owner authorization/);
    await assert.rejects(controller.decide(makeReq(owner), { requestId: full.id, decision: 'INVALID' as any }), /Invalid/);
    const approved = await controller.decide(makeReq(owner), { requestId: full.id, decision: 'APPROVE' });
    assert.equal(approved.status, 'APPROVED');
    await assert.rejects(controller.decide(makeReq(owner), { requestId: full.id, decision: 'APPROVE' }), /Invalid or duplicate decision/);
    const rejected = await controller.decide(makeReq(owner), { requestId: partial.id, decision: 'REJECT' });
    assert.equal(rejected.status, 'REJECTED');
    const mine = await controller.mine(makeReq(alice));
    assert.equal(mine.some(x => x.id === full.id && x.status === 'APPROVED'), true);
    const queue = await controller.queue(makeReq(owner));
    assert.equal(queue.some(x => x.id === partial.id), true);
    await assert.rejects(controller.queue(makeReq(bob)), /Owner authorization/);
    const revoked = await controller.decide(makeReq(owner), { requestId: full.id, decision: 'REVOKE' });
    assert.equal(revoked.status, 'REVOKED');
    const audited = await prisma.auditLog.findMany({ where: { entityType: 'OWNER_FILE_REQUEST', entityId: full.id } });
    assert.deepEqual(audited.filter(x => x.action.startsWith('OWNER_FILE_')).map(x => x.action).sort(),
      ['OWNER_FILE_APPROVED','OWNER_FILE_REVOKED']);
    // HTTP denial is tested through the production controller; no synthetic successful device-save assertion.
    const fakeRes = { setHeader() {}, end() {}, once() {}, writableFinished: false } as any;
    await assert.rejects(controller.download(makeReq(bob), full.id, undefined, fakeRes), /Download request not found/);
    await assert.rejects(controller.download(makeReq(alice), full.id, undefined, fakeRes), /rejected or revoked/);
    await assert.rejects(controller.download(makeReq(alice), partial.id, undefined, fakeRes), /rejected or revoked/);
  } finally {
    process.env.SCC380_ACTIVITY_OWNER_EMAIL = previous;
    if (tenants.length) {
      await prisma.auditLog.deleteMany({ where: { tenantId: { in: tenants }, entityType: 'OWNER_FILE_REQUEST' } });
      await prisma.ownerFileRequest.deleteMany({ where: { tenantId: { in: tenants } } });
      await prisma.ownerFile.deleteMany({ where: { tenantId: { in: tenants } } });
    }
    if (users.length) await prisma.user.deleteMany({ where: { id: { in: users } } });
    if (tenants.length) await prisma.tenant.deleteMany({ where: { id: { in: tenants } } });
    await prisma.$disconnect();
  }
});
