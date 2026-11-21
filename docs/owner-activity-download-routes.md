# SCC380 Owner Activity Console and Controlled Report Downloads

## Route inventory (PR #207)

| Route | Method | Caller | Function |
|---|---|---|---|
| `/owner/activity` | GET (Next.js) | `SUPER_ADMIN` (UI and API guarded) | Unlisted monitoring console and owner-grant controls |
| `/downloads/activity` | GET (Next.js) | Signed-in | Partial/full report request interface, payment reference verification |
| `/analytics/activity/event` | POST | Authenticated user | Record navigation in `/dashboard` and same-origin download-link requests |
| `/analytics/activity` | GET | `SUPER_ADMIN` | Tenant-aware audit overview; page events, sessions, login attempts |
| `/analytics/activity/owner/approvals` | GET | `SUPER_ADMIN` | Read owner authorization decisions |
| `/analytics/activity/owner/approve` | POST | `SUPER_ADMIN` | Grant/revoke by target user email and `PARTIAL`/`FULL` scope |
| `/analytics/activity/download-access` | GET | Authenticated | Inspect owner/purchase eligibility for current user |
| `/analytics/activity/export` | GET | `SUPER_ADMIN` OR `ADMIN`/`AUDITOR` with entitlement | Stream CSV with date filter (partial) or all permitted records (full) |

The API URLs are relative to the existing configured API base URL and CORS policy. The owner route is deliberately absent from the Sidebar navigation. **An unlisted URL is not an authorization mechanism; server-side role checks are mandatory.**

## Download authorization

- The owner role maps to existing `SUPER_ADMIN` for this implementation. No unverified email or ad-hoc browser value can grant the role.
- An `ADMIN`/`AUDITOR` request must meet one of the two independent gates:
  1. Owner approval stored as an append-only event in `audit_logs`, scoped to the approved user ID and tenant. Revocation writes a new event; the latest decision wins.
  2. A **paid** `Invoice` in the requesting user's tenant, addressed to a `Contact` with the same email as a **verified** signed-in user, and with completed `Payment` totals covering the invoice. It must contain the report SKU:
     - `SCC380-ACTIVITY-REPORT-PARTIAL`: permit only the selected period (maximum 31 days).
     - `SCC380-ACTIVITY-REPORT-FULL`: permit full export as well as partial.
- Paid status, an unverified browser claim, invoice number alone or unrelated subscription payments **must not** authorize downloads.
- Normal `USER` accounts are not granted an administrative audit report even if a payment exists. This is an intentional confidentiality restriction.
- The report SKU products and checkout/payment collection are **not** automatically provisioned by this feature. The paid path remains ineligible until an authorized setup establishes the products, invoicing and payment evidence.
- The export records initiation and streaming on the server, **not proof that the browser saved a local file**.

## Scope and results

- Partial CSV requires both `from` and `to` dates, up to 31 days inclusive by date-difference check.
- Full CSV does not accept a browser-provided limit, and paginates 500 events at a time, streaming all allowed records.
- The interactive owner preview is capped at 1000 events and 100 each of sessions/login attempts, with truncation signaled in the UI; the streamed export is **not** preview-capped.
- The dashboard records **signed-in `/dashboard` visits**, not anonymous public site traffic, and same-origin file-link clicks only. Programmatic file downloads outside these routes are **not comprehensively covered**.
- Existing download endpoints elsewhere in the product are **not retroactively gated by this PR**. A complete file-level rollout requires a documented inventory of protected resources and storage/response endpoints before enforcement.

## Acceptance checks required before production release

1. Web build and API build pass on the final PR SHA.
2. An unauthenticated caller gets `401` on owner/API endpoints; a `USER` gets `403` on exports.
3. One tenant cannot read or approve another tenant's events except the explicitly privileged owner role.
4. Partial download without dates, >31-day dates, or without eligible entitlement is denied.
5. Owner approval grants precise scope and revocation removes it. Paid invoices lacking matching SKU, verified email or completed payments are denied.
6. The full CSV is checked against >1000 real fixture events to prove completeness.
7. The downloaded CSV is validated as UTF-8, contains correct records, and does not execute spreadsheet formulas.
8. After merge and deployment, confirm route accessibility, audit events and download behavior against the actual production image.

No charge, product creation, or production database modification is performed by this PR.
