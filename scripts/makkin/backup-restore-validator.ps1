# Validates a user-supplied pg_dump custom/tar backup using disposable PostgreSQL 17.
# No connection to production and no external container ports.
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$BackupFile,
  [string]$EvidenceRoot='',
  [int]$TimeoutSeconds=90
)
$ErrorActionPreference='Stop'
$stamp=(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+$PID
if(!$EvidenceRoot){$EvidenceRoot=Join-Path $env:TEMP "makkin-restore-$stamp"}
New-Item -ItemType Directory -Force -Path $EvidenceRoot | Out-Null
$container="makkin-restore-$stamp".ToLowerInvariant()
$summary=[ordered]@{status='BLOCKED';archive=$BackupFile;restore='NOT_VERIFIED';
  tableCount=$null;error=$null;evidence=$EvidenceRoot;production='NOT_CONNECTED'}
$created=$false
try {
  if(!(Test-Path -LiteralPath $BackupFile -PathType Leaf)){throw 'Backup file not found'}
  if(!(Get-Command docker -ErrorAction SilentlyContinue)){throw 'Docker unavailable'}
  $archive=(Resolve-Path -LiteralPath $BackupFile).ProviderPath
  $summary.archive=$archive
  $existing=& docker ps -a --filter "name=^/$container`$" --format '{{.Names}}'
  if($LASTEXITCODE -ne 0 -or $existing){throw 'Docker unavailable or container name occupied'}
  $created=$true
  & docker run -d --name $container --label makkin-restore=true --network none -e POSTGRES_USER=makkin_restore -e POSTGRES_PASSWORD=isolated_only -e POSTGRES_DB=restore_test postgres:17-alpine *> (Join-Path $EvidenceRoot 'container.log')
  if($LASTEXITCODE -ne 0){throw 'PostgreSQL container creation failed'}
  $ready=$false
  for($i=0;$i -lt $TimeoutSeconds;$i++){
    & docker exec $container pg_isready -U makkin_restore -d restore_test *> $null
    if($LASTEXITCODE -eq 0){$ready=$true;break}
    Start-Sleep -Seconds 1
  }
  if(!$ready){throw 'PostgreSQL restore container not ready'}
  & docker cp $archive "${container}:/backup.dump" *> (Join-Path $EvidenceRoot 'copy.log')
  if($LASTEXITCODE -ne 0){throw 'Could not copy user-supplied archive'}
  & docker exec $container pg_restore --list /backup.dump *> (Join-Path $EvidenceRoot 'archive-list.log')
  if($LASTEXITCODE -ne 0){throw 'Archive is not recognized by pg_restore'}
  & docker exec $container pg_restore --exit-on-error --single-transaction --no-owner --no-privileges -U makkin_restore -d restore_test /backup.dump *> (Join-Path $EvidenceRoot 'restore.log')
  if($LASTEXITCODE -ne 0){throw 'Restore failed'}
  $tables=& docker exec $container psql -U makkin_restore -d restore_test -X -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'"
  if($LASTEXITCODE -ne 0){throw 'Restored schema inspection failed'}
  $count=0
  if(![int]::TryParse(($tables | Select-Object -Last 1).ToString(),[ref]$count)){throw 'Cannot parse table count'}
  if($count -lt 1){throw 'Restored archive contains no public base tables'}
  $summary.tableCount=$count
  $summary.restore='PASS'
  $summary.status='PASS'
} catch {
  $summary.error=$_.Exception.Message
  $summary.status='FAIL'
} finally {
  if($created){
    try {
      $match=& docker ps -a --filter "name=^/$container`$" --filter 'label=makkin-restore=true' --format '{{.Names}}' 2>$null
      if($LASTEXITCODE -eq 0 -and $match -contains $container){
        & docker rm -f $container *> (Join-Path $EvidenceRoot 'cleanup.log')
        if($LASTEXITCODE -ne 0){$summary.status='FAIL';$summary.error='Container cleanup failed'}
      }
    } catch {$summary.status='FAIL';$summary.error=$_.Exception.Message}
  }
  $summary | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $EvidenceRoot 'result.json') -Encoding utf8
  Write-Host "STATUS: $($summary.status)"
  Write-Host "EVIDENCE: $(Join-Path $EvidenceRoot 'result.json')"
  Write-Host 'REMAINING: This does not verify backup freshness, origin, RPO/RTO or production readiness.'
  if($summary.status -ne 'PASS'){exit 1}
}
