# SCC380 Acceptance Engines (PowerShell + Node)

This package is a **read-only diagnostic and evidence runner**, not a substitute for an authorized real-session E2E test.

## Existing capabilities reused

- `apps/web/e2e/auth-cookie.mjs`: local HTTP cookie exchange / rotation regression.
- `apps/web/e2e/crm-ui.mjs`: existing CRM browser E2E.
- `.github/workflows/crm-browser-e2e.yml`: existing CI harness.

The new runner adds **DNS, TLS, HTTP, safe anonymous auth-route checks, optional browser login-page check, API image SHA comparison and JSON status evidence**. No packages are required for core probes.

## Run locally on Windows PowerShell

From a trusted checkout of `alzahrani6020/scc380`:

```powershell
powershell -NoProfile -File .\scripts\acceptance-engines.ps1 -ExpectedSha fb34b96f5f2310ba8db8a05a65fa148b45e97594 -SafeAuthProbes
```

Optional exact image read from Render's **get_service** API (do not guess a tag):

```powershell
powershell -NoProfile -File .\scripts\acceptance-engines.ps1 -ExpectedSha fb34b96f5f2310ba8db8a05a65fa148b45e97594 -ObservedApiImage 'ghcr.io/alzahrani6020/scc380-api-prod:fb34b96f5f2310ba8db8a05a65fa148b45e97594' -SafeAuthProbes
```

To use existing installed Playwright Chromium, add `-Browser`. The runner checks only the login page, and **never logs in**. No automatic package installs or CI workflow dispatches.

```powershell
node --test .\scripts\acceptance-engines.test.cjs
```

## Evidence contract

- JSON: `artifacts/acceptance/result.json` or `-Output` directory.
- `PASS` only if every required recorded assertion passes. A real token rotation is **always UNKNOWN** in this read-only runner.
- `FAIL` for a confirmed behavior mismatch, such as /api/auth/refresh returning 404.
- `BLOCKED` for network or execution limitations.
- `UNKNOWN` for missing evidence, such as real employee session continuation.
- Exit codes: 0 PASS, 1 FAIL, 2 PARTIAL (BLOCKED or UNKNOWN).

## Limits and safeguards

- Allowlisted hosts only; no custom arbitrary origins or credentials in URLs.
- Anonymous probes send deliberately invalid JSON or a GET without credentials. They do not create users, modify records or access actual employee accounts.
- No access token, refresh token, password, cookie or full HTTP response body is written to evidence.
- `--observed-api-image` is an **operator-supplied value**. An independent production attestation requires retrieving it directly from Render; avoid using an unverified manually typed value for final acceptance.
- Session E2E needs a separately provisioned least-privilege **test tenant/user**, safely controlled expiry or mock-time capabilities, and approval for production execution. Never use a real employee's secrets.
- The real-session acceptance gate must verify 401 -> secure refresh cookie -> rotated access -> retried CRM request, then logout/revocation, and maintain tenant isolation. Until that is observed, overall production acceptance remains PARTIAL.
- This runner does not deploy, run migrations, change Render configuration, or consume Vercel builds.
