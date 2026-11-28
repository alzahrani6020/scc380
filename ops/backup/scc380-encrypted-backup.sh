#!/usr/bin/env bash
# SCC380: PostgreSQL 17 custom archive -> GPG public-key encryption -> private S3.
# The encrypted archive is staged temporarily; a plaintext dump is never staged.
set -Eeuo pipefail
umask 077
die() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
for c in pg_dump gpg aws sha256sum mktemp stat date openssl; do
  command -v "$c" >/dev/null 2>&1 || die "Missing command: $c"
done
for v in PGHOST PGPORT PGUSER PGDATABASE PGPASSWORD BACKUP_S3_BUCKET BACKUP_GPG_RECIPIENT; do
  [[ -n "${!v:-}" ]] || die "Missing required setting: $v"
done
[[ "$PGDATABASE" == "scc_main_qbf1" ]] || die "Unexpected database"
case "${PGSSLMODE:-require}" in require|verify-ca|verify-full) ;; *) die "Require authenticated or encrypted PostgreSQL TLS" ;; esac
export PGSSLMODE="${PGSSLMODE:-require}"
gpg --batch --list-keys "$BACKUP_GPG_RECIPIENT" >/dev/null 2>&1 || die "GPG public key unavailable"
aws s3api head-bucket --bucket "$BACKUP_S3_BUCKET" >/dev/null || die "Bucket inaccessible"
# Validate all four S3 block-public-access controls, without relying on JSON formatting.
block="$(aws s3api get-public-access-block --bucket "$BACKUP_S3_BUCKET" --query 'PublicAccessBlockConfiguration.[BlockPublicAcls,IgnorePublicAcls,BlockPublicPolicy,RestrictPublicBuckets]' --output text)" || die "Cannot verify S3 access block"
[[ "$block" == $'True\tTrue\tTrue\tTrue' ]] || die "S3 public access block incomplete"
work="$(mktemp -d)"
cleanup() { rm -f -- "$work/archive.pgdump.gpg"; rmdir -- "$work" 2>/dev/null || :; }
trap cleanup EXIT
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
run_id="${BACKUP_RUN_ID:-manual}"
[[ "$run_id" =~ ^[A-Za-z0-9_-]{1,64}$ ]] || die "Unsafe backup run identifier"
nonce="$(openssl rand -hex 16)" || die "Could not generate random backup identifier"
[[ "$nonce" =~ ^[0-9a-f]{32}$ ]] || die "Invalid random backup identifier"
key="scc380/postgres17/$stamp-$run_id-$nonce.pgdump.gpg"
# pipefail makes either PostgreSQL or encryption failure fatal.
pg_dump --format=custom --no-owner --no-privileges |
  gpg --batch --yes --trust-model always --recipient "$BACKUP_GPG_RECIPIENT" --encrypt --output "$work/archive.pgdump.gpg"
[[ -s "$work/archive.pgdump.gpg" ]] || die "Encrypted archive missing"
local_sha="$(sha256sum "$work/archive.pgdump.gpg" | cut -d ' ' -f1)"
local_bytes="$(stat -c %s "$work/archive.pgdump.gpg")"
# Atomic S3 create-if-absent: a concurrent or repeated upload must never replace an existing archive.
# Requires an AWS CLI/S3-compatible endpoint supporting If-None-Match: *; fail closed otherwise.
aws s3api put-object --bucket "$BACKUP_S3_BUCKET" --key "$key" \
  --if-none-match "*" --body "$work/archive.pgdump.gpg" --server-side-encryption AES256 \
  --metadata "sha256=$local_sha,pgdatabase=scc_main_qbf1,postgres-major=17" >/dev/null
remote_bytes="$(aws s3api head-object --bucket "$BACKUP_S3_BUCKET" --key "$key" --query ContentLength --output text)"
remote_sha="$(aws s3api head-object --bucket "$BACKUP_S3_BUCKET" --key "$key" --query Metadata.sha256 --output text)"
[[ "$remote_bytes" == "$local_bytes" && "$remote_sha" == "$local_sha" ]] || die "Object metadata verification failed"
printf 'STATUS: ENCRYPTED_OBJECT_UPLOADED_NOT_RESTORED\nS3_KEY: %s\nSHA256: %s\nBYTES: %s\n' "$key" "$local_sha" "$local_bytes"
printf 'NOTE: Object metadata is NOT independent integrity verification. Download, hash, decrypt and restore are mandatory.\n'
