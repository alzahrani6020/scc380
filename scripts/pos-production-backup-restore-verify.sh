#!/usr/bin/env bash
# SCC380 POS: export production PostgreSQL and VERIFY restoration in a separate empty database.
# This script is MANUAL ONLY. It is not part of migrations, deployment, or app startup.
set -euo pipefail
umask 077

for tool in psql pg_dump pg_restore sha256sum mktemp; do
  command -v "$tool" >/dev/null 2>&1 || { printf 'FAIL: missing %s\n' "$tool" >&2; exit 2; }
done
: "${DATABASE_URL:?Set source DATABASE_URL privately}"
: "${RESTORE_DATABASE_URL:?Set an isolated EMPTY database URL privately}"
: "${BACKUP_DIR:?Set an off-service, durable backup directory}"
: "${EXPECTED_SOURCE_DB:=scc_main_qbf1}"

mkdir -p -- "$BACKUP_DIR"
[[ -d "$BACKUP_DIR" && -w "$BACKUP_DIR" ]] || { echo 'FAIL: backup destination unavailable' >&2; exit 2; }

source_db=$(psql -X -qAt -v ON_ERROR_STOP=1 "$DATABASE_URL" -c 'SELECT current_database()')
target_db=$(psql -X -qAt -v ON_ERROR_STOP=1 "$RESTORE_DATABASE_URL" -c 'SELECT current_database()')
if [[ "$source_db" != "$EXPECTED_SOURCE_DB" || -z "$target_db" || "$target_db" == "$source_db" ]]; then
  echo 'FAIL: source database identity mismatch or restore target is production' >&2
  exit 3
fi
# The real-production P0 acceptance requires physically separate database
# endpoints, not merely a different database name on the production server.
# Disposable CI databases intentionally share one Postgres container and do
# not qualify as production restore evidence.
if [[ "$EXPECTED_SOURCE_DB" == "scc_main_qbf1" ]]; then
  source_endpoint=$(psql -X -qAt -v ON_ERROR_STOP=1 "$DATABASE_URL" -c "SELECT coalesce(inet_server_addr()::text, '') || ':' || coalesce(inet_server_port()::text, '')")
  target_endpoint=$(psql -X -qAt -v ON_ERROR_STOP=1 "$RESTORE_DATABASE_URL" -c "SELECT coalesce(inet_server_addr()::text, '') || ':' || coalesce(inet_server_port()::text, '')")
  if [[ -z "$source_endpoint" || -z "$target_endpoint" ||
        "$source_endpoint" == ":" || "$target_endpoint" == ":" ||
        "$source_endpoint" == "$target_endpoint" ]]; then
    echo 'FAIL: production restore requires a distinct, verified PostgreSQL server endpoint' >&2
    exit 3
  fi
fi

# Prevent writing into a database containing application data. Do not drop anything.
target_tables=$(psql -X -qAt -v ON_ERROR_STOP=1 "$RESTORE_DATABASE_URL" -c "SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')")
if [[ "$target_tables" != "0" ]]; then
  echo 'FAIL: restore target is not empty; refusing overwrite' >&2
  exit 3
fi

tmp=$(mktemp "$BACKUP_DIR/.scc380-pos-XXXXXXXX.dump")
trap 'rm -f -- "$tmp"' EXIT
PGCONNECT_TIMEOUT=10 pg_dump --format=custom --no-owner --no-privileges --dbname="$DATABASE_URL" --file="$tmp"
[[ -s "$tmp" ]] || { echo 'FAIL: empty backup' >&2; exit 4; }
contents=$(pg_restore --list "$tmp")
for required in 'TABLE public tenants' 'TABLE public products' 'TABLE public pos_orders' 'TABLE public chart_of_accounts'; do
  # pg_restore listing has an owner column, so match the table name before owner.
  if ! grep -Eq "(^|[[:space:]])${required// /[[:space:]]+}([[:space:]]|$)" <<< "$contents"; then
    echo "FAIL: archive does not contain expected SCC380 relation: $required" >&2
    exit 4
  fi
done
if grep -Eq 'SCHEMA[[:space:]]+-[[:space:]]+(auth|supabase_migrations|realtime|storage)' <<< "$contents"; then
  echo 'FAIL: archive looks like a different Supabase database' >&2
  exit 4
fi

# Persist the validated archive BEFORE restoration. A restore error must never
# erase the only backup. Keep it marked unverified until integrity checks pass.
dest="$BACKUP_DIR/scc380-unverified-$(date -u +%Y%m%dT%H%M%SZ)-$.dump"
mv -- "$tmp" "$dest"
trap - EXIT
# Restore is attempted ONLY after the target's identity and emptiness checks.
PGCONNECT_TIMEOUT=10 pg_restore --exit-on-error --single-transaction --no-owner --no-privileges --dbname="$RESTORE_DATABASE_URL" "$dest"
# Compare multiple business-critical relations and Prisma migration history.
# Fail closed if the source changes during the dump: do not claim point-in-time
# equivalence from inconsistent snapshots. The archive remains for investigation.
for relation in tenants products pos_orders chart_of_accounts _prisma_migrations; do
  source_count=$(psql -X -qAt -v ON_ERROR_STOP=1 "$DATABASE_URL" -c "SELECT count(*) FROM public.\"$relation\"")
  target_count=$(psql -X -qAt -v ON_ERROR_STOP=1 "$RESTORE_DATABASE_URL" -c "SELECT count(*) FROM public.\"$relation\"")
  if [[ -z "$source_count" || "$source_count" != "$target_count" ]]; then
    echo "FAIL: restored control row counts differ in $relation; archive retained" >&2
    exit 5
  fi
done
failed_migrations=$(psql -X -qAt -v ON_ERROR_STOP=1 "$RESTORE_DATABASE_URL" -c "SELECT count(*) FROM public._prisma_migrations WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL")
if [[ "$failed_migrations" != "0" ]]; then
  echo 'FAIL: restored database contains unfinished or rolled-back migration history' >&2
  exit 5
fi
verified="$BACKUP_DIR/scc380-verified-$(date -u +%Y%m%dT%H%M%SZ)-$.dump"
mv -- "$dest" "$verified"
dest="$verified"
echo 'STATUS: PASS - BACKUP_RESTORED_TO_ISOLATED_DATABASE'
printf 'SOURCE_DB: %s\nRESTORE_DB: %s\nBACKUP: %s\n' "$source_db" "$target_db" "$dest"
sha256sum -- "$dest"
