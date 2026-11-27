import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ForbiddenException } from '@nestjs/common';
import { FieldDevicesController } from '../src/field-devices/field-devices.controller';

const controller = new FieldDevicesController();
const access = (tenantId = 'tenant-a', role = 'ADMIN') => ({
  user: { tenantId, userId: 'u1', role },
});

test('device capability endpoint does not claim working MDM when unconfigured', () => {
  const result = controller.capabilities(access());
  assert.equal(result.status, 'NOT_CONFIGURED');
  assert.equal(result.enrollment.android, 'NOT_CONFIGURED');
  assert.equal(result.enrollment.ios, 'NOT_CONFIGURED');
  assert.equal(result.commands, 'NOT_CONFIGURED');
  assert.equal(result.personalMessages, 'UNSUPPORTED');
});

test('device capability endpoint rejects anonymous and worker-role requests', () => {
  assert.throws(() => controller.capabilities({}), ForbiddenException);
  assert.throws(() => controller.capabilities(access('tenant-a', 'USER')), ForbiddenException);
  assert.throws(() => controller.capabilities({ user: { role: 'ADMIN', userId: 'u1' } }), ForbiddenException);
});
