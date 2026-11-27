import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { FieldDeviceShiftsController } from '../src/field-devices/field-device-shifts.controller';

const controller = new FieldDeviceShiftsController();
const admin = { user: { tenantId: 'tenant-a', userId: 'admin-a', role: 'ADMIN' } };

test('shift lifecycle requires an authenticated tenant administrator', async () => {
  await assert.rejects(() => controller.start({}, 'device-a', { reason: 'Work' }), ForbiddenException);
  await assert.rejects(() => controller.start(
    { user: { ...admin.user, role: 'MANAGER' } }, 'device-a', { reason: 'Work' },
  ), ForbiddenException);
});

test('shift actions fail closed on identity injection and missing reason', async () => {
  await assert.rejects(() => controller.start(admin, 'device-a', { reason: ' ' }), BadRequestException);
  await assert.rejects(() => controller.end(admin, 'device-a', { reason: 'Work', tenantId: 'tenant-b' } as any), BadRequestException);
});

test('shift read requires a valid management session', async () => {
  await assert.rejects(() => controller.list({ user: { role: 'ADMIN', userId: 'u1' } }, 'device-a'), ForbiddenException);
  await assert.rejects(() => controller.list({ user: { ...admin.user, role: 'USER' } }, 'device-a'), ForbiddenException);
});
