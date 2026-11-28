import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard, assertAuthenticatedTenantScope } from '../src/auth/guards/jwt-auth.guard';

test('P0 signed company session must reject foreign tenant selected via request headers', () => {
  assert.throws(() => assertAuthenticatedTenantScope(
    { role: 'ADMIN', tenantId: 'tenant-A' }, 'tenant-B'), ForbiddenException);
  for (const role of ['ADMIN','MANAGER','USER','AUDITOR','READONLY']) {
    assert.throws(() => assertAuthenticatedTenantScope(
      { role, tenantId: 'tenant-A' }, 'tenant-B'), ForbiddenException);
    assert.doesNotThrow(() => assertAuthenticatedTenantScope(
      { role, tenantId: 'tenant-A' }, 'tenant-A'));
  }
});

test('P0 unaffiliated sessions cannot choose arbitrary company', () => {
  assert.throws(() => assertAuthenticatedTenantScope({ role: 'USER' }, 'tenant-A'), ForbiddenException);
  assert.doesNotThrow(() => assertAuthenticatedTenantScope(
    { role: 'SUPER_ADMIN', tenantId: null }, 'tenant-A'));
  assert.doesNotThrow(() => assertAuthenticatedTenantScope(
    { role: 'ADMIN', tenantId: 'tenant-A' }, undefined));
});

test('P0 JWT guard enforces tenant scope after Passport validates the user', () => {
  const guard = new JwtAuthGuard();
  const ctx = {
    switchToHttp: () => ({ getRequest: () => ({ tenantId: 'tenant-B' }) }),
  } as unknown as ExecutionContext;
  assert.throws(() => guard.handleRequest(null,
    { id: 'user-A', role: 'ADMIN', tenantId: 'tenant-A' }, null, ctx), ForbiddenException);
  assert.deepEqual(guard.handleRequest(null,
    { id: 'user-A', role: 'ADMIN', tenantId: 'tenant-B' }, null, ctx),
    { id: 'user-A', role: 'ADMIN', tenantId: 'tenant-B' });
});
