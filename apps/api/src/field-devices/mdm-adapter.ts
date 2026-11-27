/**
 * Provider contract for SCC380 corporate-owned devices.
 * No network/device operation is possible without an installed, verified adapter.
 * Provider credentials must be injected server-side, scoped to the authenticated tenant.
 */
export type ManagedPlatform = 'ANDROID' | 'IOS';
export type ProviderFeature =
  | 'ENROLL'
  | 'COMPLIANCE'
  | 'LOCK'
  | 'WIPE'
  | 'SYNC_POLICY'
  | 'LOCATION'
  | 'REMOTE_SUPPORT';

export type FeatureSupport = 'SUPPORTED' | 'REQUIRES_INTERACTION' | 'UNSUPPORTED' | 'NOT_CONFIGURED';

export type DeviceCommandAction = 'LOCK' | 'WIPE' | 'SYNC_POLICY';
export type ProviderCommandResult = {
  providerRequestId: string;
  status: 'PROVIDER_ACCEPTED' | 'REJECTED';
  deviceConfirmed: false;
};

/** A provider acknowledgment NEVER means device execution. */
export interface MdmAdapter {
  readonly providerId: string;
  readonly platforms: readonly ManagedPlatform[];
  verifyTenantConnection(tenantId: string): Promise<boolean>;
  capabilities(tenantId: string, platform: ManagedPlatform): Promise<
    Partial<Record<ProviderFeature, FeatureSupport>>
  >;
  requestEnrollment(tenantId: string, platform: ManagedPlatform, assetTag: string):
    Promise<{ providerEnrollmentId: string; enrollmentUrl?: string; expiresAt: string }>;
  submitCommand(tenantId: string, providerDeviceId: string, action: DeviceCommandAction):
    Promise<ProviderCommandResult>;
}

export class MdmNotConfiguredError extends Error {
  constructor() { super('MDM_PROVIDER_NOT_CONFIGURED'); }
}

/** Explicit no-op instead of simulated success, fake QR codes or fabricated receipts. */
export class UnconfiguredMdmAdapter implements MdmAdapter {
  readonly providerId = 'UNCONFIGURED';
  readonly platforms = ['ANDROID', 'IOS'] as const;
  async verifyTenantConnection(_tenantId: string): Promise<boolean> { return false; }
  async capabilities(_tenantId: string, _platform: ManagedPlatform) {
    return {
      ENROLL: 'NOT_CONFIGURED', COMPLIANCE: 'NOT_CONFIGURED',
      LOCK: 'NOT_CONFIGURED', WIPE: 'NOT_CONFIGURED',
      SYNC_POLICY: 'NOT_CONFIGURED', LOCATION: 'NOT_CONFIGURED',
      REMOTE_SUPPORT: 'NOT_CONFIGURED',
    } as const;
  }
  async requestEnrollment(_tenantId: string, _platform: ManagedPlatform, _assetTag: string):
    Promise<{ providerEnrollmentId: string; enrollmentUrl?: string; expiresAt: string }> {
    throw new MdmNotConfiguredError();
  }
  async submitCommand(_tenantId: string, _providerDeviceId: string, _action: DeviceCommandAction):
    Promise<ProviderCommandResult> {
    throw new MdmNotConfiguredError();
  }
}

/**
 * Registry intentionally starts empty. Adding a real vendor adapter requires
 * tenant-specific onboarding, credential rotation and provider receipt tests.
 */
export class MdmAdapterRegistry {
  private readonly providers = new Map<string, MdmAdapter>();
  register(adapter: MdmAdapter) {
    if (!adapter.providerId || adapter.providerId === 'UNCONFIGURED' ||
      this.providers.has(adapter.providerId)) {
      throw new Error('INVALID_OR_DUPLICATE_MDM_PROVIDER');
    }
    this.providers.set(adapter.providerId, adapter);
  }
  get(providerId: string): MdmAdapter {
    return this.providers.get(providerId) ?? new UnconfiguredMdmAdapter();
  }
  async verified(providerId: string, tenantId: string): Promise<MdmAdapter> {
    const adapter = this.get(providerId);
    if (!tenantId || !(await adapter.verifyTenantConnection(tenantId))) {
      throw new MdmNotConfiguredError();
    }
    return adapter;
  }
}
