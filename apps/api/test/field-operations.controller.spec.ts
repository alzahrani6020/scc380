import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ForbiddenException } from '@nestjs/common';
import { FieldOperationsController } from '../src/field-devices/field-operations.controller';

const subject = new FieldOperationsController();

test('unified operational overview denies anonymous and out-of-role access before database reads', async () => {
  await assert.rejects(() => subject.overview({}), ForbiddenException);
  await assert.rejects(() => subject.overview({ user: {
    role: 'ADMIN', userId: 'u1',
  } }), ForbiddenException);
  await assert.rejects(() => subject.overview({ user: {
    role: 'WORKER', userId: 'u1', tenantId: 'tenant-a',
  } }), ForbiddenException);
});

test('unified operational overview requires authenticated actor identity', async () => {
  await assert.rejects(() => subject.overview({ user: {
    role: 'MANAGER', tenantId: 'tenant-a',
  } }), ForbiddenException);
});
