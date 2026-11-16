import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign, randomUUID } from 'node:crypto';
import { prisma } from '@scc/database';
import { JwtService } from '@nestjs/jwt';
import { validateAccessSessionPayload } from '../src/auth/access-session';
import { checkBondsProgramScope } from '../src/auth/bonds-program-scope';
import { BondsMappingController } from '../src/auth/bonds-mapping.controller';

import { TasksService } from '../src/projects/tasks.service';
import { ContractsService } from '../src/hr/contracts.service';

test('employee draft contracts persist and reject foreign tenant employees or mass assignment', {
  skip: process.env.CRM_DB_E2E !== '1' ? 'CRM_DB_E2E=1 required' : false,
}, async () => {
  const suffix=randomUUID();
  const tenantA=await prisma.tenant.create({
    data:{name:'BONDS Contract A',slug:'bonds-contract-a-'+suffix,status:'ACTIVE',plan:'BASIC'},
  });
  const tenantB=await prisma.tenant.create({
    data:{name:'BONDS Contract B',slug:'bonds-contract-b-'+suffix,status:'ACTIVE',plan:'BASIC'},
  });
  let employeeAId:string|undefined,employeeBId:string|undefined,contractId:string|undefined;
  try {
    const employeeA=await prisma.employee.create({data:{
      tenantId:tenantA.id,employeeCode:'BONDS-A-'+suffix,firstName:'Test',
      lastName:'Employee',hireDate:new Date('2026-01-01T00:00:00Z'),
    }});
    employeeAId=employeeA.id;
    const employeeB=await prisma.employee.create({data:{
      tenantId:tenantB.id,employeeCode:'BONDS-B-'+suffix,firstName:'Other',
      lastName:'Employee',hireDate:new Date('2026-01-01T00:00:00Z'),
    }});
    employeeBId=employeeB.id;
    const service=new ContractsService();
    const actorA={user:{tenantId:tenantA.id,role:'ADMIN'}};
    const actorB={user:{tenantId:tenantB.id,role:'ADMIN'}};
    await assert.rejects(()=>service.create(actorA,{
      employeeId:employeeB.id,contractNumber:'FOREIGN-'+suffix,startDate:'2026-11-16',
    }),/Employee not found/);
    const contract=await service.create(actorA,{
      employeeId:employeeA.id,contractNumber:'BONDS-CONTRACT-'+suffix,
      startDate:'2026-11-16',tenantId:tenantB.id,status:'ACTIVE',
      terminatedAt:new Date('2026-11-16T00:00:00Z'),
    });
    contractId=contract.id;
    assert.equal(contract.tenantId,tenantA.id);
    assert.equal(contract.employeeId,employeeA.id);
    assert.equal(contract.status,'DRAFT');
    assert.equal(contract.terminatedAt,null);
    const saved=await service.findOne(actorA,contract.id);
    assert.equal(saved.contractNumber,'BONDS-CONTRACT-'+suffix);
    await assert.rejects(()=>service.findOne(actorB,contract.id),/Contract not found/);
    const updated=await service.updateDraft(actorA,contract.id,{
      notes:'Verified update',tenantId:tenantB.id,employeeId:employeeB.id,status:'ACTIVE'
    });
    assert.equal(updated.tenantId,tenantA.id);
    assert.equal(updated.employeeId,employeeA.id);
    assert.equal(updated.status,'DRAFT');
    assert.equal(updated.notes,'Verified update');
    await assert.rejects(()=>service.updateDraft(actorB,contract.id,{
      notes:'Foreign edit'
    }),/Contract not found/);
    await assert.rejects(()=>service.create(actorA,{
      employeeId:employeeA.id,contractNumber:'BONDS-CONTRACT-'+suffix,startDate:'2026-11-16'
    }),/Contract number already exists/);
    // Complete contract lifecycle: only the owning tenant may activate,
    // the draft becomes immutable, and termination is single-use.
    await assert.rejects(()=>service.activate(actorB,contract.id),/Contract not found/);
    const active=await service.activate(actorA,contract.id,'2026-11-16T00:00:00Z');
    assert.equal(active.status,'ACTIVE');
    assert.ok(active.signedAt);
    await assert.rejects(
      ()=>service.updateDraft(actorA,contract.id,{notes:'After approval'}),
      /Only draft contracts can be edited/
    );
    await assert.rejects(()=>service.activate(actorA,contract.id),/Only draft contracts can be activated/);
    await assert.rejects(()=>service.terminate(actorB,contract.id),/Contract not found/);
    const terminated=await service.terminate(actorA,contract.id,'Verified offboarding');
    assert.equal(terminated.status,'TERMINATED');
    assert.equal(terminated.terminationReason,'Verified offboarding');
    await assert.rejects(
      ()=>service.terminate(actorA,contract.id),/Only active contracts can be terminated/
    );

  }finally{
    if(contractId)await prisma.employeeContract.delete({where:{id:contractId}}).catch(()=>{});
    if(employeeAId)await prisma.employee.delete({where:{id:employeeAId}}).catch(()=>{});
    if(employeeBId)await prisma.employee.delete({where:{id:employeeBId}}).catch(()=>{});
    await prisma.tenant.delete({where:{id:tenantA.id}}).catch(()=>{});
    await prisma.tenant.delete({where:{id:tenantB.id}}).catch(()=>{});
    await prisma.$disconnect();
  }
});

test('project tasks preserve tenant isolation on create, update and read in disposable SCC PostgreSQL', {
  skip: process.env.CRM_DB_E2E !== '1' ? 'CRM_DB_E2E=1 required' : false,
}, async () => {
  const suffix=randomUUID();
  const tenantA=await prisma.tenant.create({
    data:{name:'BONDS Task A',slug:'bonds-task-a-'+suffix,status:'ACTIVE',plan:'BASIC'},
  });
  const tenantB=await prisma.tenant.create({
    data:{name:'BONDS Task B',slug:'bonds-task-b-'+suffix,status:'ACTIVE',plan:'BASIC'},
  });
  let projectId:string|undefined, userBId:string|undefined, taskId:string|undefined;
  try {
    const project=await prisma.project.create({data:{tenantId:tenantB.id,name:'Foreign Project'}});
    projectId=project.id;
    const external=await prisma.user.create({data:{
      tenantId:tenantB.id,email:'task-'+suffix+'@example.test',
      firstName:'Foreign',lastName:'Assignee',role:'ADMIN',status:'ACTIVE',
    }});
    userBId=external.id;
    const service=new TasksService();
    const actorA={user:{tenantId:tenantA.id,role:'ADMIN'}};
    const actorB={user:{tenantId:tenantB.id,role:'ADMIN'}};
    await assert.rejects(
      ()=>service.create(actorA,{title:'Forbidden project',projectId:project.id}),
      /Project not found/
    );
    await assert.rejects(
      ()=>service.create(actorA,{title:'Forbidden assignee',assignedToId:external.id}),
      /Assignee not found/
    );
    const task=await service.create(actorA,{title:'Verified task',description:'Tenant A only'});
    taskId=task.id;
    assert.equal(task.tenantId,tenantA.id);
    const saved=await service.findOne(actorA,task.id);
    assert.equal(saved.title,'Verified task');
    await assert.rejects(()=>service.findOne(actorB,task.id),/Task not found/);
    await assert.rejects(
      ()=>service.create(actorB,{title:'Forbidden parent',parentId:task.id}),
      /Parent task not found/
    );
    await assert.rejects(
      ()=>service.update(actorA,task.id,{assignedToId:external.id}),
      /Assignee not found/
    );
    await assert.rejects(
      ()=>service.update(actorA,task.id,{title:'Tampered',projectId:project.id}),
      /Project not found/
    );
    const updated=await service.update(actorA,task.id,{
      title:'Verified update',tenantId:tenantB.id,
    });
    assert.equal(updated.tenantId,tenantA.id);
    assert.equal(updated.projectId,null);
    assert.equal((await service.findOne(actorA,task.id)).title,'Verified update');
    await assert.rejects(
      ()=>service.update(actorB,task.id,{title:'Foreign overwrite'}),
      /Task not found/
    );
  } finally {
    if(taskId)await prisma.task.delete({where:{id:taskId}}).catch(()=>{});
    if(projectId)await prisma.project.delete({where:{id:projectId}}).catch(()=>{});
    if(userBId)await prisma.user.delete({where:{id:userBId}}).catch(()=>{});
    await prisma.tenant.delete({where:{id:tenantA.id}}).catch(()=>{});
    await prisma.tenant.delete({where:{id:tenantB.id}}).catch(()=>{});
    await prisma.$disconnect();
  }
});

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
