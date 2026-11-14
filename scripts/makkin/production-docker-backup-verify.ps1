# SCC380 Makkin: production READ-ONLY metadata and logical backup.
# Windows PowerShell 5.1, Docker Desktop with postgres:17-alpine.
# No migrations, writes to production, Git modifications, or deployments.
[CmdletBinding()]
param(
  [string]$EvidenceRoot = 'C:\Users\vip\makkin-secure-backup'
)
$ErrorActionPreference = 'Stop'
$expectedHost = 'dpg-dboalnjrjlhs73asosf0-a.frankfurt-postgres.render.com'
$expectedDatabase = 'scc_main_qbf1'
$expectedUser = 'scc_app'
$sessionName = ('makkin-' + [guid]::NewGuid().ToString('N').Substring(0,12))
$evidence = Join-Path $EvidenceRoot $sessionName
$ptr = [IntPtr]::Zero
$made = $false
$report = [ordered]@{
  STATUS = 'FAIL'; CONNECTION = 'NOT_RUN'; INVENTORY = 'NOT_RUN'
  BACKUP = 'NOT_RUN'; RESTORE = 'NOT_RUN'; EVIDENCE = $evidence
  PRODUCTION_WRITE = 'NONE'; ERROR = ''
}
try {
  if (!(Test-Path -LiteralPath $EvidenceRoot -PathType Container)) { throw 'EvidenceRoot must exist on a protected local disk outside Git' }
  if (!(Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker is unavailable' }
  & docker info --format '{{.ServerVersion}}' *> $null
  if ($LASTEXITCODE -ne 0) { throw 'Docker engine unavailable' }
  New-Item -ItemType Directory -Path $evidence -ErrorAction Stop | Out-Null
  $secret = Read-Host 'Paste Render EXTERNAL Database URL (hidden)' -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
  $url = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  $uri = [uri]$url
  if ($uri.Scheme -notin @('postgres', 'postgresql')) { throw 'URL_SCHEME_INVALID' }
  if ($uri.Host -cne $expectedHost -or $uri.AbsolutePath.TrimStart('/') -cne $expectedDatabase) { throw 'WRONG_PRODUCTION_TARGET' }
  if ($uri.Port -notin @(-1, 5432)) { throw 'WRONG_PRODUCTION_PORT' }
  $ui = $uri.UserInfo.Split(':',2)
  if ($ui.Count -ne 2 -or [uri]::UnescapeDataString($ui[0]) -cne $expectedUser) { throw 'WRONG_PRODUCTION_USER' }
  $pass = [uri]::UnescapeDataString($ui[1])
  if ([string]::IsNullOrEmpty($pass)) { throw 'MISSING_PASSWORD' }
  $sql = @'
\\pset pager off
BEGIN TRANSACTION READ ONLY;
SELECT current_database() AS database_name, current_user AS db_user, current_setting('server_version') AS version;
SELECT schemaname, tablename FROM pg_catalog.pg_tables WHERE schemaname='public' ORDER BY tablename;
SELECT table_name, ordinal_position, column_name, udt_name, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position;
SELECT t.typname, e.enumlabel FROM pg_catalog.pg_type t JOIN pg_catalog.pg_enum e ON e.enumtypid=t.oid JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' ORDER BY t.typname,e.enumsortorder;
SELECT c.relname, con.conname, con.contype, pg_get_constraintdef(con.oid) FROM pg_catalog.pg_constraint con JOIN pg_catalog.pg_class c ON c.oid=con.conrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname,con.conname;
SELECT tablename,indexname,indexdef FROM pg_catalog.pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname;
SELECT migration_name,checksum,started_at,finished_at,rolled_back_at,applied_steps_count FROM public._prisma_migrations ORDER BY started_at,migration_name;
ROLLBACK;
'@
  # The inventory is metadata-only; the backup itself contains customer data.
  [IO.File]::WriteAllText((Join-Path $evidence 'inventory.sql'),$sql,[Text.Encoding]::ASCII)
  $sh = @'
set -eu
IFS= read -r PGPASSWORD
# Windows PowerShell native stdin may use CRLF; remove only the terminal CR.
PGPASSWORD="${PGPASSWORD%$(printf '\r')}"
export PGPASSWORD
export PGHOST='dpg-dboalnjrjlhs73asosf0-a.frankfurt-postgres.render.com'
export PGPORT=5432 PGDATABASE='scc_main_qbf1' PGUSER='scc_app'
export PGSSLMODE=verify-full PGSSLROOTCERT=system PGCONNECT_TIMEOUT=15
psql -w -X -A -t -v ON_ERROR_STOP=1 -c "SELECT current_database(), current_user" > /evidence/identity.txt
printf 'PASS\n' > /evidence/connection.pass
PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=60000' psql -w -X -v ON_ERROR_STOP=1 -f /evidence/inventory.sql -o /evidence/inventory.txt
printf 'PASS\n' > /evidence/inventory.pass
pg_dump -w --format=custom --no-owner --no-acl --file=/evidence/production.dump
pg_restore --list /evidence/production.dump > /evidence/backup-toc.txt
printf 'PASS\n' > /evidence/backup.pass
'@
  # PowerShell 5.1 cannot reliably pass a multiline shell program through native sh -c.
  # Persist only non-secret instructions in evidence; pass the password via stdin.
  [IO.File]::WriteAllText((Join-Path $evidence 'runner.sh'),($sh.Replace("`r`n","`n") + "`n"),[Text.Encoding]::ASCII)
  $pass | & docker run --rm -i --mount "type=bind,source=$evidence,target=/evidence" postgres:17-alpine sh /evidence/runner.sh
  if ($LASTEXITCODE -ne 0) { throw 'PRODUCTION_READ_BACKUP_FAILED' }
  $identity = (Get-Content -LiteralPath (Join-Path $evidence 'identity.txt') -Raw).Trim()
  if ($identity -cne ($expectedDatabase+'|'+$expectedUser)) { throw 'DATABASE_IDENTITY_MISMATCH' }
  foreach ($name in @('inventory.txt','production.dump','backup-toc.txt')) {
    $p = Join-Path $evidence $name
    if (!(Test-Path -LiteralPath $p -PathType Leaf) -or (Get-Item -LiteralPath $p).Length -lt 1) { throw ('EVIDENCE_MISSING: '+$name) }
  }
  $report.CONNECTION='PASS_TLS_VERIFY_FULL'
  $report.INVENTORY='PASS'
  $report.BACKUP='PASS_ARCHIVE_READABLE'
  $hash = (Get-FileHash -LiteralPath (Join-Path $evidence 'production.dump') -Algorithm SHA256).Hash
  [IO.File]::WriteAllText((Join-Path $evidence 'backup-sha256.txt'), $hash, [Text.Encoding]::ASCII)
  # Restore is isolated: network none, no published ports.
  & docker run -d --name $sessionName --label makkin-restore=true --network none -e POSTGRES_USER=makkin_restore -e POSTGRES_PASSWORD=local_only -e POSTGRES_DB=restore_test postgres:17-alpine *> (Join-Path $evidence 'restore-container.log')
  if ($LASTEXITCODE -ne 0) { throw 'RESTORE_CONTAINER_START_FAILED' }
  $made = $true
  $ready=$false
  for ($i=0; $i -lt 90; $i++) {
    & docker exec $sessionName pg_isready -h 127.0.0.1 -U makkin_restore -d restore_test *> $null
    if ($LASTEXITCODE -eq 0) { $ready=$true; break }
    Start-Sleep -Seconds 1
  }
  if (!$ready) { throw 'RESTORE_CONTAINER_NOT_READY' }
  & docker cp (Join-Path $evidence 'production.dump') ($sessionName+':/backup.dump') *> (Join-Path $evidence 'restore-copy.log')
  if ($LASTEXITCODE -ne 0) { throw 'BACKUP_COPY_FAILED' }
  & docker exec $sessionName pg_restore --exit-on-error --single-transaction --no-owner --no-privileges -U makkin_restore -d restore_test /backup.dump *> (Join-Path $evidence 'restore.log')
  if ($LASTEXITCODE -ne 0) { throw 'RESTORE_FAILED' }
  $tableCount = & docker exec $sessionName psql -U makkin_restore -d restore_test -X -Atc "SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname='public'"
  if ($LASTEXITCODE -ne 0 -or [int]$tableCount -lt 1) { throw 'RESTORED_TABLES_MISSING' }
  $report.RESTORE='PASS_ISOLATED'
  $report.RESTORED_TABLES=[int]$tableCount
  $report.SHA256=$hash
  $report.STATUS='PASS'
} catch {
  $report.ERROR = $_.Exception.Message
} finally {
  foreach ($stage in @(@('connection.pass','CONNECTION','PASS_TLS_VERIFY_FULL'),@('inventory.pass','INVENTORY','PASS'),@('backup.pass','BACKUP','PASS_ARCHIVE_READABLE'))) {
    if (Test-Path -LiteralPath (Join-Path $evidence $stage[0])) { $report[$stage[1]]=$stage[2] }
  }
  if ($made) {
    & docker rm -f $sessionName *> (Join-Path $evidence 'restore-cleanup.log')
    if ($LASTEXITCODE -ne 0) { $report.STATUS='FAIL'; $report.ERROR='RESTORE_CONTAINER_CLEANUP_FAILED' }
  }
  if ($ptr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
  Remove-Variable pass,url,uri,secret,ui -ErrorAction SilentlyContinue
  if (Test-Path -LiteralPath $evidence -PathType Container) {
    $report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $evidence 'result.json') -Encoding UTF8
  }
  Write-Host ('STATUS: '+$report.STATUS)
  Write-Host ('EVIDENCE: '+$evidence)
  Write-Host ('CONNECTION: '+$report.CONNECTION+' INVENTORY: '+$report.INVENTORY+' BACKUP: '+$report.BACKUP+' RESTORE: '+$report.RESTORE)
  if ($report.ERROR) { Write-Host ('ERROR: '+$report.ERROR) }
  if ($report.STATUS -ne 'PASS') { exit 1 }
}
