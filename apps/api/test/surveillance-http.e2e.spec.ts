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
import { SurveillanceGatewayController } from '../src/surveillance/surveillance-gateway.controller';
import { SurveillanceDeviceCommandsController } from '../src/surveillance/surveillance-device-commands.controller';

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
  const vehicleIds: string[] = [];
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
    // Test fixture uses the stable baseline vehicles columns. The broader fleet
    // Prisma model includes legacy columns not fully reconciled in isolated migrations;
    // do not change unrelated production fleet schema just to construct this fixture.
    const aliceVehicle={id:key+'vehicleA'};
    const bobVehicle={id:key+'vehicleB'};
    await prisma.$executeRaw`INSERT INTO "vehicles"
      ("id","tenantId","plateNumber","make","model","createdAt","updatedAt")
      VALUES (${aliceVehicle.id},${a.id},${key+'A1'},'Test','Truck',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`;
    await prisma.$executeRaw`INSERT INTO "vehicles"
      ("id","tenantId","plateNumber","make","model","createdAt","updatedAt")
      VALUES (${bobVehicle.id},${b.id},${key+'B1'},'Test','Van',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`;
    vehicleIds.push(aliceVehicle.id,bobVehicle.id);
    const alice = await createUser('alice',a.id);
    const bob = await createUser('bob',b.id);
    const viewer = await createUser('viewer',a.id,'USER');
    const moduleRef = await Test.createTestingModule({
      imports:[PassportModule],
      controllers:[SurveillanceController,SurveillanceGatewayController,SurveillanceDeviceCommandsController],
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
    const fleet=await (await send('/surveillance/vehicles',aliceToken)).json() as Array<{id:string}>;
    assert.ok(fleet.some(v=>v.id===aliceVehicle.id));
    assert.equal(fleet.some(v=>v.id===bobVehicle.id),false);
    assert.equal((await send('/surveillance/vehicles',viewerToken)).status,403);
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

    // The paginated fleet must remain scoped to the signed-in company on every page.
    const ownFleetRes=await send('/surveillance/fleet?page=1&size=1',aliceToken);
    assert.equal(ownFleetRes.status,200);
    const ownFleet=await ownFleetRes.json() as {total:number;page:number;cameras:Array<{id:string}>};
    assert.equal(ownFleet.total,1);
    assert.equal(ownFleet.page,1);
    assert.deepEqual(ownFleet.cameras.map(c=>c.id),[cam.id]);
    const otherFleet=await (await send('/surveillance/fleet?page=1&size=50',bobToken)).json() as
      {total:number;cameras:Array<{id:string}>};
    assert.equal(otherFleet.total,0);
    assert.equal(otherFleet.cameras.some(c=>c.id===cam.id),false);
    assert.equal((await send('/surveillance/fleet?page=0',aliceToken)).status,400);
    assert.equal((await send('/surveillance/fleet?size=101',aliceToken)).status,400);
    assert.equal((await send('/surveillance/fleet?tenantId='+b.id,aliceToken)).status,400);
    assert.equal((await send('/surveillance/fleet',viewerToken)).status,403);

    // Existing company vehicles can be linked to dashcams; other company IDs cannot.
    assert.equal((await send('/surveillance/cameras',aliceToken,'POST',{
      siteId,name:'Forged Fleet Cam',cameraType:'DASHCAM_FRONT',vehicleId:bobVehicle.id
    })).status,404);
    assert.equal((await send('/surveillance/cameras',aliceToken,'POST',{
      siteId,name:'Invalid PTZ dashcam',cameraType:'DASHCAM_FRONT',supportsPtz:true
    })).status,400);
    assert.equal((await send('/surveillance/cameras',aliceToken,'POST',{
      siteId,name:'Unknown type',cameraType:'UNKNOWN',
    })).status,400);
    const dashResponse=await send('/surveillance/cameras',aliceToken,'POST',{
      siteId,name:'Vehicle front',cameraType:'DASHCAM_FRONT',
      connectorType:'DASHCAM_RTSP',vehicleId:aliceVehicle.id,supportsAudio:true,
    });
    assert.equal(dashResponse.status,201,await dashResponse.clone().text());
    const dashcam=await dashResponse.json() as {id:string;cameraType:string;vehicleId:string};
    assert.equal(dashcam.vehicleId,aliceVehicle.id);
    assert.equal(dashcam.cameraType,'DASHCAM_FRONT');
    const fleetFirst=await (await send('/surveillance/fleet?page=1&size=1',aliceToken)).json() as
      {total:number;totalPages:number;cameras:Array<{id:string}>};
    const fleetSecond=await (await send('/surveillance/fleet?page=2&size=1',aliceToken)).json() as
      {total:number;cameras:Array<{id:string}>};
    assert.equal(fleetFirst.total,2);
    assert.equal(fleetFirst.totalPages,2);
    assert.equal(fleetSecond.total,2);
    assert.equal(fleetFirst.cameras.length,1);
    assert.equal(fleetSecond.cameras.length,1);
    assert.notEqual(fleetFirst.cameras[0].id,fleetSecond.cameras[0].id);
    const fleetBySite=await (await send('/surveillance/fleet?page=1&siteId='+siteId,aliceToken)).json() as
      {total:number};
    assert.equal(fleetBySite.total,2);
    assert.equal(((await (await send('/surveillance/fleet?search=Vehicle',aliceToken)).json()) as
      {total:number}).total,1);

    // Regression: the old inventory capped results at 200. Exercise 205 extra cameras
    // in isolated localhost Postgres, with no production records or memberships touched.
    const bulkCount=205;
    await prisma.surveillanceCamera.createMany({data:Array.from({length:bulkCount},(_,i)=>({
      tenantId:a.id,siteId,name:'Bulk Camera '+String(i).padStart(3,'0'),
      connectionStatus:'UNCONFIGURED' as const,
    }))});
    const allIds=new Set<string>();
    const expectedTotal=bulkCount+2;
    for(let p=1;p<=Math.ceil(expectedTotal/50);p++){
      const response=await send('/surveillance/fleet?page='+p+'&size=50',aliceToken);
      assert.equal(response.status,200);
      const data=await response.json() as
        {total:number;totalPages:number;page:number;cameras:Array<{id:string}>};
      assert.equal(data.total,expectedTotal);
      assert.equal(data.totalPages,5);
      assert.equal(data.page,p);
      assert.equal(data.cameras.length,p===5?7:50);
      for(const camera of data.cameras){
        assert.equal(allIds.has(camera.id),false,'Camera repeated across pages');
        allIds.add(camera.id);
      }
    }
    assert.equal(allIds.size,expectedTotal);
    const beyondEnd=await (await send('/surveillance/fleet?page=6&size=50',aliceToken)).json() as
      {total:number;cameras:Array<{id:string}>};
    assert.equal(beyondEnd.total,expectedTotal);
    assert.equal(beyondEnd.cameras.length,0);
    const foreignLarge=await (await send('/surveillance/fleet?page=5&size=50',bobToken)).json() as
      {total:number;cameras:Array<{id:string}>};
    assert.equal(foreignLarge.total,0);
    assert.deepEqual(foreignLarge.cameras,[]);
    const bulkSearch=await (await send('/surveillance/fleet?search=Bulk%20Camera&size=100',aliceToken)).json() as
      {total:number;cameras:Array<{id:string}>};
    assert.equal(bulkSearch.total,bulkCount);
    assert.equal(bulkSearch.cameras.length,100);



    assert.equal((await send('/surveillance/gateways',bobToken,'POST',
      {siteId,name:'Other tenant unauthorized'})).status,404);
    assert.equal((await send('/surveillance/gateways',viewerToken,'POST',
      {siteId,name:'Forbidden role'})).status,403);
    const gatewayResponse=await send('/surveillance/gateways',aliceToken,'POST',
      {siteId,name:'Local edge'});
    assert.equal(gatewayResponse.status,201);
    const gateway=await gatewayResponse.json() as {id:string;enrollmentToken:string};
    assert.match(gateway.enrollmentToken,/^sccg_[A-Za-z0-9_-]{43}$/);
    assert.equal((await send('/surveillance/gateways',bobToken)).status,200);
    assert.equal(((await (await send('/surveillance/gateways',bobToken)).json()) as Array<{id:string}>)
      .some(g=>g.id===gateway.id),false);
    const localGatewayList=await (await send('/surveillance/gateways',aliceToken)).json() as Array<{id:string;enrollmentToken?:string;tokenHash?:string}>;
    assert.equal(localGatewayList[0].id,gateway.id);
    assert.equal(localGatewayList[0].enrollmentToken,undefined);
    assert.equal(localGatewayList[0].tokenHash,undefined);
    const edgeSend=(edgeToken:string,body:unknown)=>send('/surveillance/gateways/heartbeat',edgeToken,'POST',body);
    const forged=await edgeSend('sccg_'+'A'.repeat(43),{cameras:[{cameraId:cam.id,status:'ONLINE'}]});
    assert.equal(forged.status,403);
    assert.equal((await edgeSend(gateway.enrollmentToken,
      {cameras:[{cameraId:cam.id,status:'ONLINE',tenantId:b.id}]})).status,400);
    assert.equal((await edgeSend(gateway.enrollmentToken,
      {cameras:[{cameraId:cam.id,status:'ONLINE'}]})).status,201);
    // A queued intent is never proof of physical device movement.
    assert.equal((await send('/surveillance/device-commands',viewerToken,'POST',
      {cameraId:cam.id,action:'PTZ_LEFT'})).status,403);
    assert.equal((await send('/surveillance/device-commands',bobToken,'POST',
      {cameraId:cam.id,action:'PTZ_LEFT'})).status,404);
    assert.equal((await send('/surveillance/device-commands',aliceToken,'POST',
      {cameraId:cam.id,action:'PTZ_LEFT',tenantId:b.id})).status,400);
    const commandResponse=await send('/surveillance/device-commands',aliceToken,'POST',
      {cameraId:cam.id,action:'PTZ_LEFT'});
    assert.equal(commandResponse.status,201,await commandResponse.clone().text());
    const command=await commandResponse.json() as {id:string;status:string;deviceExecuted:boolean};
    assert.equal(command.status,'QUEUED');
    assert.equal(command.deviceExecuted,false);
    const edgePending=await (await send('/surveillance/device-commands/pending',
      gateway.enrollmentToken)).json() as {commands:Array<{id:string}>;executionEnabled:boolean};
    assert.equal(edgePending.executionEnabled,false);
    assert.equal(edgePending.commands.some(c=>c.id===command.id),true);
    const otherPending=await (await send('/surveillance/device-commands/pending',
      'sccg_'+'X'.repeat(43)));
    assert.equal(otherPending.status,403);
    assert.equal((await send('/surveillance/device-commands/'+command.id+'/reject',
      gateway.enrollmentToken,'POST',{resultCode:'UNSUPPORTED'})).status,201);
    const history=await (await send('/surveillance/device-commands',aliceToken)).json() as
      Array<{id:string;status:string;resultCode:string}>;
    assert.ok(history.some(x=>x.id===command.id&&x.status==='REJECTED'&&x.resultCode==='UNSUPPORTED'));
    const hiddenHistory=await (await send('/surveillance/device-commands',bobToken)).json() as unknown[];
    assert.equal(hiddenHistory.length,0);
    assert.equal((await send('/surveillance/device-commands/'+command.id+'/reject',
      gateway.enrollmentToken,'POST',{resultCode:'FAILED'})).status,404);
    // Physical pilot gate: default off, atomic claim and one-use completion lease.
    const physicalCommand=await (await send('/surveillance/device-commands',aliceToken,'POST',
      {cameraId:cam.id,action:'PTZ_STOP'})).json() as {id:string};
    assert.equal((await send('/surveillance/device-commands/'+physicalCommand.id+'/claim',
      gateway.enrollmentToken,'POST')).status,403);
    const previousPilot=process.env.SCC_SURVEILLANCE_PTZ_PILOT_ENABLED;
    try {
      process.env.SCC_SURVEILLANCE_PTZ_PILOT_ENABLED='YES';
      assert.equal((await send('/surveillance/device-commands/'+physicalCommand.id+'/claim',
        'sccg_'+'Z'.repeat(43),'POST')).status,403);
      const claimResponse=await send('/surveillance/device-commands/'+physicalCommand.id+'/claim',
        gateway.enrollmentToken,'POST');
      assert.equal(claimResponse.status,201,await claimResponse.clone().text());
      const lease=await claimResponse.json() as {leaseToken:string;deviceExecuted:boolean};
      assert.equal(lease.deviceExecuted,false);
      assert.equal((await send('/surveillance/device-commands/'+physicalCommand.id+'/claim',
        gateway.enrollmentToken,'POST')).status,404);
      assert.equal((await send('/surveillance/device-commands/'+physicalCommand.id+'/complete',
        gateway.enrollmentToken,'POST',{leaseToken:'a'.repeat(43),resultCode:'SOAP_ACKNOWLEDGED'})).status,404);
      const completed=await send('/surveillance/device-commands/'+physicalCommand.id+'/complete',
        gateway.enrollmentToken,'POST',{leaseToken:lease.leaseToken,resultCode:'SOAP_ACKNOWLEDGED'});
      assert.equal(completed.status,201);
      assert.equal(((await completed.json()) as {deviceMovementVerified:boolean}).deviceMovementVerified,false);
      assert.equal((await send('/surveillance/device-commands/'+physicalCommand.id+'/complete',
        gateway.enrollmentToken,'POST',{leaseToken:lease.leaseToken,resultCode:'FAILED'})).status,404);
    } finally {
      if(previousPilot===undefined) delete process.env.SCC_SURVEILLANCE_PTZ_PILOT_ENABLED;
      else process.env.SCC_SURVEILLANCE_PTZ_PILOT_ENABLED=previousPilot;
    }
    // Cross-tenant/site authenticated gateway checks also apply to mobile GPS reports.
    assert.equal((await edgeSend(gateway.enrollmentToken,{cameras:[{
      cameraId:cam.id,status:'ONLINE',latitude:21.5,longitude:39.2
    }]})).status,400); // Fixed cameras cannot submit GPS.
    assert.equal((await edgeSend(gateway.enrollmentToken,{cameras:[{
      cameraId:dashcam.id,status:'ONLINE',latitude:21.5
    }]})).status,400); // Both coordinates required.
    assert.equal((await edgeSend(gateway.enrollmentToken,{cameras:[{
      cameraId:dashcam.id,status:'ONLINE',latitude:91,longitude:39.2
    }]})).status,400);
    assert.equal((await edgeSend(gateway.enrollmentToken,{cameras:[{
      cameraId:dashcam.id,status:'ONLINE',latitude:21.54321,longitude:39.19876
    }]})).status,201);
    const enrolledDashcam=await (await send('/surveillance/cameras',aliceToken)).json() as
      Array<{id:string;cameraType:string;vehicleId:string;lastLatitude:string;lastLongitude:string;lastTelemetryAt:string}>;
    assert.ok(enrolledDashcam.some(c=>c.id===dashcam.id&&c.cameraType==='DASHCAM_FRONT'&&
      c.vehicleId===aliceVehicle.id&&Number(c.lastLatitude)===21.54321&&
      Number(c.lastLongitude)===39.19876&&!!c.lastTelemetryAt));
    const otherDashcamList=await (await send('/surveillance/cameras',bobToken)).json() as Array<{id:string}>;
    assert.equal(otherDashcamList.some(c=>c.id===dashcam.id),false);
    const observed=await (await send('/surveillance/cameras',aliceToken)).json() as Array<{id:string;connectionStatus:string;lastSeenAt:string}>;
    assert.ok(observed.some(c=>c.id===cam.id&&c.connectionStatus==='ONLINE'&&!!c.lastSeenAt));
    const freshCamera=await (await send('/surveillance/cameras',aliceToken)).json() as Array<{id:string;effectiveConnectionStatus:string}>;
    assert.equal(freshCamera.find(c=>c.id===cam.id)?.effectiveConnectionStatus,'ONLINE');
    const freshGateway=await (await send('/surveillance/gateways',aliceToken)).json() as Array<{id:string;connectionState:string}>;
    assert.equal(freshGateway.find(g=>g.id===gateway.id)?.connectionState,'CONNECTED');
    // Simulate a real branch network outage: no heartbeat arrives for over two minutes.
    const staleTime=new Date(Date.now()-180_000);
    await prisma.surveillanceCamera.update({where:{id:cam.id},data:{lastSeenAt:staleTime}});
    await prisma.surveillanceGateway.update({where:{id:gateway.id},data:{lastSeenAt:staleTime}});
    const staleCamera=await (await send('/surveillance/cameras',aliceToken)).json() as Array<{id:string;connectionStatus:string;effectiveConnectionStatus:string}>;
    assert.equal(staleCamera.find(c=>c.id===cam.id)?.connectionStatus,'ONLINE');
    assert.equal(staleCamera.find(c=>c.id===cam.id)?.effectiveConnectionStatus,'STALE');
    const staleGateway=await (await send('/surveillance/gateways',aliceToken)).json() as Array<{id:string;connectionState:string}>;
    assert.equal(staleGateway.find(g=>g.id===gateway.id)?.connectionState,'STALE');
    assert.equal((await send('/surveillance/gateways/'+gateway.id+'/revoke',bobToken,'POST')).status,404);
    assert.equal((await send('/surveillance/gateways/'+gateway.id+'/revoke',aliceToken,'POST')).status,201);
    assert.equal((await edgeSend(gateway.enrollmentToken,
      {cameras:[{cameraId:cam.id,status:'OFFLINE'}]})).status,403);
    const persistedCameraList=await (await send('/surveillance/cameras',aliceToken)).json() as Array<{id:string;name:string;siteId:string}>;
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
    const persistedTasks=await (await send('/surveillance/maintenance',aliceToken)).json() as Array<{id:string;status:string}>;
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
    const persistedIncidents=await (await send('/surveillance/incidents',aliceToken)).json() as Array<{id:string;status:string;resolution:string}>;
    assert.ok(persistedIncidents.some(i=>i.id===incident.id&&i.status==='RESOLVED'&&
      i.resolution==='Resolved by security team'));
    const bobIncidents=await (await send('/surveillance/incidents',bobToken)).json() as unknown[];
    assert.equal(bobIncidents.length,0);
  } finally {
    if(app) await app.close();
    if(tenantIds.length) {
      await prisma.surveillanceDeviceCommand.deleteMany({where:{tenantId:{in:tenantIds}}});
      await prisma.surveillanceGateway.deleteMany({where:{tenantId:{in:tenantIds}}});
      await prisma.surveillanceIncident.deleteMany({where:{tenantId:{in:tenantIds}}});
      await prisma.surveillanceMaintenance.deleteMany({where:{tenantId:{in:tenantIds}}});
      await prisma.surveillanceCamera.deleteMany({where:{tenantId:{in:tenantIds}}});
      await prisma.surveillanceSite.deleteMany({where:{tenantId:{in:tenantIds}}});
      await prisma.vehicle.deleteMany({where:{id:{in:vehicleIds}}});
    }
    if(sessionIds.length) await prisma.session.deleteMany({where:{id:{in:sessionIds}}});
    if(userIds.length) await prisma.user.deleteMany({where:{id:{in:userIds}}});
    if(tenantIds.length) await prisma.tenant.deleteMany({where:{id:{in:tenantIds}}});
    await prisma.$disconnect();
  }
});
