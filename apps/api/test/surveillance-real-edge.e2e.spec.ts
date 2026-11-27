import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { createServer as createRtspServer } from 'node:net';
import { createServer as createHttpsServer } from 'node:https';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
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

const db = new URL(process.env.DATABASE_URL || 'postgresql://invalid:invalid@localhost/invalid');
if (process.env.SCC380_TEST_DATABASE_ISOLATED !== 'YES' ||
    !['localhost','127.0.0.1'].includes(db.hostname) ||
    db.pathname !== '/surveillance_ci') {
  throw new Error('Never run real-edge acceptance outside isolated localhost /surveillance_ci');
}
const secret = 'isolated-surveillance-edge-ci-jwt-secret';
const invoke = promisify(execFile);
Reflect.defineMetadata('design:paramtypes', [ConfigService], JwtStrategy);

test('real outbound site agent: authenticated company session -> persist -> HTTPS RTSP report -> fresh session reload -> revoke', {timeout:90000}, async () => {
  const marker = randomBytes(8).toString('hex');
  const temp = await mkdtemp(join(tmpdir(), 'scc380-real-edge-'));
  let app: any;
  let httpsServer: ReturnType<typeof createHttpsServer> | undefined;
  let rtspServer: ReturnType<typeof createRtspServer> | undefined;
  let tenantId: string | undefined;
  let userId: string | undefined;
  let gatewayId: string | undefined;
  const sessionIds: string[] = [];
  const json = async (response: Response) => {
    const body = await response.text();
    assert.ok(response.ok, 'HTTP '+response.status+' '+body.slice(0,200));
    return JSON.parse(body);
  };
  try {
    const tenant = await prisma.tenant.create({data:{name:'CI simulated company '+marker,slug:'ci-edge-'+marker}});
    tenantId=tenant.id;
    const user = await prisma.user.create({data:{
      tenantId,email:marker+'-operator@example.test',firstName:'CI',lastName:'SiteOperator',
      role:'ADMIN',status:'ACTIVE',
    }});
    userId=user.id;
    const jwt = new JwtService({secret});
    const freshToken = async () => {
      const sid = marker+'session'+sessionIds.length;
      await prisma.session.create({data:{id:sid,userId:user.id,tenantId:tenant.id,
        token:marker+'refresh'+sessionIds.length,expiresAt:new Date(Date.now()+3600_000)}});
      sessionIds.push(sid);
      return jwt.sign({type:'access',sid,sub:user.id,tenantId:tenant.id,
        role:'ADMIN',email:user.email},{expiresIn:'10m'});
    };
    const module = await Test.createTestingModule({
      imports:[PassportModule],
      controllers:[SurveillanceController,SurveillanceGatewayController,SurveillanceDeviceCommandsController],
      providers:[JwtStrategy,{provide:ConfigService,useValue:{get:(key:string)=>key==='JWT_SECRET'?secret:undefined}}],
    }).compile();
    app=module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));
    await app.listen(0,'127.0.0.1');
    const origin='http://127.0.0.1:'+app.getHttpServer().address().port;
    const request=(path:string,bearer:string,method='GET',body?:unknown)=>fetch(origin+path,{
      method,headers:{Authorization:'Bearer '+bearer,...(body?{'Content-Type':'application/json'}:{})},
      body:body?JSON.stringify(body):undefined,
    });
    const tokenA=await freshToken();
    const site=await json(await request('/surveillance/sites',tokenA,'POST',{
      name:'Simulation depot '+marker,siteType:'WAREHOUSE',
    })) as {id:string};
    const camera=await json(await request('/surveillance/cameras',tokenA,'POST',{
      siteId:site.id,name:'Simulated RTSP camera '+marker,cameraType:'FIXED',connectorType:'RTSP',
    })) as {id:string};
    const edge=await json(await request('/surveillance/gateways',tokenA,'POST',{
      siteId:site.id,name:'CI site gateway '+marker,
    })) as {id:string;enrollmentToken:string};
    gatewayId=edge.id;
    assert.match(edge.enrollmentToken,/^sccg_[A-Za-z0-9_-]{43}$/);
    assert.equal((await request('/surveillance/cameras','not-a-jwt')).status,401);

    // A real local TCP listener responds to the same RTSP OPTIONS sent by the shipped edge agent.
    rtspServer=createRtspServer(socket=>{
      socket.once('data',chunk=>{
        assert.match(chunk.toString(),/^OPTIONS rtsp:\/\/127\.0\.0\.1:/);
        socket.end('RTSP/1.0 200 OK\r\nCSeq: 1\r\n\r\n');
      });
    });
    await new Promise<void>(resolve=>rtspServer!.listen(0,'127.0.0.1',resolve));
    const rtspPort=(rtspServer.address() as {port:number}).port;

    // Local TLS termination simulates outbound HTTPS without disabling certificate verification.
    // Test-only short-lived certificate, trusted solely by the isolated agent subprocess.
    const crt=join(temp,'cert.pem'),key=join(temp,'key.pem');
    execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes',
      '-keyout',key,'-out',crt,'-days','1','-subj','/CN=localhost',
      '-addext','subjectAltName=IP:127.0.0.1'],{stdio:'ignore'});
    httpsServer=createHttpsServer({key:await readFile(key),cert:await readFile(crt)},async(req,res)=>{
      try{
        const chunks:Buffer[]=[];
        for await(const chunk of req) chunks.push(Buffer.from(chunk));
        const upstream=await fetch(origin+req.url,{
          method:req.method,headers:{
            ...(req.headers.authorization?{authorization:req.headers.authorization}:{}),
            ...(req.headers['content-type']?{'content-type':req.headers['content-type']}:{})
          },body:chunks.length?Buffer.concat(chunks):undefined,
        });
        res.writeHead(upstream.status,{'content-type':upstream.headers.get('content-type')||'application/json'});
        res.end(Buffer.from(await upstream.arrayBuffer()));
      }catch{res.writeHead(502);res.end();}
    });
    await new Promise<void>(resolve=>httpsServer!.listen(0,'127.0.0.1',resolve));
    const tlsPort=(httpsServer.address() as {port:number}).port;
    const config=join(temp,'cameras.json');
    await writeFile(config,JSON.stringify({cameras:[{cameraId:camera.id,host:'127.0.0.1',port:rtspPort}]}),{mode:0o600});
    const agentPath=fileURLToPath(new URL('../../../scripts/surveillance-site-agent.mjs',import.meta.url));
    const agent=async()=>invoke(process.execPath,[agentPath,'--config',config],{
      env:{...process.env,NODE_EXTRA_CA_CERTS:crt,
        SCC_GATEWAY_TOKEN:edge.enrollmentToken,
        SCC_GATEWAY_API_URL:'https://127.0.0.1:'+tlsPort},
      timeout:20000,maxBuffer:100000,
    });
    const first=await agent();
    assert.match(first.stdout,/"status":"HEARTBEAT_ACCEPTED"/);
    assert.match(first.stdout,/"online":1/);
    const tokenB=await freshToken(); // independently persisted DB session, not a reused JWT.
    const saved=await json(await request('/surveillance/cameras',tokenB)) as Array<{
      id:string;siteId:string;name:string;effectiveConnectionStatus:string;lastSeenAt:string
    }>;
    assert.ok(saved.some(c=>c.id===camera.id&&c.siteId===site.id&&
      c.name==='Simulated RTSP camera '+marker&&c.effectiveConnectionStatus==='ONLINE'&&!!c.lastSeenAt));
    const gateways=await json(await request('/surveillance/gateways',tokenB)) as Array<{
      id:string;connectionState:string;enrollmentToken?:string
    }>;
    assert.ok(gateways.some(g=>g.id===gatewayId&&g.connectionState==='CONNECTED'&&
      g.enrollmentToken===undefined));
    // A tenant admin explicitly revokes the secret, then the actual agent cannot reconnect.
    const revoked=await request('/surveillance/gateways/'+gatewayId+'/revoke',tokenB,'POST');
    assert.equal(revoked.status,201);
    await assert.rejects(agent(),error=>{
      const failure=error as {stdout?:string;stderr?:string};
      assert.match((failure.stderr||'')+(failure.stdout||''),/heartbeat rejected: HTTP 403/);
      return true;
    });
    const retained=await json(await request('/surveillance/cameras',tokenB)) as Array<{id:string}>;
    assert.ok(retained.some(c=>c.id===camera.id));
    console.log('STATUS: PASS REAL_EDGE_ISOLATED; company_session=2; site_readback=PASS; camera_persisted=PASS; gateway_rtsp=ONLINE; gateway_revoke=403; tenant_count=1; production_changed=NO');
  }finally{
    if(httpsServer)await new Promise<void>(resolve=>httpsServer!.close(()=>resolve()));
    if(rtspServer)await new Promise<void>(resolve=>rtspServer!.close(()=>resolve()));
    if(app)await app.close();
    if(tenantId){
      await prisma.surveillanceDeviceCommand.deleteMany({where:{tenantId}});
      await prisma.surveillanceGateway.deleteMany({where:{tenantId}});
      await prisma.surveillanceIncident.deleteMany({where:{tenantId}});
      await prisma.surveillanceMaintenance.deleteMany({where:{tenantId}});
      await prisma.surveillanceCamera.deleteMany({where:{tenantId}});
      await prisma.surveillanceSite.deleteMany({where:{tenantId}});
    }
    if(sessionIds.length)await prisma.session.deleteMany({where:{id:{in:sessionIds}}});
    if(userId)await prisma.user.delete({where:{id:userId}});
    if(tenantId)await prisma.tenant.delete({where:{id:tenantId}});
    await prisma.$disconnect();
    await rm(temp,{recursive:true,force:true});
  }
});
