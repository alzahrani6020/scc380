# Makkin SCC380 - production metadata inspection and opt-in logical backup.
# Never executes DDL/DML or migrations. Credentials supplied only via local libpq settings.
[CmdletBinding()]
param(
  [string]$ExpectedDatabase = 'scc_main_qbf1',
  [string]$EvidenceRoot = '',
  [switch]$CreateBackup,
  [switch]$VerifyRestore
)
$ErrorActionPreference = 'Stop'
$stamp = (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + $PID
if (!$EvidenceRoot) { $EvidenceRoot = Join-Path ([IO.Path]::GetTempPath()) "makkin-prod-preflight-$stamp" }
New-Item -ItemType Directory -Path $EvidenceRoot -Force | Out-Null
$result = [ordered]@{
  status = 'BLOCKED'; target = $ExpectedDatabase; inventory = 'NOT_RUN'
  backup = 'NOT_RUN'; restore = 'NOT_RUN'; productionWrite = 'NEVER'
  files = @(); message = ''; evidence = $EvidenceRoot
}
$oldOptions = [Environment]::GetEnvironmentVariable('PGOPTIONS', 'Process')
$archive = Join-Path $EvidenceRoot 'production-backup.dump'
try {
  $required = @('PGHOST','PGPORT','PGDATABASE','PGUSER')
  foreach ($key in $required) {
    if (![Environment]::GetEnvironmentVariable($key,'Process')) {
      throw "Missing local libpq setting $key; do not paste credentials into chat"
    }
  }
  if ($env:PGDATABASE -cne $ExpectedDatabase) {
    throw 'PGDATABASE does not match approved production database'
  }
  if ($env:PGSSLMODE -notin @('verify-full','verify-ca')) {
    throw 'PGSSLMODE must be verify-full or verify-ca with a trusted certificate configuration'
  }
  foreach ($cmd in @('psql','pg_restore')) {
    if (!(Get-Command $cmd -ErrorAction SilentlyContinue)) { throw "Missing PostgreSQL client $cmd" }
  }
  if ($CreateBackup -and !(Get-Command pg_dump -ErrorAction SilentlyContinue)) {
    throw 'pg_dump is required for backup'
  }
  if ($VerifyRestore -and !$CreateBackup) {
    throw '-VerifyRestore requires -CreateBackup'
  }
  $sql = Join-Path $PSScriptRoot 'production-schema-inventory.sql'
  if (!(Test-Path -LiteralPath $sql -PathType Leaf)) { throw 'Inventory SQL missing alongside this script' }
  $identity = & psql -X -w -A -t -v ON_ERROR_STOP=1 -c 'SELECT current_database()' 2>&1
  if ($LASTEXITCODE -ne 0) { throw 'Cannot connect to approved production database; check private access and local credentials' }
  $actual = ($identity | Out-String).Trim()
  if ($actual -cne $ExpectedDatabase) { throw 'Connected database identity does not match approved target' }
  $env:PGOPTIONS = '-c default_transaction_read_only=on -c statement_timeout=30000'
  $inventory = Join-Path $EvidenceRoot 'production-catalog.txt'
  & psql -X -w -v ON_ERROR_STOP=1 -f $sql -o $inventory 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Read-only catalog inventory failed; see no production changes' }
  if (!(Test-Path -LiteralPath $inventory) -or (Get-Item $inventory).Length -eq 0) {
    throw 'Catalog inventory was empty'
  }
  $result.inventory = 'PASS'
  $result.files += $inventory
  if ($CreateBackup) {
    # pg_dump itself is read-only on the source server; the destination is a local file.
    $env:PGOPTIONS = $oldOptions
    & pg_dump --no-password --format=custom --no-owner --no-acl --file=$archive 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Backup export failed; do not assume the file is usable' }
    & pg_restore --list $archive > (Join-Path $EvidenceRoot 'backup-toc.txt')
    if ($LASTEXITCODE -ne 0) { throw 'Backup archive validation failed' }
    $result.backup = 'ARCHIVE_READABLE'
    $result.files += $archive
    if ($VerifyRestore) {
      $validator = Join-Path $PSScriptRoot 'backup-restore-validator.ps1'
      if (!(Test-Path -LiteralPath $validator)) { throw 'Offline restore validator missing' }
      & $validator -BackupFile $archive -EvidenceRoot (Join-Path $EvidenceRoot 'restore-validation')
      if ($LASTEXITCODE -ne 0) { throw 'Offline restore validation failed' }
      $restoreResult = Get-Content (Join-Path $EvidenceRoot 'restore-validation/result.json') -Raw | ConvertFrom-Json
      if ($restoreResult.restore -ne 'PASS' -or $restoreResult.status -ne 'PASS') {
        throw 'Restore validation evidence does not confirm PASS'
      }
      $result.restore = 'PASS_DISPOSABLE'
    }
  }
  $result.status = 'PARTIAL'
  $result.message = 'Local evidence collected; production compatibility and deployment acceptance remain separate gates'
} catch {
  $result.status = 'BLOCKED'
  $result.message = $_.Exception.Message
} finally {
  [Environment]::SetEnvironmentVariable('PGOPTIONS',$oldOptions,'Process')
  $result | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $EvidenceRoot 'result.json') -Encoding UTF8
  Write-Host "STATUS: $($result.status)"
  Write-Host "EVIDENCE: $(Join-Path $EvidenceRoot 'result.json')"
  Write-Host 'REMAINING: Review schema and migration history; reconcile differences and run authenticated production acceptance'
  if ($result.status -ne 'PARTIAL') { exit 1 }
}
