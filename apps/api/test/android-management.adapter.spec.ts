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
          expirationTimestamp: '2026-11-27T20:00:00Z', qrCode: '{\"android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME\":\"test\"}' }
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
  assert.ok(response.enrollmentQrData?.includes('PROVISIONING_DEVICE_ADMIN'));
  const request = calls.find(c => c.url.endsWith('/enrollmentTokens'));
  assert.equal(request?.data.policyName, binding.policyName);
  assert.equal(request?.data.oneTimeOnly, true);
  assert.equal(request?.data.allowPersonalUsage, 'PERSONAL_USAGE_DISALLOWED');
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

test('Google device inventory confirms only recent fully managed corporate devices', async () => {
  const reportedAt = new Date().toISOString();
  const calls: string[] = [];
  const reporting = new AndroidManagementAdapter(bindings, {
    async accessToken() { return 'TEST_TOKEN'; },
    async request(url, init) {
      calls.push(url);
      const body = init.method === 'GET' && url.endsWith('/devices?pageSize=100')
        ? { devices: [
          { name: 'enterprises/example-one/devices/personal', enrollmentTokenData: 'ASSET-1',
            managementMode: 'PROFILE_OWNER', ownership: 'COMPANY_OWNED',
            policyCompliant: true, appliedPolicyName: binding.policyName,
            appliedState: 'ACTIVE', lastStatusReportTime: reportedAt },
          { name: 'enterprises/example-one/devices/company', enrollmentTokenData: 'ASSET-1',
            managementMode: 'DEVICE_OWNER', ownership: 'COMPANY_OWNED',
            policyCompliant: true, appliedPolicyName: binding.policyName,
            appliedState: 'ACTIVE', lastStatusReportTime: reportedAt },
        ] }
        : { name: binding.enterpriseName };
      return { ok: true, status: 200, async json() { return body; } };
    },
  });
  const verified = await reporting.findVerifiedDevice('tenant-a', 'ASSET-1');
  assert.equal(verified?.providerDeviceId, 'enterprises/example-one/devices/company');
  assert.ok(calls.some(url => url.endsWith('/devices?pageSize=100')));
});

test('unverified policy, ownership, or stale status never marks Android as managed', async () => {
  const bad = new AndroidManagementAdapter(bindings, {
    async accessToken() { return 'TEST_TOKEN'; },
    async request(url, init) {
      const body = init.method === 'GET' && url.includes('/devices?pageSize')
        ? { devices: [{
          name: 'enterprises/example-one/devices/unverified', enrollmentTokenData: 'ASSET-1',
          managementMode: 'DEVICE_OWNER', ownership: 'COMPANY_OWNED',
          policyCompliant: false, appliedPolicyName: binding.policyName,
          appliedState: 'ACTIVE', lastStatusReportTime: new Date().toISOString(),
        }] } : { name: binding.enterpriseName };
      return { ok: true, status: 200, async json() { return body; } };
    },
  });
  assert.equal(await bad.findVerifiedDevice('tenant-a', 'ASSET-1'), null);
});
