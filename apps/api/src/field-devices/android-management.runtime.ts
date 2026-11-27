import { GoogleAuth } from 'google-auth-library';
import { AndroidManagementAdapter, type AndroidEnterpriseBinding, type AndroidManagementTransport } from './android-management.adapter';

/**
 * Deployment configuration:
 * SCC380_ANDROID_MDM_TENANTS_JSON:
 *   {"tenant-cuid":{"enterpriseName":"enterprises/abc","policyName":"enterprises/abc/policies/managed"}}
 *
 * Google Cloud ADC / workload identity / GOOGLE_APPLICATION_CREDENTIALS must
 * be configured by infrastructure. Never include a service account private
 * key in a tenant record or commit secrets to source control.
 */
export function configuredAndroidTenants(value: string | undefined):
  ReadonlyMap<string, AndroidEnterpriseBinding> {
  if (!value) return new Map();
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('ANDROID_TENANT_BINDINGS_INVALID');
  }
  const entries = Object.entries(parsed as Record<string, unknown>);
  if (entries.length > 1000) throw new Error('ANDROID_TENANT_BINDINGS_TOO_LARGE');
  const result = new Map<string, AndroidEnterpriseBinding>();
  for (const [tenantId, data] of entries) {
    if (!/^[A-Za-z0-9_-]{5,100}$/.test(tenantId) ||
        !data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('ANDROID_TENANT_BINDING_INVALID');
    }
    const record = data as Record<string, unknown>;
    if (typeof record.enterpriseName !== 'string' || typeof record.policyName !== 'string') {
      throw new Error('ANDROID_TENANT_BINDING_INVALID');
    }
    result.set(tenantId, {
      enterpriseName: record.enterpriseName,
      policyName: record.policyName,
    });
  }
  return result;
}

export function androidGoogleTransport(): AndroidManagementTransport {
  const googleAuth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/androidmanagement'],
  });
  return {
    async accessToken() {
      const client = await googleAuth.getClient();
      const token = await client.getAccessToken();
      if (!token.token) throw new Error('ANDROID_GOOGLE_ACCESS_TOKEN_UNAVAILABLE');
      return token.token;
    },
    async request(url, init) {
      // Fixed endpoint constructed in the adapter; no tenant-supplied URLs.
      return fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(15000) });
    },
  };
}

/** No network traffic or credential loading until an approved tenant is configured. */
export function makeAndroidMdmAdapter(value = process.env.SCC380_ANDROID_MDM_TENANTS_JSON) {
  return new AndroidManagementAdapter(configuredAndroidTenants(value), androidGoogleTransport());
}
