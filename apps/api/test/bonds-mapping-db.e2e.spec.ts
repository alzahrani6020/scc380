import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign, randomUUID } from 'node:crypto';
import { prisma } from '@scc/database';
import { JwtService } from '@nestjs/jwt';
import { validateAccessSessionPayload } from '../src/auth/access-session';
import { checkBondsProgramScope } from '../src/auth/bonds-program-scope';
import { BondsMappingController } from '../src/auth/bonds-mapping.controller';

test('BONDS identity probe uses actual isolated tenant/user DB and Redis nonce replay guard', {
  skip: process.env.CRM_DB_E2E !== '1' ? 'CRM_DB_E2E=1 required' : false,
}, async () => {
  const redisUrl = process.env.REDIS_URL;
  assert.ok(redisUrl,'CI Redis required');
  const {publicKey,privateKey}=generateKeyPairSync('ed25519');
  const publicPem=publicKey.export({type:'spki',format:'pem'}).toString();
  const config={
    get:(key:string)=>key==='BONDS_MAKKIN_PUBLIC_KEY_PEM'?publicPem:
      key==='REDIS_URL'?redisUrl:undefined,
  } as any;
  const controller=new BondsMappingController(config);
  const unique=randomUUID();
  const tenant=await prisma.tenant.create({
    data:{name:'BONDS Bridge E2E',slug:'bonds-bridge-'+unique,status:'ACTIVE',plan:'BASIC'},
  });
  let userId:string|undefined;
  try{
    const user=await prisma.user.create({
      data:{tenantId:tenant.id,email:'bridge-'+unique+'@example.test',
        firstName:'Bridge',lastName:'E2E',
        role:'ADMIN',status:'ACTIVE',emailVerified:true},
    });
    userId=user.id;
    const proof=(change:Record<string,unknown>={})=>{
      const now=Math.floor(Date.now()/1000);
      const claims={
        iss:'bonds-global',aud:'scc380:mapping-verification',
        purpose:'verify-identity-only',
        workspaceLinkId:'11111111-1111-4111-8111-111111111111',
        bondsUserId:'22222222-2222-4222-8222-222222222222',
        tenantId:tenant.id,userId:user.id,programKey:'hr',
        email:user.email,emailConfirmed:true,iat:now,exp:now+40,jti:randomUUID(),
        ...change,
      };
      const data=Buffer.from(JSON.stringify(claims)).toString('base64url');
      return data+'.'+sign(null,Buffer.from(data),privateKey).toString('base64url');
    };
    const ticket=proof();
    const valid=await controller.verifyMapping(ticket);
    assert.deepEqual(valid,{matched:true,operationalReady:false});
    assert.equal(JSON.stringify(valid).includes(user.email),false);
    assert.equal(JSON.stringify(valid).includes(tenant.id),false);
    await assert.rejects(()=>controller.verifyMapping(ticket));
    assert.deepEqual(await controller.verifyMapping(proof({email:'other@example.test'})),
      {matched:false,operationalReady:false});
    assert.deepEqual(await controller.verifyMapping(proof({tenantId:'invalid-tenant'})),
      {matched:false,operationalReady:false});
    const secret='ci-only-bonds-program-session-secret-0123456789';
    const jwt=new JwtService({secret});
    const sessionConfig={
      get:(key:string)=>key==='BONDS_MAKKIN_PUBLIC_KEY_PEM'?publicPem:
        key==='REDIS_URL'?redisUrl:key==='JWT_SECRET'?secret:undefined,
    } as any;
    const issuer=new BondsMappingController(sessionConfig,jwt);
    const programProof=()=>proof({
      aud:'scc380:program-session',purpose:'issue-program-session'
    });
    const authProof=programProof();
    const session=await issuer.issueScopedProgramSession(authProof);
    assert.equal(session.programKey,'hr');
    assert.equal(session.expiresInSeconds,110);
    assert.equal(session.operationalParityVerified,false);
    assert.ok(session.accessToken);
    const payload=jwt.verify(session.accessToken);
    assert.equal(payload.bondsOrigin,true);
    assert.equal(payload.bondsProgramKey,'hr');
    assert.equal(payload.type,'access');
    assert.equal(payload.exp-payload.iat,110);
    const scope=await validateAccessSessionPayload(payload);
    assert.equal(scope.bondsOrigin,true);
    assert.equal(scope.bondsProgramKey,'hr');
    assert.equal(checkBondsProgramScope(scope,'/hr/employees','GET'),true);
    assert.equal(checkBondsProgramScope(scope,'/finance/journal-entries','GET'),false);
    await assert.rejects(()=>issuer.issueScopedProgramSession(authProof));
    await assert.rejects(()=>issuer.verifyMapping(programProof()));
    const scopeCount=await prisma.session.count({where:{userId:user.id}});
    assert.equal(scopeCount,1);
    const audit=await prisma.auditLog.findMany({
      where:{userId:user.id,action:'BONDS_SCOPED_PROGRAM_SESSION_ISSUED'}
    });
    assert.equal(audit.length,1);
    assert.equal(JSON.stringify(audit[0]).includes(session.accessToken),false);
    await prisma.user.update({where:{id:user.id},data:{twoFactorEnabled:true}});
    await assert.rejects(()=>issuer.issueScopedProgramSession(programProof()));
    await prisma.user.update({where:{id:user.id},data:{twoFactorEnabled:false}});
    await prisma.user.update({where:{id:user.id},data:{status:'SUSPENDED'}});
    assert.deepEqual(await controller.verifyMapping(proof()),
      {matched:false,operationalReady:false});
  }finally{
    if(userId)await prisma.user.delete({where:{id:userId}}).catch(()=>{});
    await prisma.tenant.delete({where:{id:tenant.id}}).catch(()=>{});
    await prisma.$disconnect();
  }
});
