# SCC380 P0 — Production database recovery acceptance

**Status: PARTIAL for real production.** A genuine 2026-11-23 production dump and isolated restore were previously verified through user-provided Windows/Docker execution evidence. They have NOT been rechecked independently from this session on 2026-11-27. Disposable `scc_test` CI is not a replacement for that real-production evidence.

## Verified infrastructure state (2026-11-27)

- Production Render DB is `scc380-db`, PostgreSQL 17 in Frankfurt, database `scc_main_qbf1`; currently reported `available`.
- External SQL access through hosted Render connector is blocked by the production database's **empty IP allowlist**. Do **not** open the allowlist globally or add unknown connector IP addresses.
- The current production API is a pinned image, `ghcr.io/alzahrani6020/scc380-api-prod:c17f6f5022d0e907fdedb600709faf2485898edb`; no source PR update changes that image.
- The current Render web build pipeline is exhausted for its billing period; new builds fail before compilation. Do not purchase capacity without authorization.
- `scripts/pos-production-backup-restore-verify.sh` exists and the existing API workflow runs a synthetic isolated backup/restore exercise. No independently inspected fresh real-production backup has yet been verified.

## Safety criteria for actual P0 acceptance

1. Confirm destination is a **distinct, isolated PostgreSQL instance** with no production credentials, network routing or live application connections. The script checks different server-side connection addresses/ports, but this is only a safety check, not independent proof of different underlying infrastructure.
2. Confirm destination database is empty and has no business data. The script **refuses to overwrite** an occupied database and never drops a database.
3. Confirm a restricted off-service durable backup storage target, encrypted at rest, accessible only to authorized recovery operators. Do not store credentials, backups or recovery keys in git/GitHub Actions artifacts, PRs, chat or public servers.
4. Use authorized local tooling or private network execution with Postgres 17 utilities, after separately identifying source and target. Keep database URLs private.
5. Record and independently verify archive SHA-256, inventory, migration history, tenant counts, orders and products after restore. Control counts are sanity checks, NOT complete row-by-row validation of a live changing source.
6. Test migration deploy on the **isolated restored target only**, then run tenant boundaries, role and sample read/write/reopen tests on the isolated database. No production migration until backup and rollback have been accepted.
7. Document sample data reconciliation, schema comparison, retention/restore location, actual RPO and RTO measured on the verified restored copy.
8. Close the recovery gate only after a real-production backup artifact, independent isolated restore, checks and repeatable evidence are available. Otherwise status remains UNKNOWN/BLOCKED.

## Preserved existing controls

The backup script rejects unexpected production source DB name, matching source/target DB names, non-empty restore target, missing SCC380 tables, malformed or empty archive, and archive/data restore mismatches. It now additionally checks server-side endpoint separation for `scc_main_qbf1`, multiple critical tables, and unfinished Prisma migrations. The disposable CI test intentionally sets `EXPECTED_SOURCE_DB=scc_test`.

This PR did not create, copy, access, overwrite, delete or restore a production backup. The historical 2026-11-23 production backup and offline restore predate this PR. No network allowlist, database permissions or production variables have been modified.

## Acceptance record

| Gate | Evidence | Status |
| --- | --- | --- |
| Production identity and hosting location | Render metadata | VERIFIED |
| Historical real production archive and SHA-256 (2026-11-23) | User-provided backup and hash output | HISTORICAL PASS |
| Sealed/off-site encrypted backup | `V:` was reportedly mounted, but current container binding and off-device copy are unverified | UNKNOWN |
| Historical isolated restore (2026-11-23) | User-provided offline Docker restore output | HISTORICAL PASS |
| Actual production archive restoration (2026-11-23) | Docker `scc380-restore-verify`, 109 restored tables | HISTORICAL PASS |
| Migration and all-role/two-company end-to-end testing on historical restored copy | Not demonstrated by the prior restore evidence | UNKNOWN |
| Synthetic PostgreSQL CI backup/restore | Workflow evidence on its latest green head only | TEST-ONLY |
| Web build/deploy | Render build-minute quota exhausted | BLOCKED |

**Do not classify production recovery as PASS until the still-outstanding freshness, migrations, role isolation, integrity and full recovery gates are verified. Do not erase the historical PASS evidence.**

## P0 scope and tenant-role findings

- The actual Prisma `UserRole` enum is `SUPER_ADMIN`, `ADMIN`, `MANAGER`, `USER`, `AUDITOR`, `READONLY`. **A separate `SUPERVISOR` role is absent**. Do not claim the user's requested supervisory acceptance is complete by renaming MANAGER without an explicit role/permissions mapping and E2E.
- In the branch, `TenantService.update` now denies MANAGER and USER as defense-in-depth even if a controller guard is bypassed. A two-company PostgreSQL test covers SUPER_ADMIN, ADMIN, MANAGER and USER scope; this is still test-environment evidence, not an authenticated browser session on production.
- P0 dashboard fail-closed zero-vs-unknown work is separate in PR #262, CI passed as of 2026-11-27; main/production confirmation remains pending.
- Vercel has READY deployments, but currently returned web/API deployment SHAs do not match the new P0 branches. Render web builds were blocked by depleted build minutes. Neither proves current P0 changes have shipped.
- **UI acceptance remains OPEN**: buttons, dropdowns, company creation/edit, record save/reopen and role-specific sessions must be validated on the actual published environment after safe release.

## P0 acceptance checkpoint — current implementation and evidence

| P0 requirement | Evidence | Status |
| --- | --- | --- |
| Safe recovery script | POS Backup Script Safety PASS on CI 46064850764 and 46066480872; production-name same-server denial tested | CODE + CI PASS |
| Genuine production archive & offline restore (2026-11-23) | Historical user-provided `V:` artifact SHA256 and 109-table offline Docker restore | HISTORICAL PASS (freshness UNKNOWN) |
| Fresh verified encrypted copy and restore/migration test | Current `V:` inaccessible here; Render direct SQL blocked by IP allowlist; no current isolated restore | BLOCKED |
| Authenticated two-company company selection | JWT guard rejects different `X-Tenant-Slug` after session verification. PostgreSQL session A -> B selector E2E in API Build Verify run 46066480872 | CODE + CI PASS |
| Four company roles and supervisor | SUPER_ADMIN/ADMIN/MANAGER/USER tests pass; separate SUPERVISOR enum and its production role UI acceptance absent | PARTIAL |
| All production UI actions, save/reopen and recovery | PR #262 dashboard truthfulness CI PASS; browser read tool lacks host permission; alternative browser blocked by service wallet | BLOCKED |
| Production API, web, data, camera health | Render service metadata available; production Vercel READY deployment SHA differs from P0 branches; actual authenticated data not checked | UNKNOWN |
| Safe release and regression | PR #262 and #263 unmerged; no production mutation; current head passes CI but no acceptance deployment | BLOCKED |

**Required next production acceptance evidence:** fresh encrypted production backup artifact and SHA256; isolated restore of latest data; migration rehearsals; real authenticated two-company role sessions; read/edit/save/reopen every P0 route on the exact deployed commit; rollback and endpoint data smoke. Keep P0 open until then.
