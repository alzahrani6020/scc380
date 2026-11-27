# SCC380 unified field operations — ORIGINAL acceptance ledger

This is the authoritative acceptance coverage matrix for the user-requested combined operations center. A CI pass on one module never satisfies the product as a whole.

**Evidence convention**: `PASS` = observed acceptance on the target environment; `CODE_ONLY` = implementation exists but not accepted on the target; `UNKNOWN` = no definitive verification; `BLOCKED` = external requirement not present; `FAIL` = observed test failure. Never promote an item from CODE_ONLY to PASS solely on build success.

| ID | Original acceptance requirement | Status on 2026-11-27 | Acceptance evidence required |
| --- | --- | --- | --- |
| A01 | Unified company and branch isolation | CODE_ONLY | Two actual companies, branch owners and users; forbidden reads and commands, including direct API and media URLs |
| A02 | Fully managed Android enrollment | BLOCKED | Google enterprise linked, QR used on actual company handset, provider DEVICE_OWNER and policy verified |
| A03 | Apple supervised iPhone enrollment | BLOCKED | Apple Business Manager, supervised ADE enrollment, vendor MDM and live device |
| A04 | Single onboarding flow and policy acknowledgement | CODE_ONLY | Employee's own linked account accepts current notice version, reboot and re-login persistence |
| A05 | Continuous device compliance and app policies | BLOCKED | Live MDM app install, noncompliance alert, offline/reboot and policy restoration |
| A06 | Field worker assignment, shifts and fleet integration | CODE_ONLY | Employee, branch, asset, vehicle and job relationships visible in a live work cycle |
| A07 | Location and route history during working hours | BLOCKED | Device-attested positions, accuracy and timestamps, active shift, no off-shift collection |
| A08 | Geofences and operational alerts | CODE_ONLY | Enter/exit alert tests on real routes and offline replay |
| A09 | Resilient offline events and sync | UNKNOWN | Airplane mode, time ordering, idempotency and backfill checks |
| A10 | Corporate device lock, wipe and lost mode | CODE_ONLY | Independently approved commands and verified provider/device receipts; remote wipe requires special recovery gate |
| A11 | Visible and accepted field media support | BLOCKED | Worker-side prompt, mic/camera OS indicator, valid WebRTC/ TURN, stop controls, audio sync |
| A12 | Multi-site CCTV unified wall | UNKNOWN | All requested cameras from different branches and sites, and disconnections |
| A13 | PTZ, zoom, camera cleaning and maintenance | UNKNOWN | Supported device PTZ and maintenance job workflow; unsupported controls disabled |
| A14 | Vehicle dash cams and video events | UNKNOWN | Fleet and vehicle-scoped camera feed, retained recorded incident, no cross-company leak |
| A15 | Recording, chain of custody and evidence access | UNKNOWN | Tamper evidence, role-controlled export, retention and legal hold |
| A16 | Corporate channels: email and official business messaging | BLOCKED | Authorized account integration, separate company account/recipient archives and logs |
| A17 | Procurement risk rules on live financial records | CODE_ONLY | PO/invoice/receipt matching, supplier changes, case review and false-positive checks |
| A18 | Investigation dashboard and human workflow | UNKNOWN | Authorized case creation, resolution, evidence, supervisor review and audit |
| A19 | Device asset, SIM, lifecycle, battery and service tracking | CODE_ONLY | Issue/return handset, battery and cellular diagnostics, support case, branch transfer |
| A20 | Full regression, isolated real backup restore, deploy and production acceptance | BLOCKED | Actual production-backup restore in isolation, migrations, role tests, live Android+iPhone, rollback, smoke checks |

## Current evidence (not full acceptance)

- GitHub Actions API/Web/surveillance/isolated test-PostgreSQL previously passed at commit `0d2ecf150118358fee419b9d04f1abbbf9289562`.
- PR #261 contains company device inventory, assignment, notice, shifts, basic procurement rules, Android Management API adapter, Android enrollment and verification, and the limited approved LOCK dispatch workflow.
- The provider workflow distinguishes provider acceptance and operation completion from an independently witnessed physical device state.
- The latest changes require their **own** CI pass. No live Android or iPhone, provider account, real camera signal or production database migrations were verified.
- Never disclose or monitor private personal conversations or activate covert audio/video. Authorized company channels and visible device sessions only.

## Mandatory release gate

**DO NOT MERGE / DO NOT CLAIM COMPLETE** until every applicable acceptance row is PASS or a requirement is explicitly removed by the user. Even successful CI is only one evidence layer. Real device, real company, recovery and production verification remain separate gates. Keep external connection blockers explicit; do not create fake accounts, tokens, enrollments or provider receipts.

## Work added in this round (not yet accepted)

- Tenant-authenticated `GET /field-operations/overview` joins read-only camera, site, gateway, device, maintenance, incident and queued command metadata in one response, each Prisma query scoped by the JWT tenant.
- Arabic `/field-devices` now displays multi-site/branch connectivity summaries, device readiness, operational incidents and alerts for stale devices, gateway heartbeats and offline/stale cameras.
- The two-company PostgreSQL device E2E test includes overview isolation; the unit test rejects unauthorized users before database reads.
- The alert module provides **read-time warnings**, not persisted cases, geofences, push notifications, playable video, or physical device controls. A08 remains CODE_ONLY and incomplete.
- The latest commit requires its own GitHub Actions acceptance. Do not reuse old CI success or assume missing heartbeat is equivalent to documented device malfunction.
