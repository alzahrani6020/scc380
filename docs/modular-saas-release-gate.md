# BONDS / MAKKIN — Modular SaaS release gate

**Status: NOT READY FOR PRODUCTION.** This branch adds a non-breaking eleven-product registry and a pure fail-closed entitlement evaluator. Neither is wired to actual request authorization, persisted in a new entitlement table, or connected to payment activation. Do not sell or publish these as working independent products.

## Non-negotiable acceptance
- [ ] Preserve every existing page, controller, workflow, record and integration.
- [ ] Database-resolved active tenant + workspace membership, never a client-supplied tenant header alone.
- [ ] Persist one independently managed entitlement per tenant/product, with validity window, seats/branches/limits, trial, cancellation, change history and audit.
- [ ] An authenticated server guard checks **both** role permissions and database-backed product entitlements on **every** protected controller/endpoint, including exports, jobs, files, background processing and WebSocket handlers.
- [ ] Do not silently turn on fail-closed product enforcement for existing tenants before mapping grandfathered rights and verifying migrations.
- [ ] Shared authentication, identity, workspaces, roles, basic notifications, basic analytics and audit remain accessible regardless of purchased applications.
- [ ] Cover all eleven commercial products: CRM, HR, Real Estate, Fleet, Sales, Purchasing, Inventory, Finance, Accounting, Projects, Governance/Compliance.
- [ ] Validate overlapping routes, e.g. finance vs accounting; HR governance vs cross-company governance; purchasing vs finance purchase orders; projects vs CRM project links. A path prefix is not sufficient.
- [ ] Independent UI/navigation, create/read/update/delete flows and role-specific permissions per product; hide inaccessible routes but rely on API enforcement.
- [ ] Product-specific pricing comes from audited server catalog, not UI assumptions; support one, multiple and all products.
- [ ] Activation and cancellation occur through authorized tenant owners/billing administrators; prevent ordinary users from creating their own paid entitlements.
- [ ] Integrations retain event ownership, idempotency, ledger posting integrity, and read-only summaries for customers lacking a full neighboring application.
- [ ] Validate production-equivalent backup/rollback, Prisma migration drift, build, tests, negative authorization cases, real-tenant end-to-end journeys and mobile/RTL/English UX.
- [ ] Confirm actual deployment SHA, authenticated smoke results and complete release evidence before merging or publishing.

## Evidence collected
- `apps/api/src/app.module.ts` imports existing business modules.
- `apps/api/src/billing/subscriptions.service.ts` handles user/plan subscriptions, not product entitlements.
- `apps/api/src/auth/guards/permissions.guard.ts` validates role permissions but not commercial entitlement.
- `packages/database/prisma/schema.prisma` defines Tenant and Subscription; product entitlements are not modeled separately in inspected schema.
- `apps/web/src/components/layout/Sidebar.tsx` defines the existing pages for the modules; don't remove or replace them.

## Branch changes
- Non-breaking product registry, without prices or grants.
- Pure tenant/product entitlement evaluator with regression test source.
- No migration, no existing route/permission change, no deploy.

**Execution status:** SOURCE CHANGES WRITTEN / UNIT TESTS NOT RUN / AUTHORIZATION NOT WIRED / RELEASE BLOCKED.
