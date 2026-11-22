#!/usr/bin/env bash
# Verify an encrypted SCC380 backup by downloading, decrypting and restoring it
# ONLY to an explicitly named non-production PostgreSQL 17 database.
set -Eeuo pipefail
umask 077
die() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
for c in aws gpg pg_restore psql sha256sum mktemp; do command -v "$c" >/dev/null || die "Missing $c"; done
for v in BACKUP_S3_BUCKET BACKUP_S3_KEY BACKUP_GPG_RECIPIENT RESTORE_DATABASE_URL EXPECTED_SHA256; do
  [[ -n "${!v:-}" ]] || die "Missing $v"
done
[[ "$RESTORE_DATABASE_URL" != *scc_main_qbf1* ]] || die "Production name in restore URL"
[[ "$RESTORE_DATABASE_URL" != *"render.com"* ]] || die "Remote Render URL forbidden for restore"
[[ "$RESTORE_DATABASE_URL" == *"127.0.0.1"* || "$RESTORE_DATABASE_URL" == *"localhost"* ]] || die "Restore must be local"
work="$(mktemp -d)"
trap 'rm -rf -- "$work"' EXIT
aws s3api get-object --bucket "$BACKUP_S3_BUCKET" --key "$BACKUP_S3_KEY" "$work/archive.gpg" >/dev/null
echo "$EXPECTED_SHA256  $work/archive.gpg" | sha256sum -c - >/dev/null || die "Encrypted file SHA256 mismatch"
gpg --batch --yes --decrypt --output "$work/archive.pgdump" "$work/archive.gpg"
pg_restore --list "$work/archive.pgdump" > "$work/toc.txt"
[[ -s "$work/toc.txt" ]] || die "Empty PostgreSQL archive listing"
# The destination must already be an isolated, empty database; never auto-drop.
existing="$(psql "$RESTORE_DATABASE_URL" -XAtqc "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")"
[[ "$existing" == "0" ]] || die "Restore destination is not empty"
pg_restore --exit-on-error --no-owner --no-privileges --dbname "$RESTORE_DATABASE_URL" "$work/archive.pgdump"
tables="$(psql "$RESTORE_DATABASE_URL" -XAtqc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")"
[[ "$tables" =~ ^[0-9]+$ && "$tables" -gt 0 ]] || die "No restored tables"
printf 'STATUS: RESTORED_TO_ISOLATED_DATABASE\nRESTORED_PUBLIC_TABLES: %s\n' "$tables"
printf 'NOTE: Table count alone is not complete data-parity acceptance.\n'
