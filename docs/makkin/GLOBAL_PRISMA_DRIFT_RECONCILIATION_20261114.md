# SCC380 / Makkin — Global Prisma Drift Reconciliation (2026-11-14)

**Status: BLOCKED for production merge and migration.** This document records measured differences, not an approved deployment script.

## Reproducible evidence

- PR: #184, initial pinned functional Windows acceptance SHA: `f2c21a8f53331d9824569fcc254129a22ad1e602`.
- Production-independent GitHub Actions real-estate DB run: `43603579379`. Archive ID `14117266779`, `makkin-schema-drift-preview.sql`, created by applying checked-in migrations to disposable PostgreSQL 17 then running `prisma migrate diff --from-url ... --to-schema-datamodel ... --script`.
- Functional Windows evidence: API, Web, Database, Prisma generate, migration deploy and four real-estate E2E tests PASS. Whole schema drift **FAIL**, exit code **2** (actual difference). The generated SQL was **never executed**.
- Exact preview changes: 15 CreateEnum, 2 AlterEnum, 21 CreateTable, 13 AlterTable, 66 CreateIndex, 43 AddForeignKey, 5 DropIndex, 3 RenameIndex.

## Tables missing from migration-based disposable DB (not proof of production absence)

| Functional domain | Required by current Prisma model but not produced by migration history |
| --- | --- |
| Tax / privacy / organization | `zatca_credentials`, `data_subject_consents`, `branches`, `alerts` |
| Procurement | `purchase_orders` |
| Fleet | `drivers`, `fleet_maintenances`, `fleet_fuel_logs`, `vehicle_gps_logs`, `driver_compliances`, `fleet_violations`, `trip_manifests` |
| Project management | `projects`, `tasks` |
| AI / templates | `ai_conversations`, `ai_messages`, `templates` |
| Point of sale | `pos_sessions`, `pos_orders`, `pos_order_items`, `pos_payments` |

## Known risky operations requiring separate review

- **DROP INDEX (5)**: `invoices_tenantId_currency_idx`, `journal_entry_headers_transactionCurrency_idx`, `payments_tenantId_currency_idx`, `supplier_invoices_tenantId_currency_idx`, `supplier_payments_tenantId_currency_idx`. These may be important for query plans; do not execute or remove solely to make Prisma drift pass.
- **DROP DEFAULT (12)** on `updatedAt` fields: `accounting_schedules`, `budget_lines`, `budget_plans`, `cost_centers`, `exchange_rates`, `fixed_asset_categories`, `fixed_assets`, `product_categories`, `products`, `stock_transfers`, `vat_returns`, `warehouses`. Removing defaults may break legacy writes. Do not apply without tested client behavior.
- **43 foreign keys, 66 new indexes**, some on already-existing accounting and logistics tables: need duplicate/orphan-reference checks, locking impact and tenant isolation review.
- Two existing enum alterations must be verified against actual data and deployed binary compatibility. Preview also alters `vehicles` columns.

## No-guess reconciliation procedure

1. Identify exact production Render PostgreSQL instance and deployed API commit/image, then export **read-only metadata** using `scripts/makkin/global-schema-readonly-inventory.sql` and `production-schema-inventory.sql` via an authorized **private** connection. Metadata is sensitive operational material; keep privately, never upload to public CI.
2. Establish a current production-origin custom-format pg_dump in controlled encrypted storage and verify an offline PostgreSQL 17 restore through `backup-restore-validator.ps1`. Confirm backup time, consistency, role permissions, table counts, critical relationships and data; table count alone does not prove full business recovery.
3. For each domain, compare restored production schema, migration history and Prisma schema. Identify objects already in production, failed/incomplete migrations, existing enum values, indexes, unique constraint duplicates and foreign-key orphans. No `db push`, no baseline stamping without independent proof.
4. Produce one reviewed, additive-first, dependency-ordered migration per isolated domain. Avoid combining unrelated financial indexes/default removals with Makkin's property migration. Test on both fresh migrated DB and an **offline restore of actual production**, with a measured rollback and representative read/write E2E tests.
5. Gate promotion on zero drift, 100% relevant acceptance tests, protected data, correct Render production image SHA, and authenticated production smoke after deployment. Until then, keep PR #184 Draft; no production DDL, merge or deploy.

## Evidence boundaries

Render hosted MCP read-only PostgreSQL access was refused because production `ipAllowList=[]`. Do not open external network access to force a test. Render service logs showing "No pending migrations to apply" concern the **currently deployed migration folder**, not the proposed Prisma model and are not proof of full schema match.

**STATUS: PARTIAL** — functional property acceptance passes in isolation; global drift and production recovery gates remain blocked.


## Production-origin offline restore: evidence received 2026-11-15

The operator ran the guarded backup tool and locally restored the actual production-origin backup.

- Secure local evidence directory: `C:\Users\vip\makkin-secure-backup\makkin-f4e347a80ff9`. **Private; never commit or upload.**
- Output: `drift-result-d1deb7156b63.json`, pinned review SHA `468f35baf7495ad924f8377c29c7484035b796a7`.
- `BACKUP=PASS_VERIFIED_HASH`, `RESTORE=PASS_DISPOSABLE_CLONE`, `DRIFT=PRESENT_REVIEW_REQUIRED`, `STATUS=PASS_ANALYSIS_ONLY`.
- SQL review file: `production-vs-schema-d1deb7156b63.sql`. Operator reported exactly 5 `DROP INDEX`, 5 `ALTER COLUMN "updatedAt" DROP DEFAULT`, 1 `CREATE TABLE "rent_collections"`, 4 index creations, and 2 FK additions. These are **SQL preview statements, not approved changes**.
- All 5 dropped-index suggestions are **financial**, not the real-estate fix. Preserve them. Preserve existing financial defaults until dependent write paths are evaluated.
- This restore lacks `rent_collections` although PR #184 contains `20261114043000_rent_collections_ledger` and `20261114111500_rent_collection_fk_name_reconcile` migration files. This means production's applied migration history and/or database objects do **not** match the reviewed PR branch, and the greenfield baseline intentionally aborts if old estate tables exist. **Do not run `prisma migrate deploy` against production for this PR.**
- The read-only inspector `scripts/makkin/production-restore-estate-readonly-gate.sql` was added to inspect the restored clone: existing objects, migration ledger, FK/index names, defaults, and enum values. It is NOT an approval for DDL.

Next safe engineering decision: inspect the full local diff and the restored `_prisma_migrations` history; design a separate additive migration for `rent_collections` with prerequisite checks (existing `rent_payments`, tenant-consistency, preexisting index names, privileges). Test on a **fresh disposable restore** and a **migration-applied disposable DB**. The historical greenfield migration cannot be applied to an estate production schema, and must be replaced/segregated via an approved history reconciliation, not marked applied blindly. Keep PR Draft, CI drift checks enabled, and production unchanged.

Note: the local evidence output is reported by the operator; the private dump and full SQL diff are not available to GitHub or this reviewer, so precise production migration ledger compatibility and approval remain UNKNOWN.
