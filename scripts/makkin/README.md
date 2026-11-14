# Makkin Acceptance Engine v4

This folder provides **self-built**, offline safety and acceptance tooling for SCC380. It does not create or buy a service, does not connect to production, and does not deploy.

## Files

- `makkin-acceptance-v4.ps1` — SHA-pinned detached-worktree build and optional PostgreSQL 17 estate/HR E2E tests. Applies migrations to a disposable localhost-only container; checks whole-schema drift using Prisma and **does not use db push**. Restores inherited environment variables.
- `backup-restore-validator.ps1` — restores a **user-supplied** pg_dump custom/tar archive to a one-time `--network none` PostgreSQL 17 container, checks restored table count, removes the container. Never collects the backup from production.
- `production-schema-inventory.sql` — read-only catalog inventory of property tables, constraints, indexes and `_prisma_migrations`. It must be executed separately through an **approved private, least-privilege connection**. It is not run by the local acceptance engine.

## Prerequisites

Windows PowerShell 5.1+ or PowerShell 7, git, Node >=20, Corepack with pnpm 8.15.0, Docker Desktop for DB suites; the expected Git SHA must be read from the exact target PR branch.

## Example

```powershell
cd C:\Users\vip\scc380
.\scripts\makkin\makkin-acceptance-v4.ps1 -Repo 'C:\Users\vip\scc380' -Branch 'fix/real-estate-verified-main-20261114' -ExpectedCommit '<verified-40-character-head-SHA>' -RunDatabaseTests
```

```powershell
.\scripts\makkin\backup-restore-validator.ps1 -BackupFile 'C:\safe\verified-backup.dump'
```

## Evidence and gates

Each script produces a `result.json` file and logs in an isolated temp evidence directory. **PARTIAL** is the maximum result of the local engine even if every isolated test succeeds, because that does not prove production readiness. `FAIL` means a local gate failed and `BLOCKED` means the run could not complete. Review `functional` and `schemaDrift` individually. A successful archive restore does not establish backup freshness or origin.

**Production STOP requirements:** verify the actual Render `scc380-db` metadata and applied migration history, independently establish a recent restorable backup, reconcile global schema drift safely on a restored copy, prove full CI acceptance and authenticated real-estate/accounting operations on the deployed version. Do not apply migrations or merge PR #184 while requirements remain unmet.

## Limitations

These scripts have not been executed under the user's Windows PowerShell + Docker environment by their author. GitHub-hosted build checks do not execute the PowerShell engine. Avoid logging connection credentials or running inventory in publicly accessible CI.

## Safety

Never provide a production `DATABASE_URL` to the isolated engine; it sets its own disposable database URL only after the Docker test container is ready. The inventory SQL is read-only and must not be confused with permission to modify the production database.
