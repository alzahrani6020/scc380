# SCC380 Field Device Command Center — implementation and acceptance contract

Status: **Foundation in progress; no device integration or production acceptance verified.**

## Scope and boundaries

One-time **company device enrollment** and policy acknowledgment, ongoing corporate device management, scheduled work-shift location tracking, geofences, task assignments, safety/SOS, device health and compliance, enterprise messaging integration, anti-fraud purchase controls, documented video assistance, immutable audit, tenant isolation and Apple/Android capability matrices.

An enrollment acknowledgment is **not** a standing authorization for covert microphone/camera capture, personal WhatsApp/social media extraction, or unseen remote screen control. Media capture always needs a visible accepted session. Company communication records must come through officially integrated company channels, not scraping personal applications.

## Existing SCC380 anchors (main, checked 2026-11-27)

- NestJS API in `apps/api`; main `AppModule` loads Fleet, HR, Supplier, Finance, Surveillance and Compliance modules.
- Prisma multi-tenant schema at `packages/database/prisma/schema.prisma`, which already includes Tenant, Employee, Vehicle, Supplier, PurchaseOrder and Surveillance models.
- Next.js web application in `apps/web`.
- The first code added under `apps/api/src/field-devices` is a pure policy function, **not a live endpoint**.

## Data contracts (migration required, do not deploy without schema review)

1. `ManagedDevice(id, tenantId, branchId?, employeeId?, platform, mdmProvider, mdmDeviceId, assetTag, state, lastSeenAt, policyVersion, enrolledAt, retiredAt?)`
2. `DeviceAssignment(id, tenantId, deviceId, employeeId, startedAt, endedAt?, receiptVersion)`
3. `DevicePolicy(id, tenantId, policyVersion, locationSchedule, noticeVersion, retentionRules, approvedBy)`
4. `DeviceTelemetry(id, tenantId, deviceId, recordedAt, receivedAt, battery?, connectivity, integrity, source)`
5. `DeviceShift(id, tenantId, deviceId, startedAt, endedAt?, workOrderId?)`
6. `DeviceLocation(id, tenantId, deviceId, shiftId, recordedAt, receivedAt, accuracyMeters, lat, lon, source)`
7. `DeviceCommand(id, tenantId, deviceId, action, requestedBy, approvedBy?, status, idempotencyKey, providerReceipt?, createdAt, completedAt?)`
8. `DeviceMediaSession(id, tenantId, deviceId, shiftId, requestedBy, purpose, visibleAt?, acceptedAt?, endedAt?, recordingPolicy)`
9. `DeviceAccessAudit(id, tenantId, actorId, deviceId?, action, result, reason, occurredAt, correlationId)`
10. `BusinessCommunicationRecord(id, tenantId, businessAccountId, supplierId?, externalMessageId, receivedAt, retentionClass)`
11. `ProcurementRiskCase(id, tenantId, supplierId?, purchaseOrderId?, riskRules, humanDisposition, assignedInvestigatorId?)`

Use tenant-bound foreign keys and per-tenant lookup enforcement. Keep raw media and access tokens outside audit records. Protect location and evidence with restricted storage and retention jobs. Avoid linking worker privacy records with fraud cases absent documented legal basis.

## Enrollment and operations

- **Android:** Android Enterprise Fully Managed or Dedicated Device, via an approved EMM/MDM integration. Enroll with QR or zero-touch; device must be on the supported capability matrix.
- **iPhone:** Apple Business Manager + Automated Device Enrollment + Supervised MDM; no generic remote control of apps and private chats.
- One-click **admin experience** may initiate an enrollment workflow; it cannot bypass OS setup, required MDM prerequisites, or worker notice.
- App installation, device compliance, supported policy changes and health monitoring continue during the assignment. Location tracking is limited to active scheduled assignments and relevant authorized purposes.
- Admin screen must represent each feature as SUPPORTED, REQUIRES_INTERACTION, UNSUPPORTED or NOT_CONFIGURED; never show an inert action as enabled.
- Remote wipe requires a second independent approver; all device operations are asynchronous and must report provider receipts before success.
- Out-of-service/lost devices should revoke business tokens first and then use provider-supported lock/wipe under approved policy.

## Server-side requirements

Every endpoint must: authenticate, derive tenant from the authenticated membership, authorize per action and resource, validate device ownership and shift, rate-limit access, log allow/deny, enforce provider credentials via secret management, use idempotency keys for mutating operations, and return truthful async command status. Build API under a dedicated module without changing existing surveillance or finance routes.

Proposed endpoints:
- `GET /field-devices`, `POST /field-devices/enrollments`, `GET /field-devices/:id`
- `POST /field-devices/:id/commands`, `GET /field-devices/:id/telemetry`
- `GET /field-devices/:id/locations`, `POST /field-device-sessions`
- `POST /field-device-sessions/:id/accept`, `POST /field-device-sessions/:id/end`
- `GET /procurement-risk-cases`

Enforce deny-by-default when provider, role, tenant, device state, shift, notice, or approval cannot be verified.

## Media, investigations and fraud prevention

For live sessions, use WebRTC with TURN and short-lived session authorization, require a visible and accepted worker-side prompt, indicate live recording/sound, and end session on permission or shift expiry. Recording is disabled by default unless an explicitly approved policy and lawful purpose apply.

Corporate WhatsApp Business Platform/email integration should archive **only business-account traffic processed through authorized APIs**. Do not claim this can read all WhatsApp chats on a handset. For procurement: use segregation of duties, purchase-order/invoice/receipt matching, independently verified supplier-bank-change approvals, suspicious split-purchase detection, and human case review. Do not infer employee guilt from a scoring rule.

## Acceptance gates (none yet proven)

1. Enroll/unenroll real Android and supervised iPhone into a test tenant. Verify policies after reboot and failed connectivity.
2. Two real test tenants (A,B) with distinct administrators/devices: verify A cannot read or command B via direct API and media signaling.
3. Worker notice version recorded; active shift locations update accurately with timestamps; off-shift location access and ingestion blocked by policy, verified on actual devices.
4. WebRTC session cannot start without worker-facing notification and acceptance; ends when authorization expires; mic/camera OS indicators visible.
5. Command lifecycle: queued -> provider accepted -> device confirmed (or explicit error/timeout), with audit. Verify dual approval for wipe.
6. Provider API token expiry/revocation and webhook signature replay protection.
7. Corporate message ingestion requires documented source-account authorization and tenant isolation.
8. Procurement tests: duplicate invoice, supplier bank-account change, split purchase, suspicious bids; no automatic sanctions.
9. Restore test on isolated backup and migration rollback plan, security and retention reviews, performance measurement with realistic devices.
10. Production deployment verification with reproducible evidence; closing a PR or reporting HTTP 200 does **not** meet acceptance.

## Delivery order

1. Approval of provider/capability matrix and data protection basis; schema and tenant-bound API.
2. Android/iOS MDM adapter and enrollment, assignments, compliance and command lifecycle.
3. Field app location/tasks/geofence and offline synchronization.
4. Visible WebRTC session service and provider-backed media tests.
5. Official company communications, procurement risk rules and investigation UI.
6. Full E2E, database restore/isolation, device tests and controlled production release.

No live deployment, external MDM account provisioning, personal-content collection or production migration is authorized by this document.
