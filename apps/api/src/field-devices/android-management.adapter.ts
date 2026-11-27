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
    Promise<{ providerEnrollmentId: string; enrollmentUrl?: string; enrollmentQrData?: string; expiresAt: string }> {
    if (platform !== 'ANDROID' || !assetTag.trim() || assetTag.length > 100) {
      throw new Error('ANDROID_ENROLLMENT_INPUT_INVALID');
    }
    const binding = this.binding(tenantId);
    if (!(await this.verifyTenantConnection(tenantId))) throw new MdmNotConfiguredError();
    const token = await this.api('POST', binding.enterpriseName + '/enrollmentTokens', {
      policyName: binding.policyName,
      duration: '1800s',
      oneTimeOnly: true,
      allowPersonalUsage: 'PERSONAL_USAGE_DISALLOWED',
      additionalData: assetTag.trim(),
    });
    const id = token?.name;
    if (typeof id !== 'string' || !id.startsWith(binding.enterpriseName + '/enrollmentTokens/') ||
      typeof token?.expirationTimestamp !== 'string') {
      throw new Error('ANDROID_ENROLLMENT_PROVIDER_RESPONSE_INVALID');
    }
    // Do not persist or log the token. A setup QR can be handed to an
    // authorized enrollment UI only through a separate secret-handling flow.
    if (typeof token.qrCode !== 'string' || token.qrCode.length > 8192 || !token.qrCode.trim()) {
      throw new Error('ANDROID_ENROLLMENT_QR_MISSING');
    }
    return { providerEnrollmentId: id, expiresAt: token.expirationTimestamp,
      enrollmentQrData: token.qrCode };
  }


  /**
   * Confirm actual fully-managed corporate enrollment against Google.
   * An asset is managed only when its enrollmentTokenData matches exactly,
   * the policy is applied and compliance / recent status are reported.
   */
  async findVerifiedDevice(tenantId: string, assetTag: string):
    Promise<{ providerDeviceId: string; lastSeenAt: Date } | null> {
    if (!assetTag || assetTag.length > 100) return null;
    const binding = this.binding(tenantId);
    if (!(await this.verifyTenantConnection(tenantId))) throw new MdmNotConfiguredError();
    const matches: Array<{ providerDeviceId: string; lastSeenAt: Date }> = [];
    let pageToken = '';
    for (let page = 0; page < 20; page++) {
      const url = binding.enterpriseName + '/devices?pageSize=100' +
        (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');
      const result = await this.api('GET', url);
      if (!result || (result.devices !== undefined && !Array.isArray(result.devices))) {
        throw new Error('ANDROID_DEVICE_LIST_INVALID');
      }
      for (const device of (result.devices ?? [])) {
        if (device.enrollmentTokenData !== assetTag) continue;
        const name = device.name;
        if (typeof name !== 'string' ||
          !name.startsWith(binding.enterpriseName + '/devices/') || !DEVICE.test(name) ||
          device.managementMode !== 'DEVICE_OWNER' ||
          device.ownership !== 'COMPANY_OWNED' ||
          device.appliedState !== 'ACTIVE' ||
          device.policyCompliant !== true ||
          device.appliedPolicyName !== binding.policyName) {
          continue;
        }
        const reported = Date.parse(device.lastStatusReportTime);
        if (!Number.isFinite(reported) || reported > Date.now() + 5 * 60_000 ||
          reported < Date.now() - 24 * 60 * 60_000) continue;
        matches.push({ providerDeviceId: name, lastSeenAt: new Date(reported) });
      }
      if (!result.nextPageToken) {
        if (matches.length > 1) throw new Error('DUPLICATE_ENROLLED_DEVICES_FOR_ASSET');
        return matches[0] ?? null;
      }
      if (typeof result.nextPageToken !== 'string' || result.nextPageToken.length > 4096) {
        throw new Error('ANDROID_DEVICE_PAGINATION_INVALID');
      }
      pageToken = result.nextPageToken;
    }
    throw new Error('ANDROID_DEVICE_INVENTORY_PAGINATION_LIMIT');
  }

  /**
   * Poll a previously returned, tenant-bound Google operation.
   * A completed operation is evidence of provider processing, NOT a live media session
   * or an independently witnessed physical-device state.
   */
  async readCommandOperation(tenantId: string, providerDeviceId: string, operationName: string):
    Promise<'PROVIDER_PENDING' | 'PROVIDER_COMPLETED' | 'PROVIDER_FAILED'> {
    const binding = this.binding(tenantId);
    if (!DEVICE.test(providerDeviceId) ||
        !providerDeviceId.startsWith(binding.enterpriseName + '/devices/') ||
        typeof operationName !== 'string' ||
        !/^enterprises\/[A-Za-z0-9_-]+\/devices\/[A-Za-z0-9_.-]+\/operations\/[A-Za-z0-9_.-]+$/.test(operationName) ||
        !operationName.startsWith(providerDeviceId + '/operations/')) {
      throw new Error('INVALID_TENANT_OPERATION');
    }
    if (!(await this.verifyTenantConnection(tenantId))) throw new MdmNotConfiguredError();
    const result = await this.api('GET', operationName);
    if (result?.name !== operationName ||
      (result.done !== undefined && typeof result.done !== 'boolean')) {
      throw new Error('INVALID_PROVIDER_OPERATION_RESPONSE');
    }
    // Protobuf JSON may omit a default-false `done` field.
    if (result.done !== true) return 'PROVIDER_PENDING';
    const code = result.metadata?.errorCode;
    if (result.error || (typeof code === 'string' &&
      code !== 'COMMAND_ERROR_CODE_UNSPECIFIED')) return 'PROVIDER_FAILED';
    if (!result.response) throw new Error('INVALID_PROVIDER_OPERATION_RESPONSE');
    return 'PROVIDER_COMPLETED';
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
