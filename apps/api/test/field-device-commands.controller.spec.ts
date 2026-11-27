import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { FieldDeviceCommandsController } from '../src/field-devices/field-device-commands.controller';

const controller = new FieldDeviceCommandsController();
const req = (role = 'ADMIN') => ({ user: { tenantId: 'company-a', userId: 'actor-1', role } });

test('command history requires a tenant-scoped management identity', async () => {
  await assert.rejects(() => controller.history({}, 'device-1'), ForbiddenException);
  await assert.rejects(() => controller.history(req('USER'), 'device-1'), ForbiddenException);
});

test('command requests reject unauthorized roles, forged identity, and invalid actions', async () => {
  const valid = { action: 'LOCK' as const, reason: 'Missing device', idempotencyKey: 'device_command_2026_1' };
  await assert.rejects(() => controller.request(req('MANAGER'), 'device-1', valid), ForbiddenException);
  await assert.rejects(() => controller.request(req(), 'device-1', {
    ...valid, tenantId: 'company-b',
  } as any), BadRequestException);
  await assert.rejects(() => controller.request(req(), 'device-1', {
    ...valid, action: 'CAMERA_CAPTURE',
  } as any), BadRequestException);
});

test('request requires unique nontrivial idempotency key and reason', async () => {
  await assert.rejects(() => controller.request(req(), 'device-1', {
    action: 'WIPE', reason: '', idempotencyKey: 'device_command_2026_1',
  }), BadRequestException);
  await assert.rejects(() => controller.request(req(), 'device-1', {
    action: 'LOCK', reason: 'Lost phone', idempotencyKey: 'short',
  }), BadRequestException);
});

test('approval requires authenticated company administrator', async () => {
  await assert.rejects(() => controller.approve({}, 'device-1', 'command-1'), ForbiddenException);
  await assert.rejects(() => controller.approve(req('AUDITOR'), 'device-1', 'command-1'), ForbiddenException);
});
