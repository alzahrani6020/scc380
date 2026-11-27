import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ForbiddenException } from '@nestjs/common';
import { FieldProcurementReviewController } from '../src/field-devices/field-procurement-review.controller';

const subject = new FieldProcurementReviewController();

test('company purchasing exception review denies anonymous and unscoped users', async () => {
  await assert.rejects(() => subject.exceptions({}), ForbiddenException);
  await assert.rejects(() => subject.exceptions({ user: {
    userId: 'auditor', role: 'AUDITOR',
  } }), ForbiddenException);
  await assert.rejects(() => subject.exceptions({ user: {
    userId: 'worker', tenantId: 'company-a', role: 'USER',
  } }), ForbiddenException);
});
