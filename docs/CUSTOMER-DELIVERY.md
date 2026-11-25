# SCC380 customer-owned installation — CANDIDATE ONLY

This is a **new isolated installation path**, not a certified downloadable commercial release. Never attach an existing production or customer database to the current startup migration script.

## Operator steps

1. Use a complete approved source snapshot, including lockfile, with Docker Compose v2. Configure a private HTTPS reverse proxy for `127.0.0.1:3000`. The production refresh cookie requires HTTPS.
2. Copy `infrastructure/docker/prod/.env.example` to `infrastructure/docker/prod/.env`. Generate independent random DB password (20+ characters) and JWT secret (32+ characters); percent-encode any reserved password characters in both database URLs. Do not reuse production credentials or include this private file in an archive.
3. Set the public HTTPS origin and the actual authorized customer owner email. Do **not** use `scc380-api.onrender.com` as the customer API endpoint.
4. Run `python3 infrastructure/docker/prod/preflight.py` and `docker compose --env-file infrastructure/docker/prod/.env -f infrastructure/docker/prod/docker-compose.yml config --quiet`. Stop at any failure.
5. With a verified NEW/EMPTY installation only, run `docker compose --env-file infrastructure/docker/prod/.env -f infrastructure/docker/prod/docker-compose.yml up --build -d`. The existing API Dockerfile runs `baseline-and-migrate.cjs` at startup: do not run it on an unreviewed existing database.
6. Configure HTTPS then test the /ready API in the Docker network, real login, owner role, tenant creation and isolation, file approvals, partial/full delivery, persistence and logout/relogin.
7. Back up the isolated customer's PostgreSQL volume using a consistent `pg_dump` and restore onto a second isolated DB. Verify SHA-256, schema, representative row counts and retrievals. Store the encrypted copy outside the host. Document a separate upgrade/rollback process.

## Release gates not yet proven
- Docker images built and started successfully from the repository revision.
- Migrations and fresh tenant/owner bootstrapping in a clean DB.
- Customer-specific mail, OAuth, ZATCA, file storage and other integrations.
- Complete authenticated UI, CRM/ERP/HR/POS, owner approvals and tenant isolation.
- Actual backup/restore, monitoring and recovery.
- Commercial licensing, customer rights to source, distributable package and installation support.

**Status: PARTIAL. No production data has been copied. Do not sell as an accepted turnkey release.**
