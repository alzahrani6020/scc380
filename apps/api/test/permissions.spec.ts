import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { hasPermission } from '@scc/auth';
import { PermissionsGuard, RequirePermissions, REQUIRE_PERMISSIONS_KEY } from '../src/auth/guards/permissions.guard';
import { PaymentsController } from '../src/finance/payments.controller';
import { ExpensesController } from '../src/finance/expenses.controller';
import { ChartOfAccountsController } from '../src/finance/chart-of-accounts.controller';
import { JournalEntriesController } from '../src/finance/journal-entries.controller';
import { BankAccountsController } from '../src/finance/bank-accounts.controller';
import { PurchaseOrdersController } from '../src/finance/purchase-orders.controller';

test('permission matrix: roles vs crm and hr permissions', () => {
  assert.equal(hasPermission('SUPER_ADMIN', 'crm:write'), true);
  assert.equal(hasPermission('ADMIN', 'crm:write'), true);
  assert.equal(hasPermission('MANAGER', 'crm:write'), true);
  assert.equal(hasPermission('USER', 'crm:write'), true);
  assert.equal(hasPermission('USER', 'crm:read'), true);
  assert.equal(hasPermission('AUDITOR', 'crm:read'), true);
  assert.equal(hasPermission('READONLY', 'crm:read'), true);
  assert.equal(hasPermission('AUDITOR', 'crm:write'), false);
  assert.equal(hasPermission('READONLY', 'crm:write'), false);

  assert.equal(hasPermission('SUPER_ADMIN', 'hr:write'), true);
  assert.equal(hasPermission('ADMIN', 'hr:read'), true);
  assert.equal(hasPermission('ADMIN', 'hr:write'), true);
  assert.equal(hasPermission('MANAGER', 'hr:read'), true);
  assert.equal(hasPermission('MANAGER', 'hr:write'), false);
  assert.equal(hasPermission('USER', 'hr:read'), false);
  assert.equal(hasPermission('USER', 'hr:write'), false);
  assert.equal(hasPermission('AUDITOR', 'hr:read'), true);
  assert.equal(hasPermission('AUDITOR', 'hr:write'), false);
  assert.equal(hasPermission('READONLY', 'hr:read'), true);
  assert.equal(hasPermission('READONLY', 'hr:write'), false);

  assert.equal(hasPermission('ADMIN', 'erp:read'), true);
  assert.equal(hasPermission('ADMIN', 'erp:write'), true);
  assert.equal(hasPermission('MANAGER', 'erp:read'), true);
  assert.equal(hasPermission('MANAGER', 'erp:write'), false);
  assert.equal(hasPermission('USER', 'erp:read'), true);
  assert.equal(hasPermission('USER', 'erp:write'), false);
  assert.equal(hasPermission('AUDITOR', 'erp:read'), true);
  assert.equal(hasPermission('AUDITOR', 'erp:write'), false);

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

  @RequirePermissions('hr:write')
  hrWrite() {}

  @RequirePermissions('hr:read')
  hrRead() {}

  @RequirePermissions('erp:write')
  erpWrite() {}

  @RequirePermissions('erp:read')
  erpRead() {}
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

test('PermissionsGuard enforces hr read/write boundaries', () => {
  const guard = new PermissionsGuard(new Reflector());
  assert.equal(guard.canActivate(ctx({ role: 'ADMIN' }, 'hrWrite')), true);
  assert.equal(guard.canActivate(ctx({ role: 'MANAGER' }, 'hrRead')), true);
  assert.throws(() => guard.canActivate(ctx({ role: 'MANAGER' }, 'hrWrite')), ForbiddenException);
  assert.throws(() => guard.canActivate(ctx({ role: 'USER' }, 'hrRead')), ForbiddenException);
  assert.equal(guard.canActivate(ctx({ role: 'AUDITOR' }, 'hrRead')), true);
  assert.throws(() => guard.canActivate(ctx({ role: 'AUDITOR' }, 'hrWrite')), ForbiddenException);
});

test('PermissionsGuard enforces ERP finance read/write boundaries', () => {
  const guard = new PermissionsGuard(new Reflector());
  assert.equal(guard.canActivate(ctx({ role: 'ADMIN' }, 'erpWrite')), true);
  assert.equal(guard.canActivate(ctx({ role: 'MANAGER' }, 'erpRead')), true);
  assert.throws(() => guard.canActivate(ctx({ role: 'MANAGER' }, 'erpWrite')), ForbiddenException);
  assert.equal(guard.canActivate(ctx({ role: 'USER' }, 'erpRead')), true);
  assert.throws(() => guard.canActivate(ctx({ role: 'USER' }, 'erpWrite')), ForbiddenException);
  assert.equal(guard.canActivate(ctx({ role: 'AUDITOR' }, 'erpRead')), true);
  assert.throws(() => guard.canActivate(ctx({ role: 'AUDITOR' }, 'erpWrite')), ForbiddenException);
});

test('PermissionsGuard allows USER/AUDITOR boundary correctly', () => {
  const guard = new PermissionsGuard(new Reflector());
  assert.equal(guard.canActivate(ctx({ role: 'USER' }, 'write')), true);
  assert.equal(guard.canActivate(ctx({ role: 'AUDITOR' }, 'read')), true);
  assert.throws(() => guard.canActivate(ctx({ role: 'AUDITOR' }, 'write')), ForbiddenException);
  assert.throws(() => guard.canActivate(ctx({}, 'read')), ForbiddenException);
});


test('Finance controllers declare ERP permissions on every route', () => {
  const controllers: Array<[any, string[], string[]]> = [
    [PaymentsController, ['findAll', 'findOne'], ['create', 'update', 'remove']],
    [ExpensesController, ['findAll', 'findOne'], ['create', 'update', 'remove']],
    [ChartOfAccountsController, ['findAll', 'findOne'], ['create', 'update', 'remove']],
    [JournalEntriesController, ['findAll', 'findOne'], ['create', 'reverse', 'update', 'remove']],
    [BankAccountsController, ['findAll', 'findOne'], ['create', 'update', 'remove']],
    [PurchaseOrdersController, ['findAll', 'findOne'], ['create', 'update', 'remove']],
  ];

  for (const [ControllerClass, readMethods, writeMethods] of controllers) {
    for (const method of readMethods) {
      assert.deepEqual(
        Reflect.getMetadata(REQUIRE_PERMISSIONS_KEY, ControllerClass.prototype[method]),
        ['erp:read'],
        `${ControllerClass.name}.${method} must require erp:read`,
      );
    }
    for (const method of writeMethods) {
      assert.deepEqual(
        Reflect.getMetadata(REQUIRE_PERMISSIONS_KEY, ControllerClass.prototype[method]),
        ['erp:write'],
        `${ControllerClass.name}.${method} must require erp:write`,
      );
    }
  }
});
