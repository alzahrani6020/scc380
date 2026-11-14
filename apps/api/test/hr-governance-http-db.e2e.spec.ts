import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { HttpAdapterHost, Reflector } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { hashPassword } from '@scc/auth';
import { prisma } from '@scc/database';
import { AuthModule } from '../src/auth/auth.module';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { AuthRateLimitGuard } from '../src/auth/guards/auth-rate-limit.guard';
import { LoginDiagnosticFilter } from '../src/auth/filters/login-diagnostic.filter';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { LocalStrategy } from '../src/auth/strategies/local.strategy';
import { PermissionsGuard } from '../src/auth/guards/permissions.guard';
import { HrGovernanceController } from '../src/hr/hr-governance.controller';
import { HrGovernanceService } from '../src/hr/hr-governance.service';
import { AuditLogInterceptor } from '../src/common/interceptors/audit-log.interceptor';

test('HTTP acceptance: password login, tenant-aware JWT, governance writes, reads and audit', {
  skip: process.env.CRM_DB_E2E !== '1' ? 'isolated PostgreSQL required' : false,
  timeout: 90000,
}, async () => {
  const oldSecret = process.env.JWT_SECRET;
  const secret = 'makkin-ci-jwt-only-' + randomUUID() + '-' + randomUUID();
  process.env.JWT_SECRET = secret;
  const id = randomUUID().replace(/-/g, '').slice(0, 20);
  const emailA = 'governance-http-a-' + id + '@example.test';
  const emailB = 'governance-http-b-' + id + '@example.test';
  const password = 'Ci-acceptance-only-' + randomUUID();
  let tenantA: { id: string } | undefined;
  let tenantB: { id: string } | undefined;
  let app: any;
  try {
    tenantA = await prisma.tenant.create({ data: { name: 'Makkin HTTP A ' + id, slug: 'makkin-http-a-' + id } });
    tenantB = await prisma.tenant.create({ data: { name: 'Makkin HTTP B ' + id, slug: 'makkin-http-b-' + id } });
    const passwordHash = await hashPassword(password);
    const userA = await prisma.user.create({
      data: { tenantId: tenantA.id, email: emailA, passwordHash, firstName: 'HTTP', lastName: 'Admin', role: 'ADMIN', status: 'ACTIVE' },
    });
    await prisma.user.create({
      data: { tenantId: tenantB.id, email: emailB, passwordHash, firstName: 'Other', lastName: 'Admin', role: 'ADMIN', status: 'ACTIVE' },
    });
    const employee = await prisma.employee.create({
      data: { tenantId: tenantA.id, employeeCode: 'HTTP-' + id, firstName: 'Acceptance', lastName: 'Employee', hireDate: new Date('2026-01-01T00:00:00Z') },
    });

    // tsx executes without emitDecoratorMetadata; restore the constructor metadata
    // required for Nest's real providers and guards in this isolated HTTP test.
    Reflect.defineMetadata('design:paramtypes', [JwtService, ConfigService], AuthService);
    Reflect.defineMetadata('design:paramtypes', [AuthService, AuthRateLimitGuard], AuthController);
    Reflect.defineMetadata('design:paramtypes', [ConfigService], JwtStrategy);
    Reflect.defineMetadata('design:paramtypes', [AuthService], LocalStrategy);
    Reflect.defineMetadata('design:paramtypes', [HttpAdapterHost], LoginDiagnosticFilter);
    Reflect.defineMetadata('design:paramtypes', [HrGovernanceService], HrGovernanceController);
    Reflect.defineMetadata('design:paramtypes', [Reflector], PermissionsGuard);
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), AuthModule],
      controllers: [HrGovernanceController],
      providers: [HrGovernanceService, PermissionsGuard],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalInterceptors(new AuditLogInterceptor());
    await app.listen(0, '127.0.0.1');
    const port = app.getHttpServer().address().port;
    const base = 'http://127.0.0.1:' + port;
    const json = async (path: string, method = 'GET', body?: unknown, token?: string) => {
      const res = await fetch(base + path, {
        method,
        headers: {
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          ...(token ? { authorization: 'Bearer ' + token } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const data: any = await res.json();
      return { status: res.status, data };
    };

    const anonymous = await json('/hr/governance');
    assert.equal(anonymous.status, 401, 'Unauthenticated access must fail');

    const loginA = await json('/auth/login', 'POST', { email: emailA, password });
    assert.equal(loginA.status, 201, 'Correct credentials must log in');
    assert.equal(typeof loginA.data.accessToken, 'string');
    const tokenA = loginA.data.accessToken;

    const loginB = await json('/auth/login', 'POST', { email: emailB, password });
    assert.equal(loginB.status, 201);
    const tokenB = loginB.data.accessToken;

    const created = await json('/hr/governance', 'POST', {
      employeeId: employee.id, category: 'VIOLATIONS', priority: 'HIGH',
      title: 'Isolated HTTP governance acceptance',
      description: 'Create and retrieve a real tenant-owned governance case through the HTTP controller',
    }, tokenA);
    assert.equal(created.status, 201, JSON.stringify(created.data).slice(0, 300));
    assert.equal(created.data.tenantId, tenantA.id);
    const caseId = created.data.id;

    const retrieved = await json('/hr/governance/' + caseId, 'GET', undefined, tokenA);
    assert.equal(retrieved.status, 200);
    assert.equal(retrieved.data.id, caseId);

    const denied = await json('/hr/governance/' + caseId, 'GET', undefined, tokenB);
    assert.equal(denied.status, 404, 'Other tenant must not read case');

    const wrongTenantWrite = await json('/hr/governance', 'POST', {
      employeeId: employee.id, category: 'VIOLATIONS',
      title: 'Forbidden cross tenant case',
      description: 'Another tenant must never write an employee case',
    }, tokenB);
    assert.equal(wrongTenantWrite.status, 404, 'Other tenant must not create a case for foreign employee');

    const note = await json('/hr/governance/' + caseId + '/notes', 'POST', {
      details: 'Recorded by authenticated HTTP acceptance',
    }, tokenA);
    assert.equal(note.status, 201);
    assert.ok(note.data.events.some((e: any) => e.action === 'NOTE'));
    assert.ok((await prisma.hrGovernanceEvent.count({ where: { tenantId: tenantA.id, caseId, action: 'NOTE' } })) >= 1);

    // Audit interceptor performs asynchronous writes after the response.
    let auditCount = 0;
    for (let attempt = 0; attempt < 40; attempt++) {
      auditCount = await prisma.auditLog.count({
        where: { userId: userA.id, httpMethod: 'POST', httpPath: { contains: '/hr/governance' } },
      });
      if (auditCount >= 2) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(auditCount >= 2, 'Governance mutations must be recorded in the HTTP audit log');
  } finally {
    if (app) await app.close();
    // Governance rows have restrictive tenant foreign keys. Delete only the
    // synthetic test tenant's children, in referential order.
    if (tenantA) {
      await prisma.hrGovernanceEvidence.deleteMany({ where: { tenantId: tenantA.id } });
      await prisma.hrGovernanceEvent.deleteMany({ where: { tenantId: tenantA.id } });
      await prisma.hrGovernanceCase.deleteMany({ where: { tenantId: tenantA.id } });
    }
    for (const tenant of [tenantA, tenantB]) {
      if (tenant) await prisma.tenant.delete({ where: { id: tenant.id } });
    }
    await prisma.$disconnect();
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
  }
});
