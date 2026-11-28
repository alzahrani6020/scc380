#!/usr/bin/env bash
# Restore verifier: only an explicit, empty local PostgreSQL 17 test database.
# Never execute this script on the production runner.
set -Eeuo pipefail
umask 077
die() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
for c in aws gpg pg_restore psql sha256sum mktemp; do
  command -v "$c" >/dev/null 2>&1 || die "Missing command: $c"
done
for v in BACKUP_S3_BUCKET BACKUP_S3_KEY EXPECTED_SHA256 PGHOST PGPORT PGUSER PGDATABASE PGPASSWORD; do
  [[ -n "${!v:-}" ]] || die "Missing required setting: $v"
done
[[ "${RESTORE_ISOLATED_ACK:-}" == "YES" ]] || die "Restore isolation confirmation missing"
[[ "$PGHOST" == "127.0.0.1" || "$PGHOST" == "localhost" || "$PGHOST" == "::1" ]] || die "Restore host must be loopback"
[[ "$PGDATABASE" == "scc380_restore_acceptance" ]] || die "Unexpected restore database"
[[ "$PGPORT" =~ ^[0-9]+$ ]] || die "Invalid PostgreSQL port"
[[ "$EXPECTED_SHA256" =~ ^[0-9a-fA-F]{64}$ ]] || die "Expected checksum must be SHA256"
[[ "$BACKUP_S3_KEY" == scc380/postgres17/*.pgdump.gpg ]] || die "Unexpected backup key"
server_version="$(psql -XAtqc "SHOW server_version_num")"
[[ "$server_version" =~ ^17[0-9]{4}$ ]] || die "Restore requires PostgreSQL 17"
actual_db="$(psql -XAtqc "SELECT current_database()")"
[[ "$actual_db" == "scc380_restore_acceptance" ]] || die "Database identity mismatch"
# Do not auto-create, drop or reset schemas, and reject nonempty user schemas.
existing="$(psql -XAtqc "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND c.relkind IN ('r','p','v','m','S','f')")"
[[ "$existing" == "0" ]] || die "Restore destination is not empty"
work="$(mktemp -d)"
trap 'rm -rf -- "$work"' EXIT
aws s3api get-object --bucket "$BACKUP_S3_BUCKET" --key "$BACKUP_S3_KEY" "$work/archive.gpg" >/dev/null
printf '%s  %s\n' "$EXPECTED_SHA256" "$work/archive.gpg" | sha256sum -c - >/dev/null || die "SHA256 mismatch"
gpg --batch --yes --decrypt --output "$work/archive.pgdump" "$work/archive.gpg"
pg_restore --list "$work/archive.pgdump" > "$work/toc.txt"
[[ -s "$work/toc.txt" ]] || die "Empty archive TOC"
pg_restore --exit-on-error --no-owner --no-privileges --dbname "$PGDATABASE" "$work/archive.pgdump"
tables="$(psql -XAtqc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")"
[[ "$tables" =~ ^[0-9]+$ && "$tables" -gt 0 ]] || die "No tables restored"
printf 'STATUS: RESTORED_TO_ISOLATED_POSTGRES17\nTABLES: %s\n' "$tables"
printf 'REMAINING: Compare source counts/constraints and verify application semantics before production changes\n'
