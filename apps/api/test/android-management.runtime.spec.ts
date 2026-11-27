import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configuredAndroidTenants } from '../src/field-devices/android-management.runtime';
import { FieldDevicesController } from '../src/field-devices/field-devices.controller';

test('tenant bindings reject malformed and unscoped environment configuration', () => {
  assert.equal(configuredAndroidTenants(undefined).size, 0);
  assert.throws(() => configuredAndroidTenants('[]'), /ANDROID_TENANT_BINDINGS_INVALID/);
  assert.throws(() => configuredAndroidTenants('{"x":{}}'), /ANDROID_TENANT_BINDING_INVALID/);
  assert.throws(() => configuredAndroidTenants('{"tenant-a":{"enterpriseName":4,"policyName":"p"}}'), /ANDROID_TENANT_BINDING_INVALID/);
  assert.throws(() => configuredAndroidTenants(JSON.stringify({
    'tenant-a': { enterpriseName: 'enterprises/same', policyName: 'enterprises/same/policies/p1' },
    'tenant-b': { enterpriseName: 'enterprises/same', policyName: 'enterprises/same/policies/p2' },
  })), /ANDROID_ENTERPRISE_TENANT_ISOLATION_CONFLICT/);
});

test('Android verification fails closed without configured MDM tenant', async () => {
  const prior = process.env.SCC380_ANDROID_MDM_TENANTS_JSON;
  delete process.env.SCC380_ANDROID_MDM_TENANTS_JSON;
  try {
    const response = await new FieldDevicesController().androidConnection({
      user: { tenantId: 'tenant-a', userId: 'admin', role: 'ADMIN' },
    });
    assert.equal(response.status, 'NOT_CONFIGURED');
    assert.equal(response.enrolledDevicesVerified, false);
    assert.equal(response.androidEnrollment, 'NOT_CONFIGURED');
  } finally {
    if (prior !== undefined) process.env.SCC380_ANDROID_MDM_TENANTS_JSON = prior;
  }
});
