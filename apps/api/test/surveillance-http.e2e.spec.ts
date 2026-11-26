import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { Test } from '@nestjs/testing';
import { PassportModule } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { prisma } from '@scc/database';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { SurveillanceController } from '../src/surveillance/surveillance.controller';

const uri = new URL(process.env.DATABASE_URL || 'postgresql://invalid:invalid@localhost/invalid');
if (process.env.SCC380_TEST_DATABASE_ISOLATED !== 'YES' ||
    !['localhost','127.0.0.1'].includes(uri.hostname) ||
    uri.pathname !== '/surveillance_ci') {
  throw new Error('Refusing surveillance HTTP E2E outside isolated localhost /surveillance_ci');
}
const secret = 'isolated-surveillance-http-ci-secret';
Reflect.defineMetadata('design:paramtypes', [ConfigService], JwtStrategy);

test('HTTP JWT and tenant boundaries for sites, cameras and maintenance', async () => {
  const key = randomBytes(8).toString('hex');
  const tenantIds: string[] = [];
  const userIds: string[] = [];
  const sessionIds: string[] = [];
  let app: any;
  try {
    const a = await prisma.tenant.create({ data: {name:key+'A',slug:key+'a'} });
    const b = await prisma.tenant.create({ data: {name:key+'B',slug:key+'b'} });
    tenantIds.push(a.id,b.id);
    const createUser = async (suffix:string,tenantId:string,role:'ADMIN'|'USER'='ADMIN') => {
      const u = await prisma.user.create({
        data:{email:key+suffix+'@example.test',firstName:'CI',lastName:'Surveillance',
          role,status:'ACTIVE',tenantId},
      });
      userIds.push(u.id);
      const sid=key+suffix+'sid';
      await prisma.session.create({data:{id:sid,tenantId,userId:u.id,
        token:key+suffix+'refresh',expiresAt:new Date(Date.now()+3600000)}});
      sessionIds.push(sid);
      return {u,sid};
    };
    const alice = await createUser('alice',a.id);
    const bob = await createUser('bob',b.id);
    const viewer = await createUser('viewer',a.id,'USER');
    const moduleRef = await Test.createTestingModule({
      imports:[PassportModule],
      controllers:[SurveillanceController],
      providers:[JwtStrategy,{provide:ConfigService,useValue:{get:(k:string)=>k==='JWT_SECRET'?secret:undefined}}],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));
    await app.listen(0,'127.0.0.1');
    const origin='http://127.0.0.1:'+app.getHttpServer().address().port;
    const jwt=new JwtService({secret});
    const token=(u:typeof alice)=>jwt.sign({
      type:'access',sid:u.sid,sub:u.u.id,tenantId:u.u.tenantId,role:u.u.role,email:u.u.email,
    },{expiresIn:'10m'});
    const send=(path:string,authorization:string,method='GET',body?:unknown)=>fetch(origin+path,{
      method,
      headers:{Authorization:'Bearer '+authorization,...(body?{'Content-Type':'application/json'}:{})},
      body:body?JSON.stringify(body):undefined,
    });
    const aliceToken=token(alice),bobToken=token(bob),viewerToken=token(viewer);
    assert.equal((await send('/surveillance/sites','invalid-token')).status,401);
    assert.equal((await send('/surveillance/sites',viewerToken)).status,403);
    assert.equal((await send('/surveillance/sites',aliceToken,'POST',{name:'X',tenantId:b.id})).status,400);
    const siteResponse=await send('/surveillance/sites',aliceToken,'POST',{name:'A warehouse'});
    assert.equal(siteResponse.status,201,await siteResponse.text());
    // Fetch body from a fresh read: a response body cannot be consumed twice.
    const siteList=await send('/surveillance/sites',aliceToken);
    assert.equal(siteList.status,200);
    const sites=await siteList.json() as {id:string}[];
    assert.equal(sites.length,1);
    const siteId=sites[0].id;
    const bobSites=await (await send('/surveillance/sites',bobToken)).json() as {id:string}[];
    assert.equal(bobSites.some(s=>s.id===siteId),false);
    assert.equal((await send('/surveillance/cameras',bobToken,'POST',
      {siteId,name:'cross-tenant'})).status,404);
    const camResponse=await send('/surveillance/cameras',aliceToken,'POST',
      {siteId,name:'Entry Camera',supportsAudio:true,supportsTalk:true,supportsPtz:true});
    assert.equal(camResponse.status,201);
    const cam=await camResponse.json() as {id:string;connectionStatus:string};
    assert.equal(cam.connectionStatus,'UNCONFIGURED');
    const persistedCameraList=await (await send('/surveillance/cameras',aliceToken)).json()
      as Array<{id:string;name:string;siteId:string}>;
    assert.ok(persistedCameraList.some(c=>c.id===cam.id&&c.name==='Entry Camera'&&c.siteId===siteId));
    assert.equal((await send('/surveillance/maintenance',bobToken,'POST',
      {cameraId:cam.id,taskType:'CLEANING'})).status,404);
    const taskResponse=await send('/surveillance/maintenance',aliceToken,'POST',
      {cameraId:cam.id,taskType:'CLEANING'});
    assert.equal(taskResponse.status,201);
    const task=await taskResponse.json() as {id:string};
    assert.equal((await send('/surveillance/maintenance/'+task.id,bobToken,'PATCH',
      {status:'COMPLETED'})).status,404);
    assert.equal((await send('/surveillance/maintenance/'+task.id,aliceToken,'PATCH',
      {status:'COMPLETED'})).status,200);
    assert.equal((await send('/surveillance/maintenance/'+task.id,aliceToken,'PATCH',
      {status:'IN_PROGRESS'})).status,400);
    const persistedTasks=await (await send('/surveillance/maintenance',aliceToken)).json()
      as Array<{id:string;status:string}>;
    assert.ok(persistedTasks.some(t=>t.id===task.id&&t.status==='COMPLETED'));
    const foreignTasks=await (await send('/surveillance/maintenance',bobToken)).json() as unknown[];
    assert.equal(foreignTasks.length,0);
    assert.equal((await send('/surveillance/incidents',bobToken,'POST',
      {cameraId:cam.id,title:'Forged incident',severity:'HIGH'})).status,404);
    const incidentResponse=await send('/surveillance/incidents',aliceToken,'POST',
      {cameraId:cam.id,title:'Loading bay issue',severity:'HIGH'});
    assert.equal(incidentResponse.status,201);
    const incident=await incidentResponse.json() as {id:string};
    assert.equal((await send('/surveillance/incidents/'+incident.id,bobToken,'PATCH',
      {status:'RESOLVED',resolution:'Forged'})).status,404);
    assert.equal((await send('/surveillance/incidents/'+incident.id,aliceToken,'PATCH',
      {status:'RESOLVED'})).status,400);
    assert.equal((await send('/surveillance/incidents/'+incident.id,aliceToken,'PATCH',
      {status:'ACKNOWLEDGED'})).status,200);
    assert.equal((await send('/surveillance/incidents/'+incident.id,aliceToken,'PATCH',
      {status:'RESOLVED',resolution:'Resolved by security team'})).status,200);
    assert.equal((await send('/surveillance/incidents/'+incident.id,aliceToken,'PATCH',
      {status:'ACKNOWLEDGED'})).status,404);
    const persistedIncidents=await (await send('/surveillance/incidents',aliceToken)).json()
      as Array<{id:string;status:string;resolution:string}>;
    assert.ok(persistedIncidents.some(i=>i.id===incident.id&&i.status==='RESOLVED'&&
      i.resolution==='Resolved by security team'));
    const bobIncidents=await (await send('/surveillance/incidents',bobToken)).json() as unknown[];
    assert.equal(bobIncidents.length,0);
  } finally {
    if(app) await app.close();
    if(tenantIds.length) {
      await prisma.surveillanceIncident.deleteMany({where:{tenantId:{in:tenantIds}}});
      await prisma.surveillanceMaintenance.deleteMany({where:{tenantId:{in:tenantIds}}});
      await prisma.surveillanceCamera.deleteMany({where:{tenantId:{in:tenantIds}}});
      await prisma.surveillanceSite.deleteMany({where:{tenantId:{in:tenantIds}}});
    }
    if(sessionIds.length) await prisma.session.deleteMany({where:{id:{in:sessionIds}}});
    if(userIds.length) await prisma.user.deleteMany({where:{id:{in:userIds}}});
    if(tenantIds.length) await prisma.tenant.deleteMany({where:{id:{in:tenantIds}}});
    await prisma.$disconnect();
  }
});
