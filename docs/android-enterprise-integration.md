# Android Enterprise integration — deployment and acceptance

**Current state**: API code implemented in PR #261. No Google organization, entitlement, service account or real handset is automatically provisioned by this repository.

## What is implemented

- `AndroidManagementAdapter` uses Google's official REST API (enterprise verification, one-time enrollment QR, read-only device discovery, provider-only LOCK/WIPE operation submission contract).
- `SCC380_ANDROID_MDM_TENANTS_JSON` binds authenticated SCC380 tenant IDs to *different* Google `enterprises/*` names and policies.
- Google credentials are acquired using Application Default Credentials or workload identity by `google-auth-library` on the server; no raw secret is put into tenant records.
- `GET /field-devices/android/connection` checks the actual enterprise API. `POST /field-device-enrollment/:deviceId/android` creates one single-use 30-minute enrollment QR for an authenticated company ADMIN.
- `POST /field-device-enrollment/:deviceId/android/verify` checks Google's device inventory for exactly one matching token asset tag, `DEVICE_OWNER`, `COMPANY_OWNED`, `ACTIVE`, matching applied policy, compliance and recent status. Until then the SCC380 asset is not marked MANAGED.
- The QR is returned only in a no-store authenticated response. Never log, persist, reuse, publicly share, or embed it in static pages.
- Existing `field-device-commands` endpoints still record approvals as `NOT_DISPATCHED`. The provider adapter contains command submission plumbing, but **no live command dispatcher is wired in**, because idempotent provider callbacks and final device receipts have not been built.

## Required one-time operator configuration

1. An eligible, approved Android Enterprise / Android Management API service with available device quota.
2. Each customer tenant must have its own authorized enterprise resource and an approved Android policy. Do **not** share tenants' enterprise resources.
3. Deploy server-only `SCC380_ANDROID_MDM_TENANTS_JSON` (JSON object keyed by real SCC380 tenant IDs):
   `{"<tenantId>":{"enterpriseName":"enterprises/<enterprise-id>","policyName":"enterprises/<enterprise-id>/policies/<policy-id>"}}`.
4. Grant the server runtime least-privilege Google service account access to the intended enterprise and supply workload identity / ADC without exposing key material in Git.
5. Confirm `GET /field-devices/android/connection` as the company administrator: status `PROVIDER_VERIFIED` only after an actual successful provider GET. All other tenant connections remain `NOT_CONFIGURED`.
6. In `/field-devices`, register the company-owned Android asset, select it and request a one-time QR; factory-reset/first-boot device must use the supported corporate enrollment process. Device setup requires the phone to be present and an operator to scan the QR.
7. Use the **Verify physical enrollment** button after provisioning. Only Google-confirmed fully managed, compliant, appropriately owned devices can change SCC380 status to MANAGED.
8. For offline, missing compliance, wrong tenant/enterprise, duplicate asset or wrong policy, fail closed and never say that the device is managed.

## Security and caveats

- Do not use Android corporate enrollment QR on personally owned devices. The policy uses `PERSONAL_USAGE_DISALLOWED` and is for full management.
- One initial policy acceptance does not authorize hidden mic/camera or personal-message access; any media session requires visible acceptance and OS permissions.
- Google command acceptance is not handset execution. Command completion requires polling `enterprises.devices.operations.get` or trusted provider lifecycle callbacks and a separate audited state machine before integration into live UI.
- Before production: validate isolated restored DB migrations, 2-company real-device authorization, lost-device controls, rollback procedure, compliance retention schedule, Android enrollment after reboot, worker acknowledgment and shift GPS.
- Apple Business Manager/Supervised MDM **is not connected**. iPhone provisioning has different Apple/vendor interfaces and must not pretend to use the Android QR route.

## Official Google references

- https://developers.google.com/android/management/provision-device
- https://developers.google.com/android/management/reference/rest/v1/enterprises.enrollmentTokens
- https://developers.google.com/android/management/reference/rest/v1/enterprises.devices
- https://developers.google.com/android/management/reference/rest/v1/enterprises.devices/issueCommand

**Do not merge as fully accepted** until an actual corporate Android and supervised iPhone pass the original field-device acceptance matrix.
