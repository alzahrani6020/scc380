import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { PassportModule } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { prisma } from '@scc/database';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { OwnerFilesController } from '../src/owner-files/owner-files.controller';

const url = process.env.DIRECT_URL || process.env.DATABASE_URL || '';
if (process.env.SCC380_TEST_DATABASE_ISOLATED !== 'YES' ||
    new URL(url).hostname !== '127.0.0.1' || new URL(url).pathname !== '/ownerfiles_ci') {
  throw new Error('HTTP JWT integration requires isolated localhost ownerfiles_ci');
}
const secret = 'isolated-scc380-ci-signing-key-not-production';
// tsx runtime does not emit Nest constructor design metadata automatically.
Reflect.defineMetadata('design:paramtypes', [ConfigService], JwtStrategy);
test('HTTP JWT+database sessions deny forged/foreign tenant, allow owner and audited file delivery', async () => {
  const uid = 'httpci_' + randomBytes(6).toString('hex');
  const tenants: string[] = [];
  const users: string[] = [];
  const sessions: string[] = [];
  const previous = process.env.SCC380_ACTIVITY_OWNER_EMAIL;
  let app: any;
  try {
    const a = await prisma.tenant.create({ data: { name: uid+'a', slug: uid+'a' } });
    const b = await prisma.tenant.create({ data: { name: uid+'b', slug: uid+'b' } });
    tenants.push(a.id,b.id);
    const user = async (suffix:string, tenantId:string) => {
      const u = await prisma.user.create({ data: { email: uid + suffix + '@example.test',
        firstName:'CI',lastName:'HTTP',role:'ADMIN',status:'ACTIVE', tenantId } });
      users.push(u.id);
      const sid = uid + suffix + '_sid';
      await prisma.session.create({ data: { id: sid, tenantId, userId: u.id,
        token: uid + suffix + '_unique-hash',expiresAt: new Date(Date.now() + 3600000) } });
      sessions.push(sid);
      return { ...u, sid };
    };
    const owner = await user('owner',a.id);
    const alice = await user('alice',a.id);
    const bob = await user('bob',b.id);
    process.env.SCC380_ACTIVITY_OWNER_EMAIL = owner.email;
    const config = { get: (key:string) => key === 'JWT_SECRET' ? secret : undefined };
    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [OwnerFilesController],
      providers: [JwtStrategy,{ provide: ConfigService, useValue:config }],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0,'127.0.0.1');
    const port = app.getHttpServer().address().port;
    const root = 'http://127.0.0.1:'+port;
    const jwt = new JwtService({secret});
    const token = (u:any, sid?:string) => jwt.sign({ sub:u.id, email:u.email, role:u.role,
      tenantId:u.tenantId, type:'access', sid: sid || u.sid },{expiresIn:'10m'});
    const send = (path:string, t:string, method='GET', body?:unknown) =>
      fetch(root+path,{method,headers:{Authorization:'Bearer '+t,
        ...(body ? {'Content-Type':'application/json'} : {})},body:body ? JSON.stringify(body):undefined});
    const aToken = token(alice);
    const bToken = token(bob);
    const ownerToken = token(owner);
    const invalidSid = token(alice, uid+'_nonexistent');
    assert.equal((await send('/owner-files',invalidSid)).status,401);
    assert.equal((await send('/owner-files','bad-jwt')).status,401);
    const uploaded = await send('/owner-files',aToken,'POST',{title:'HTTP text', fileName:'http.txt',
      mimeType:'text/plain',contentBase64:Buffer.from('alpha\nbeta\ngamma').toString('base64')});
    assert.equal(uploaded.status,201);
    const file = await uploaded.json() as {id:string};
    assert.ok(file.id);
    const filesB = await send('/owner-files',bToken);
    assert.equal(filesB.status,200);
    assert.equal(((await filesB.json()) as Array<{id:string}>).some(x=>x.id===file.id),false);
    assert.equal((await send('/owner-files/requests',bToken,'POST',{fileId:file.id,scope:'FULL'})).status,404);
    const request = await send('/owner-files/requests',aToken,'POST',{fileId:file.id,scope:'FULL'});
    assert.equal(request.status,201);
    const approval = await request.json() as {id:string};
    assert.equal((await send('/owner-files/requests/'+approval.id+'/download',aToken)).status,403);
    assert.equal((await send('/owner-files/owner/requests',bToken)).status,403);
    assert.equal((await send('/owner-files/owner/decide',aToken,'POST',{
      requestId:approval.id,decision:'APPROVE'})).status,403);
    assert.equal((await send('/owner-files/owner/decide',ownerToken,'POST',{
      requestId:approval.id,decision:'APPROVE'})).status,201);
    const delivered = await send('/owner-files/requests/'+approval.id+'/download',aToken);
    assert.equal(delivered.status,200);
    assert.equal(await delivered.text(), ['alpha','beta','gamma'].join(String.fromCharCode(10)));
    assert.equal((await send('/owner-files/requests/'+approval.id+'/download',bToken)).status,404);
    assert.equal((await send('/owner-files/owner/decide',ownerToken,'POST',{
      requestId:approval.id,decision:'REVOKE'})).status,201);
    assert.equal((await send('/owner-files/requests/'+approval.id+'/download',aToken)).status,403);
  } finally {
    if(app) await app.close();
    process.env.SCC380_ACTIVITY_OWNER_EMAIL=previous;
    if(tenants.length) {
      await prisma.auditLog.deleteMany({where:{tenantId:{in:tenants},entityType:'OWNER_FILE_REQUEST'}});
      await prisma.ownerFileRequest.deleteMany({where:{tenantId:{in:tenants}}});
      await prisma.ownerFile.deleteMany({where:{tenantId:{in:tenants}}});
    }
    if(sessions.length) await prisma.session.deleteMany({where:{id:{in:sessions}}});
    if(users.length) await prisma.user.deleteMany({where:{id:{in:users}}});
    if(tenants.length) await prisma.tenant.deleteMany({where:{id:{in:tenants}}});
    await prisma.$disconnect();
  }
});
