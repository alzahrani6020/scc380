import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ForbiddenException } from '@nestjs/common';
import { FieldDeviceLocationsController } from '../src/field-devices/field-device-locations.controller';

const controller = new FieldDeviceLocationsController();
test('location access rejects users without a management tenant and allowed role', async () => {
  await assert.rejects(() => controller.history({}, 'device'), ForbiddenException);
  await assert.rejects(() => controller.history({ user: {
    tenantId: 'tenant-a', userId: 'worker', role: 'USER',
  } }, 'device'), ForbiddenException);
  await assert.rejects(() => controller.history({ user: {
    userId: 'admin', role: 'ADMIN',
  } }, 'device'), ForbiddenException);
});
