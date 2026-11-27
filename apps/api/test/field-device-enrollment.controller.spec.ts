import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ForbiddenException } from '@nestjs/common';
import { FieldDeviceEnrollmentController } from '../src/field-devices/field-device-enrollment.controller';

const controller = new FieldDeviceEnrollmentController();
const res = { setHeader() {} } as any;

test('enrollment QR cannot be issued anonymously or by non-admin roles', async () => {
  await assert.rejects(() => controller.android({}, 'device-1', res), ForbiddenException);
  await assert.rejects(() => controller.android({ user: {
    tenantId: 'company-a', userId: 'worker', role: 'USER',
  } }, 'device-1', res), ForbiddenException);
});

test('enrollment QR cannot be requested without tenant identity', async () => {
  await assert.rejects(() => controller.android({ user: {
    userId: 'admin', role: 'ADMIN',
  } }, 'device-1', res), ForbiddenException);
});
