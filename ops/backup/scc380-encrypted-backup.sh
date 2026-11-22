#!/usr/bin/env bash
# SCC380 encrypted PostgreSQL backup. No plaintext dump is written to disk.
set -Eeuo pipefail
umask 077

die() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "Missing command: $1"; }
for c in pg_dump gpg aws sha256sum mktemp stat; do need "$c"; done
for v in PGHOST PGPORT PGUSER PGDATABASE PGPASSWORD BACKUP_S3_BUCKET BACKUP_GPG_RECIPIENT; do
  [[ -n "${!v:-}" ]] || die "Missing required configuration: $v"
done
[[ "${PGDATABASE}" == "scc_main_qbf1" ]] || die "Database name mismatch: refusing backup"
[[ "${PGSSLMODE:-require}" != "disable" ]] || die "TLS must not be disabled"
export PGSSLMODE="${PGSSLMODE:-require}"
[[ -z "${PGPASSWORD}" ]] && die "Empty password"
# The encryption key must already be imported into the isolated runner's GPG keyring.
gpg --batch --list-keys "$BACKUP_GPG_RECIPIENT" >/dev/null 2>&1 || die "GPG recipient unavailable"
aws s3api head-bucket --bucket "$BACKUP_S3_BUCKET" >/dev/null || die "Backup bucket inaccessible"
# Refuse publicly exposed upload by requiring bucket-level public-access blocking.
block="$(aws s3api get-public-access-block --bucket "$BACKUP_S3_BUCKET" --query 'PublicAccessBlockConfiguration' --output json 2>/dev/null)" || die "S3 PublicAccessBlock missing"
[[ "$block" == *'"BlockPublicAcls": true'* && "$block" == *'"IgnorePublicAcls": true'* && "$block" == *'"BlockPublicPolicy": true'* && "$block" == *'"RestrictPublicBuckets": true'* ]] || die "S3 public access block is not fully enabled"
work="$(mktemp -d)"
cleanup() { rm -f -- "$work/archive.pgdump.gpg"; rmdir -- "$work" 2>/dev/null || :; }
trap cleanup EXIT
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
key="scc380/postgres17/$stamp-${BACKUP_RUN_ID:-manual}.pgdump.gpg"
# Non-interactive public-key encryption, and a single PostgreSQL consistent snapshot.
pg_dump --format=custom --no-owner --no-privileges --file=- \
  | gpg --batch --yes --trust-model always --recipient "$BACKUP_GPG_RECIPIENT" --encrypt --output "$work/archive.pgdump.gpg"
[[ -s "$work/archive.pgdump.gpg" ]] || die "Encrypted archive missing or empty"
local_sha="$(sha256sum "$work/archive.pgdump.gpg" | cut -d ' ' -f1)"
local_bytes="$(stat -c %s "$work/archive.pgdump.gpg")"
# Require bucket encryption independently of the GPG payload.
aws s3api put-object --bucket "$BACKUP_S3_BUCKET" --key "$key" \
  --body "$work/archive.pgdump.gpg" --server-side-encryption AES256 \
  --metadata "sha256=$local_sha,pgdatabase=scc_main_qbf1,postgres-major=17" >/dev/null
remote_bytes="$(aws s3api head-object --bucket "$BACKUP_S3_BUCKET" --key "$key" --query ContentLength --output text)"
remote_sha="$(aws s3api head-object --bucket "$BACKUP_S3_BUCKET" --key "$key" --query Metadata.sha256 --output text)"
[[ "$remote_bytes" == "$local_bytes" && "$remote_sha" == "$local_sha" ]] || die "Remote metadata/size verification failed"
printf 'STATUS: UPLOADED_ENCRYPTED_NOT_RESTORED\nS3_KEY: %s\nSHA256: %s\nBYTES: %s\n' "$key" "$local_sha" "$local_bytes"
printf 'REMAINING: independent download, SHA256 comparison and PostgreSQL 17 restore verification\n'
