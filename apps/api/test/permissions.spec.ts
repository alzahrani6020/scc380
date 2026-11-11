import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { hasPermission } from '@scc/auth';
import { PermissionsGuard, RequirePermissions } from '../src/auth/guards/permissions.guard';

test('permission matrix: roles vs crm permissions', () => {
  assert.equal(hasPermission('SUPER_ADMIN', 'crm:write'), true); // *
  assert.equal(hasPermission('ADMIN', 'crm:write'), true); // crm:*
  assert.equal(hasPermission('MANAGER', 'crm:write'), true); // crm:*
  assert.equal(hasPermission('USER', 'crm:write'), true); // exact
  assert.equal(hasPermission('USER', 'crm:read'), true);
  assert.equal(hasPermission('AUDITOR', 'crm:read'), true); // *read
  assert.equal(hasPermission('READONLY', 'crm:read'), true); // *read
  assert.equal(hasPermission('AUDITOR', 'crm:write'), false); // read-only roles cannot write
  assert.equal(hasPermission('READONLY', 'crm:write'), false);
  assert.equal(hasPermission('USER', 'hr:write'), false); // outside granted scope
  assert.equal(hasPermission('USER', 'notifications:read'), true);
  assert.equal(hasPermission('USER', 'notifications:self-write'), true);
  assert.equal(hasPermission('USER', 'notifications:admin'), false);
  assert.equal(hasPermission('MANAGER', 'notifications:admin'), true);
  assert.equal(hasPermission('ADMIN', 'notifications:admin'), true);
  assert.equal(hasPermission('AUDITOR', 'notifications:read'), true);
  assert.equal(hasPermission('READONLY', 'notifications:read'), true);
  assert.equal(hasPermission('AUDITOR', 'notifications:self-write'), false);
  assert.equal(hasPermission('READONLY', 'notifications:self-write'), false);
});

class DummyController {
  @RequirePermissions('crm:write')
  write() {}

  @RequirePermissions('crm:read')
  read() {}
}

function ctx(user: any, handler: string): ExecutionContext {
  return {
    getHandler: () => (DummyController.prototype as any)[handler],
    getClass: () => DummyController,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

test('PermissionsGuard allows when metadata is absent', () => {
  const guard = new PermissionsGuard(new Reflector());
  const bare = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({}) }),
  } as unknown as ExecutionContext;
  assert.equal(guard.canActivate(bare), true);
});

test('PermissionsGuard blocks READONLY from crm:write but allows crm:read', () => {
  const guard = new PermissionsGuard(new Reflector());
  assert.throws(() => guard.canActivate(ctx({ role: 'READONLY' }, 'write')), ForbiddenException);
  assert.equal(guard.canActivate(ctx({ role: 'READONLY' }, 'read')), true);
});

test('PermissionsGuard allows USER/AUDITOR boundary correctly', () => {
  const guard = new PermissionsGuard(new Reflector());
  assert.equal(guard.canActivate(ctx({ role: 'USER' }, 'write')), true);
  assert.equal(guard.canActivate(ctx({ role: 'AUDITOR' }, 'read')), true);
  assert.throws(() => guard.canActivate(ctx({ role: 'AUDITOR' }, 'write')), ForbiddenException);
  assert.throws(() => guard.canActivate(ctx({}, 'read')), ForbiddenException); // no role on session
});
