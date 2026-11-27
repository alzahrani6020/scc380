import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { FieldDeviceAssignmentsController } from '../src/field-devices/field-device-assignments.controller';

const controller = new FieldDeviceAssignmentsController();
const actor = (role = 'ADMIN') => ({ user: { tenantId: 'company-a', userId: 'user-a', role } });

test('assignment requires company administrator and authenticated tenant', async () => {
  await assert.rejects(() => controller.assign(actor('MANAGER'), 'd1', {
    employeeId: 'e1', noticeVersion: 'v1',
  }), ForbiddenException);
  await assert.rejects(() => controller.assign({}, 'd1', {
    employeeId: 'e1', noticeVersion: 'v1',
  }), ForbiddenException);
});

test('invalid and forged assignment fields fail before database writes', async () => {
  await assert.rejects(() => controller.assign(actor(), 'd1', {
    employeeId: '', noticeVersion: 'v1',
  }), BadRequestException);
  await assert.rejects(() => controller.assign(actor(), 'd1', {
    employeeId: 'e1', noticeVersion: 'v1', tenantId: 'company-b',
  } as any), BadRequestException);
});

test('notice acknowledgment requires correct version without spoofed identity', async () => {
  await assert.rejects(() => controller.acknowledge(actor(), 'd1', {
    noticeVersion: '',
  }), BadRequestException);
  await assert.rejects(() => controller.acknowledge(actor(), 'd1', {
    noticeVersion: 'v1', noticeAcknowledgedAt: new Date(),
  } as any), BadRequestException);
});
