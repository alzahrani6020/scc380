import type {
  DeviceCommandAction, FeatureSupport, ManagedPlatform, MdmAdapter,
  ProviderCommandResult, ProviderFeature,
} from './mdm-adapter';
import { MdmNotConfiguredError } from './mdm-adapter';

/**
 * Google Android Management API transport, injected for tests and deployment.
 * Callers must provide a valid short-lived OAuth 2.0 access token.
 * Keep credentials in a server-side secret manager, never in browser or DB.
 */
export interface AndroidManagementTransport {
  accessToken(): Promise<string>;
  request(url: string, init: { method: 'GET' | 'POST'; headers: Record<string, string>; body?: string }):
    Promise<{ ok: boolean; status: number; json(): Promise<any> }>;
}

export type AndroidEnterpriseBinding = {
  enterpriseName: string;
  policyName: string;
};

const ENTERPRISE = /^enterprises\/[A-Za-z0-9_-]+$/;
const POLICY = /^enterprises\/[A-Za-z0-9_-]+\/policies\/[A-Za-z0-9_.-]+$/;
const DEVICE = /^enterprises\/[A-Za-z0-9_-]+\/devices\/[A-Za-z0-9_.-]+$/;

export function validateAndroidBinding(binding: AndroidEnterpriseBinding): boolean {
  return ENTERPRISE.test(binding.enterpriseName) && POLICY.test(binding.policyName) &&
    binding.policyName.startsWith(binding.enterpriseName + '/policies/');
}

/**
 * Android Enterprise: full management enrollment and limited supported commands.
 * Never infer success from a provider HTTP 2xx; operations are asynchronous.
 */
export class AndroidManagementAdapter implements MdmAdapter {
  readonly providerId = 'ANDROID_MANAGEMENT_API';
  readonly platforms: readonly ManagedPlatform[] = ['ANDROID'];

  constructor(
    private readonly bindings: ReadonlyMap<string, AndroidEnterpriseBinding>,
    private readonly transport: AndroidManagementTransport,
  ) {}

  private binding(tenantId: string): AndroidEnterpriseBinding {
    const binding = this.bindings.get(tenantId);
    if (!binding || !validateAndroidBinding(binding)) throw new MdmNotConfiguredError();
    return binding;
  }

  private async api(method: 'GET' | 'POST', resource: string, body?: object): Promise<any> {
    const token = await this.transport.accessToken();
    if (!token) throw new MdmNotConfiguredError();
    const result = await this.transport.request(
      'https://androidmanagement.googleapis.com/v1/' + resource,
      { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}) },
    );
    if (!result.ok) {
      // Do not include provider body: it may contain sensitive device/account data.
      throw new Error('ANDROID_MANAGEMENT_API_HTTP_' + result.status);
    }
    return result.json();
  }

  async verifyTenantConnection(tenantId: string): Promise<boolean> {
    let binding: AndroidEnterpriseBinding;
    try { binding = this.binding(tenantId); } catch { return false; }
    try {
      const enterprise = await this.api('GET', binding.enterpriseName);
      return enterprise?.name === binding.enterpriseName;
    } catch { return false; }
  }

  async capabilities(tenantId: string, platform: ManagedPlatform):
    Promise<Partial<Record<ProviderFeature, FeatureSupport>>> {
    if (platform !== 'ANDROID' || !(await this.verifyTenantConnection(tenantId))) {
      return { ENROLL: 'NOT_CONFIGURED', LOCK: 'NOT_CONFIGURED',
        WIPE: 'NOT_CONFIGURED', COMPLIANCE: 'NOT_CONFIGURED',
        LOCATION: 'NOT_CONFIGURED', REMOTE_SUPPORT: 'NOT_CONFIGURED',
        SYNC_POLICY: 'NOT_CONFIGURED' };
    }
    return { ENROLL: 'SUPPORTED', LOCK: 'SUPPORTED', WIPE: 'SUPPORTED',
      COMPLIANCE: 'SUPPORTED', LOCATION: 'NOT_CONFIGURED',
      REMOTE_SUPPORT: 'REQUIRES_INTERACTION', SYNC_POLICY: 'UNSUPPORTED' };
  }

  async requestEnrollment(tenantId: string, platform: ManagedPlatform, assetTag: string):
    Promise<{ providerEnrollmentId: string; enrollmentUrl?: string; expiresAt: string }> {
    if (platform !== 'ANDROID' || !assetTag.trim() || assetTag.length > 100) {
      throw new Error('ANDROID_ENROLLMENT_INPUT_INVALID');
    }
    const binding = this.binding(tenantId);
    if (!(await this.verifyTenantConnection(tenantId))) throw new MdmNotConfiguredError();
    const token = await this.api('POST', binding.enterpriseName + '/enrollmentTokens', {
      policyName: binding.policyName,
      duration: '1800s',
      oneTimeOnly: true,
      additionalData: assetTag.trim(),
    });
    const id = token?.name;
    if (typeof id !== 'string' || !id.startsWith(binding.enterpriseName + '/enrollmentTokens/') ||
      typeof token?.expirationTimestamp !== 'string') {
      throw new Error('ANDROID_ENROLLMENT_PROVIDER_RESPONSE_INVALID');
    }
    // Do not persist or log the token. A setup QR can be handed to an
    // authorized enrollment UI only through a separate secret-handling flow.
    return { providerEnrollmentId: id, expiresAt: token.expirationTimestamp };
  }

  async submitCommand(tenantId: string, providerDeviceId: string, action: DeviceCommandAction):
    Promise<ProviderCommandResult> {
    if (!['LOCK', 'WIPE'].includes(action)) throw new Error('ANDROID_COMMAND_NOT_SUPPORTED');
    const binding = this.binding(tenantId);
    if (!DEVICE.test(providerDeviceId) ||
      !providerDeviceId.startsWith(binding.enterpriseName + '/devices/')) {
      throw new Error('DEVICE_NOT_IN_TENANT_ENTERPRISE');
    }
    if (!(await this.verifyTenantConnection(tenantId))) throw new MdmNotConfiguredError();
    const op = await this.api('POST', providerDeviceId + ':issueCommand', { type: action });
    if (typeof op?.name !== 'string' || !op.name.startsWith(providerDeviceId + '/operations/')) {
      throw new Error('ANDROID_COMMAND_RESPONSE_INVALID');
    }
    return { providerRequestId: op.name, status: 'PROVIDER_ACCEPTED', deviceConfirmed: false };
  }
}
