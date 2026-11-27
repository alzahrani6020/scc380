import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ForbiddenException } from '@nestjs/common';
import { FieldDeviceDispatchController } from '../src/field-devices/field-device-dispatch.controller';
import { AndroidManagementAdapter } from '../src/field-devices/android-management.adapter';

const subject = new FieldDeviceDispatchController();

test('live lock dispatch must reject anonymous and non-admin actors before database access', async () => {
  await assert.rejects(() => subject.lock({}, 'd1', 'c1'), ForbiddenException);
  await assert.rejects(() => subject.lock({
    user: { tenantId: 'tenant-a', userId: 'worker-a', role: 'USER' },
  }, 'd1', 'c1'), ForbiddenException);
  await assert.rejects(() => subject.lock({
    user: { userId: 'admin-a', role: 'ADMIN' },
  }, 'd1', 'c1'), ForbiddenException);
});

test('provider-operation polling must reject unauthorized actors', async () => {
  await assert.rejects(() => subject.verify({}, 'd1', 'c1'), ForbiddenException);
  await assert.rejects(() => subject.verify({
    user: { tenantId: 'tenant-a', userId: 'employee-a', role: 'USER' },
  }, 'd1', 'c1'), ForbiddenException);
});

test('Google operation polling binds exact company enterprise and device', async () => {
  const binding = { enterpriseName: 'enterprises/enterprise-a',
    policyName: 'enterprises/enterprise-a/policies/default' };
  const adapter = new AndroidManagementAdapter(
    new Map([['tenant-a', binding]]), {
      async accessToken() { return 'TEST_ONLY'; },
      async request(url, init) {
        if (init.method === 'GET' && url.endsWith('/enterprises/enterprise-a')) {
          return { ok: true, status: 200, async json() { return { name: binding.enterpriseName }; } };
        }
        return { ok: true, status: 200, async json() {
          return { name: 'enterprises/enterprise-a/devices/device-a/operations/op-a',
            done: true, response: {} };
        } };
      },
    },
  );
  const operation = 'enterprises/enterprise-a/devices/device-a/operations/op-a';
  assert.equal(await adapter.readCommandOperation('tenant-a',
    'enterprises/enterprise-a/devices/device-a', operation), 'PROVIDER_COMPLETED');
  await assert.rejects(() => adapter.readCommandOperation('tenant-a',
    'enterprises/enterprise-b/devices/device-b', operation), /INVALID_TENANT_OPERATION/);
  await assert.rejects(() => adapter.readCommandOperation('tenant-a',
    'enterprises/enterprise-a/devices/device-a',
    'enterprises/enterprise-a/devices/another/operations/op-a'), /INVALID_TENANT_OPERATION/);
});

test('Google command polling rejects invalid or missing operation status', async () => {
  const binding = { enterpriseName: 'enterprises/enterprise-a',
    policyName: 'enterprises/enterprise-a/policies/default' };
  const adapter = new AndroidManagementAdapter(
    new Map([['tenant-a', binding]]), {
      async accessToken() { return 'TEST_ONLY'; },
      async request(url) {
        if (url.endsWith('/enterprises/enterprise-a')) {
          return { ok: true, status: 200, async json() { return { name: binding.enterpriseName }; } };
        }
        return { ok: true, status: 200, async json() {
          return { name: 'enterprises/enterprise-a/devices/device-a/operations/op-a' };
        } };
      },
    },
  );
  await assert.rejects(() => adapter.readCommandOperation('tenant-a',
    'enterprises/enterprise-a/devices/device-a',
    'enterprises/enterprise-a/devices/device-a/operations/op-a'), /INVALID_PROVIDER_OPERATION_RESPONSE/);
});
