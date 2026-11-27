/**
 * Fail-closed authorization policy for SCC380 company-managed field devices.
 *
 * This is a domain policy only; callers MUST authenticate requests server-side,
 * verify memberships against the database, and write immutable audit events.
 * It intentionally does not support covert device, microphone, camera or
 * personal-message access.
 */
export type FieldDeviceAction =
  | 'device:read'
  | 'device:enroll'
  | 'device:policy'
  | 'device:lock'
  | 'device:wipe'
  | 'location:read'
  | 'session:request'
  | 'business-records:read'
  | 'investigation:read';

export type FieldDeviceRole =
  | 'COMPANY_ADMIN'
  | 'FIELD_SUPERVISOR'
  | 'DEVICE_ADMIN'
  | 'PROCUREMENT_AUDITOR'
  | 'INVESTIGATOR'
  | 'WORKER';

export type DeviceAccessContext = {
  tenantId: string;
  actorTenantId: string;
  actorId: string;
  role: FieldDeviceRole;
  assignedActorId?: string;
  supervisionScopeDeviceIds?: readonly string[];
  deviceId: string;
  activeShift: boolean;
  companyNoticeAcknowledged: boolean;
  policyApproved: boolean;
  authorizedCaseId?: string;
  sessionVisibleToWorker?: boolean;
  sessionAccepted?: boolean;
  secondaryApproval?: boolean;
};

const permissions: Record<FieldDeviceRole, readonly FieldDeviceAction[]> = {
  COMPANY_ADMIN: ['device:read', 'device:enroll', 'device:policy', 'device:lock', 'device:wipe', 'location:read', 'session:request', 'business-records:read'],
  FIELD_SUPERVISOR: ['device:read', 'location:read', 'session:request'],
  DEVICE_ADMIN: ['device:read', 'device:enroll', 'device:policy', 'device:lock', 'device:wipe'],
  PROCUREMENT_AUDITOR: ['business-records:read'],
  INVESTIGATOR: ['investigation:read', 'business-records:read'],
  WORKER: ['device:read'],
};

export type DeviceAccessDecision = { allowed: true } | { allowed: false; reason: string };

export function authorizeFieldDeviceAction(
  action: FieldDeviceAction,
  context: DeviceAccessContext,
): DeviceAccessDecision {
  if (!context.actorId || !context.deviceId || !context.tenantId || !context.actorTenantId) {
    return { allowed: false, reason: 'MISSING_IDENTITY' };
  }
  if (context.tenantId !== context.actorTenantId) {
    return { allowed: false, reason: 'CROSS_TENANT_DENIED' };
  }
  if (!permissions[context.role]?.includes(action)) {
    return { allowed: false, reason: 'ROLE_DENIED' };
  }
  if (context.role === 'WORKER' && context.assignedActorId !== context.actorId) {
    return { allowed: false, reason: 'NOT_ASSIGNED' };
  }
  if (context.role === 'FIELD_SUPERVISOR' && !context.supervisionScopeDeviceIds?.includes(context.deviceId)) {
    return { allowed: false, reason: 'OUTSIDE_SUPERVISION_SCOPE' };
  }
  if (['location:read', 'session:request'].includes(action)) {
    if (!context.companyNoticeAcknowledged || !context.policyApproved) {
      return { allowed: false, reason: 'NOTICE_OR_POLICY_MISSING' };
    }
    if (!context.activeShift) {
      return { allowed: false, reason: 'OUTSIDE_ACTIVE_SHIFT' };
    }
  }
  if (action === 'session:request' && !context.sessionVisibleToWorker) {
    return { allowed: false, reason: 'SESSION_MUST_BE_VISIBLE' };
  }
  if (action === 'device:wipe' && !context.secondaryApproval) {
    return { allowed: false, reason: 'SECOND_APPROVAL_REQUIRED' };
  }
  if (action === 'investigation:read' && !context.authorizedCaseId) {
    return { allowed: false, reason: 'AUTHORIZED_CASE_REQUIRED' };
  }
  return { allowed: true };
}

/** Media capture only after a separate, visible and accepted session. */
export function authorizeFieldMediaStart(
  context: DeviceAccessContext,
): DeviceAccessDecision {
  const request = authorizeFieldDeviceAction('session:request', context);
  if (!request.allowed) return request;
  if (!context.sessionAccepted) {
    return { allowed: false, reason: 'SESSION_NOT_ACCEPTED' };
  }
  return { allowed: true };
}
