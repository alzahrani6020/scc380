import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AndroidManagementAdapter, validateAndroidBinding, type AndroidManagementTransport } from '../src/field-devices/android-management.adapter';
import { MdmNotConfiguredError } from '../src/field-devices/mdm-adapter';

const binding = {
  enterpriseName: 'enterprises/example-one',
  policyName: 'enterprises/example-one/policies/managed',
};
const bindings = new Map([['tenant-a', binding]]);
const calls: Array<{ url: string; method: string; data: any }> = [];
const transport: AndroidManagementTransport = {
  async accessToken() { return 'TEST_TOKEN_NOT_REAL'; },
  async request(url, init) {
    const data = init.body ? JSON.parse(init.body) : null;
    calls.push({ url, method: init.method, data });
    const body = init.method === 'GET'
      ? { name: binding.enterpriseName }
      : url.endsWith('/enrollmentTokens')
        ? { name: binding.enterpriseName + '/enrollmentTokens/id-1',
          expirationTimestamp: '2026-11-27T20:00:00Z' }
        : { name: binding.enterpriseName + '/devices/device-one/operations/operation-one' };
    return { ok: true, status: 200, async json() { return body; } };
  },
};
const adapter = new AndroidManagementAdapter(bindings, transport);

test('rejects enterprise-policy mismatch and unsafe path components', () => {
  assert.equal(validateAndroidBinding(binding), true);
  assert.equal(validateAndroidBinding({ ...binding, policyName: 'enterprises/another/policies/managed' }), false);
  assert.equal(validateAndroidBinding({ ...binding, enterpriseName: 'enterprises/foo?bad=1' }), false);
});

test('unknown tenant cannot provision or dispatch commands', async () => {
  assert.equal(await adapter.verifyTenantConnection('tenant-b'), false);
  await assert.rejects(() => adapter.requestEnrollment('tenant-b', 'ANDROID', 'ASSET-1'), MdmNotConfiguredError);
  await assert.rejects(() => adapter.submitCommand('tenant-b', 'enterprises/example-one/devices/device-one', 'LOCK'), MdmNotConfiguredError);
});

test('Android enrollment binds tenant and never reports a managed physical device', async () => {
  const response = await adapter.requestEnrollment('tenant-a', 'ANDROID', 'ASSET-1');
  assert.match(response.providerEnrollmentId, /enrollmentTokens\/id-1/);
  assert.equal(response.enrollmentUrl, undefined);
  const request = calls.find(c => c.url.endsWith('/enrollmentTokens'));
  assert.equal(request?.data.policyName, binding.policyName);
  assert.equal(request?.data.oneTimeOnly, true);
  assert.equal(request?.data.duration, '1800s');
});

test('Android command returns provider acceptance, never device-confirmed success', async () => {
  const result = await adapter.submitCommand('tenant-a',
    'enterprises/example-one/devices/device-one', 'LOCK');
  assert.equal(result.status, 'PROVIDER_ACCEPTED');
  assert.equal(result.deviceConfirmed, false);
  assert.match(result.providerRequestId, /operations\/operation-one/);
  await assert.rejects(() => adapter.submitCommand('tenant-a',
    'enterprises/another/devices/device-one', 'LOCK'), /DEVICE_NOT_IN_TENANT_ENTERPRISE/);
  await assert.rejects(() => adapter.submitCommand('tenant-a',
    'enterprises/example-one/devices/device-one', 'SYNC_POLICY'), /ANDROID_COMMAND_NOT_SUPPORTED/);
});

test('missing binding and denied provider stay NOT_CONFIGURED', async () => {
  const unknown = await adapter.capabilities('tenant-b', 'ANDROID');
  assert.equal(unknown.ENROLL, 'NOT_CONFIGURED');
  const denied = new AndroidManagementAdapter(bindings, {
    async accessToken() { return 'token'; },
    async request() { return { ok: false, status: 403, async json() { return {}; } }; },
  });
  assert.equal(await denied.verifyTenantConnection('tenant-a'), false);
  await assert.rejects(() => denied.requestEnrollment('tenant-a', 'ANDROID', 'ASSET-1'), MdmNotConfiguredError);
});
