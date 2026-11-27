import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { FieldDeviceInventoryController } from '../src/field-devices/field-device-inventory.controller';

const controller = new FieldDeviceInventoryController();
const request = (role = 'ADMIN', tenantId = 'tenant-a') => ({
  user: { userId: 'actor-a', tenantId, role },
});

test('rejects anonymous and employee inventory reads', () => {
  assert.throws(() => controller.list({}), ForbiddenException);
  assert.throws(() => controller.list(request('USER')), ForbiddenException);
  assert.throws(() => controller.list(request('ADMIN', '')), ForbiddenException);
});

test('rejects asset registration outside company-admin role', async () => {
  await assert.rejects(
    () => controller.create(request('MANAGER'), { assetTag: 'ASSET-1', platform: 'ANDROID' }),
    ForbiddenException,
  );
});

test('rejects forged tenant, provider and acknowledged-notice fields before DB access', async () => {
  for (const field of ['tenantId', 'provider', 'managementState', 'noticeAcknowledgedAt']) {
    await assert.rejects(() => controller.create(request(), {
      assetTag: 'ASSET-1', platform: 'ANDROID', [field]: 'forged',
    } as any), BadRequestException);
  }
});

test('rejects unsupported devices and blank asset tags before DB access', async () => {
  await assert.rejects(
    () => controller.create(request(), { assetTag: 'ASSET-1', platform: 'WINDOWS' }),
    BadRequestException,
  );
  await assert.rejects(
    () => controller.create(request(), { assetTag: ' ', platform: 'IOS' }),
    BadRequestException,
  );
});
