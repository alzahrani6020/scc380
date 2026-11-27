import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  authorizeFieldDeviceAction,
  authorizeFieldMediaStart,
  type DeviceAccessContext,
} from '../src/field-devices/field-device-access.policy';

const base: DeviceAccessContext = {
  tenantId: 'company-a',
  actorTenantId: 'company-a',
  actorId: 'supervisor-1',
  deviceId: 'device-1',
  role: 'FIELD_SUPERVISOR',
  supervisionScopeDeviceIds: ['device-1'],
  activeShift: true,
  companyNoticeAcknowledged: true,
  policyApproved: true,
  sessionVisibleToWorker: true,
  sessionAccepted: true,
};

test('only assigned field supervisors can view field device locations', () => {
  assert.deepEqual(authorizeFieldDeviceAction('location:read', base), { allowed: true });
  assert.equal(authorizeFieldDeviceAction('location:read', {
    ...base, supervisionScopeDeviceIds: ['device-2'],
  }).allowed, false);
});

test('cross-company access is denied even with administrative roles', () => {
  assert.deepEqual(authorizeFieldDeviceAction('device:read', {
    ...base, role: 'COMPANY_ADMIN', actorTenantId: 'company-b',
  }), { allowed: false, reason: 'CROSS_TENANT_DENIED' });
});

test('field location access requires an active shift and notice', () => {
  assert.equal(authorizeFieldDeviceAction('location:read', {
    ...base, activeShift: false,
  }).allowed, false);
  assert.equal(authorizeFieldDeviceAction('location:read', {
    ...base, companyNoticeAcknowledged: false,
  }).allowed, false);
});

test('media cannot start without a visible, accepted session', () => {
  assert.deepEqual(authorizeFieldMediaStart({
    ...base, sessionAccepted: false,
  }), { allowed: false, reason: 'SESSION_NOT_ACCEPTED' });
  assert.deepEqual(authorizeFieldMediaStart({
    ...base, sessionVisibleToWorker: false,
  }), { allowed: false, reason: 'SESSION_MUST_BE_VISIBLE' });
  assert.deepEqual(authorizeFieldMediaStart(base), { allowed: true });
});

test('remote wipe requires secondary approval', () => {
  const admin: DeviceAccessContext = { ...base, role: 'DEVICE_ADMIN' };
  assert.deepEqual(authorizeFieldDeviceAction('device:wipe', admin), {
    allowed: false, reason: 'SECOND_APPROVAL_REQUIRED',
  });
  assert.deepEqual(authorizeFieldDeviceAction('device:wipe', {
    ...admin, secondaryApproval: true,
  }), { allowed: true });
});

test('investigations require an authorized case and correct role', () => {
  assert.equal(authorizeFieldDeviceAction('investigation:read', {
    ...base, role: 'INVESTIGATOR',
  }).allowed, false);
  assert.equal(authorizeFieldDeviceAction('investigation:read', {
    ...base, role: 'INVESTIGATOR', authorizedCaseId: 'case-1',
  }).allowed, true);
  assert.equal(authorizeFieldDeviceAction('investigation:read', {
    ...base, role: 'DEVICE_ADMIN', authorizedCaseId: 'case-1',
  }).allowed, false);
});

test('unrecognized roles and missing actor identity fail closed', () => {
  assert.equal(authorizeFieldDeviceAction('device:read', {
    ...base, role: 'UNRECOGNIZED' as any,
  }).allowed, false);
  assert.equal(authorizeFieldDeviceAction('device:read', {
    ...base, actorId: '',
  }).allowed, false);
});
