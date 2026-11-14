# Makkin SCC380 - offline production restore -> Prisma schema diff.
# NEVER connects to production; requires a locally verified production-origin dump.
# The only database writes target a disposable PostgreSQL 17 container bound to 127.0.0.1.
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$BackupFolder,
  [string]$RepoRoot = 'C:\Users\vip\scc380',
  [string]$ReviewSha = '468f35baf7495ad924f8377c29c7484035b796a7'
)
$ErrorActionPreference = 'Stop'
$stamp = [guid]::NewGuid().ToString('N').Substring(0,12)
$container = 'makkin-drift-' + $stamp
$checkout = Join-Path $RepoRoot ('.local-worktrees\makkin-drift-' + $stamp)
$report = [ordered]@{STATUS='FAIL'; REVIEW_SHA=$ReviewSha; BACKUP='UNKNOWN'; RESTORE='NOT_RUN'; DRIFT='NOT_RUN'; SCHEMA_DIFF='NOT_RUN'; EVIDENCE=$BackupFolder; CONTAINER_REMOVED='NO'; ERROR=''}
$launched = $false
try {
  $backup = Join-Path $BackupFolder 'production.dump'
  $result = Join-Path $BackupFolder 'result.json'
  $expectedHash = Join-Path $BackupFolder 'backup-sha256.txt'
  if (!(Test-Path -LiteralPath $backup -PathType Leaf) -or !(Test-Path -LiteralPath $result -PathType Leaf) -or !(Test-Path -LiteralPath $expectedHash -PathType Leaf)) { throw 'BACKUP_OR_EVIDENCE_MISSING' }
  $prior = Get-Content -LiteralPath $result -Raw | ConvertFrom-Json
  if ($prior.STATUS -ne 'PASS' -or $prior.BACKUP -ne 'PASS_ARCHIVE_READABLE' -or $prior.RESTORE -ne 'PASS_ISOLATED') { throw 'PRIOR_BACKUP_RESTORE_GATE_NOT_PASS' }
  $hash = (Get-FileHash -LiteralPath $backup -Algorithm SHA256).Hash
  if ($hash -cne (Get-Content -LiteralPath $expectedHash -Raw).Trim()) { throw 'BACKUP_SHA256_MISMATCH' }
  $report.BACKUP='PASS_VERIFIED_HASH'
  foreach ($exe in @('docker','git','pnpm')) { if (!(Get-Command $exe -ErrorAction SilentlyContinue)) { throw ('MISSING_TOOL_'+$exe) } }
  if (!(Test-Path -LiteralPath (Join-Path $RepoRoot '.git'))) { throw 'REPOSITORY_NOT_FOUND' }
  & git -C $RepoRoot cat-file -e ($ReviewSha+'^{commit}') 2>$null
  if ($LASTEXITCODE -ne 0) {
    & git -C $RepoRoot fetch --no-tags origin $ReviewSha
    if ($LASTEXITCODE -ne 0) { throw 'REVIEW_COMMIT_NOT_FETCHED' }
  }
  & git -C $RepoRoot worktree add --detach $checkout $ReviewSha
  if ($LASTEXITCODE -ne 0) { throw 'CLEAN_CHECKOUT_FAILED' }
  $actualSha = (& git -C $checkout rev-parse HEAD).Trim()
  if ($actualSha -cne $ReviewSha) { throw 'REVIEW_SHA_MISMATCH' }
  & pnpm --dir $checkout install --frozen-lockfile
  if ($LASTEXITCODE -ne 0) { throw 'PNPM_INSTALL_FAILED' }
  & pnpm --dir $checkout --filter '@scc/database' db:generate
  if ($LASTEXITCODE -ne 0) { throw 'PRISMA_GENERATE_FAILED' }
  # Ephemeral password, never reuse production credentials.
  $pwBytes = New-Object byte[] 30
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($pwBytes)
  $localPass = [Convert]::ToBase64String($pwBytes).TrimEnd('=').Replace('+','A').Replace('/','B')
  $listener = New-Object Net.Sockets.TcpListener ([Net.IPAddress]::Loopback),0
  $listener.Start()
  $port = ([Net.IPEndPoint]$listener.LocalEndpoint).Port
  $listener.Stop()
  & docker run -d --name $container --label makkin-drift=true -p ("127.0.0.1:"+$port+":5432") -e POSTGRES_USER=makkin_restore -e ("POSTGRES_PASSWORD="+$localPass) -e POSTGRES_DB=restore_test postgres:17-alpine *> (Join-Path $BackupFolder 'drift-container.log')
  if ($LASTEXITCODE -ne 0) { throw 'CONTAINER_START_FAILED' }
  $launched=$true
  $ready=$false
  for($i=0;$i -lt 90;$i++) {
    & docker exec $container pg_isready -h 127.0.0.1 -U makkin_restore -d restore_test *> $null
    if($LASTEXITCODE -eq 0){$ready=$true;break}
    Start-Sleep -Seconds 1
  }
  if (!$ready) { throw 'RESTORE_CONTAINER_NOT_READY' }
  & docker cp $backup ($container+':/backup.dump') *> (Join-Path $BackupFolder 'drift-copy.log')
  if ($LASTEXITCODE -ne 0) { throw 'BACKUP_COPY_FAILED' }
  & docker exec $container pg_restore --exit-on-error --single-transaction --no-owner --no-privileges -U makkin_restore -d restore_test /backup.dump *> (Join-Path $BackupFolder 'drift-restore.log')
  if ($LASTEXITCODE -ne 0) { throw 'CLONE_RESTORE_FAILED' }
  $report.RESTORE='PASS_DISPOSABLE_CLONE'
  $localUrl = ('postgresql://makkin_restore:'+ $localPass +'@127.0.0.1:'+ $port +'/restore_test?schema=public')
  $env:DIRECT_URL = $localUrl
  $env:DATABASE_URL = $localUrl
  try {
    $databaseFolder=Join-Path $checkout 'packages\database'
    $diffFile=Join-Path $BackupFolder ('production-vs-schema-'+$stamp+'.sql')
    # Generates review-only SQL, NEVER executes SQL against either database.
    Push-Location $databaseFolder
    try {
      & pnpm exec prisma migrate diff --from-url $localUrl --to-schema-datamodel prisma/schema.prisma --script > $diffFile
      if ($LASTEXITCODE -ne 0) { throw 'PRISMA_DIFF_GENERATION_FAILED' }
      $report.SCHEMA_DIFF=$diffFile
      & pnpm exec prisma migrate diff --from-url $localUrl --to-schema-datamodel prisma/schema.prisma --exit-code *> $null
      $code=$LASTEXITCODE
      if ($code -eq 0) { $report.DRIFT='ZERO' }
      elseif ($code -eq 2) { $report.DRIFT='PRESENT_REVIEW_REQUIRED' }
      else { throw 'PRISMA_DIFF_COMMAND_FAILED' }
    } finally { Pop-Location }
    $preview = Get-Content -LiteralPath $diffFile -Raw
    $report.DESTRUCTIVE_SQL_MARKERS = ([regex]::Matches($preview, '(?im)\b(?:DROP\s+(?:TABLE|COLUMN|INDEX|TYPE)|TRUNCATE|DELETE\s+FROM)\b')).Count
    $report.CREATE_TABLE_MARKERS = ([regex]::Matches($preview, '(?im)\bCREATE\s+TABLE\b')).Count
    $report.ALTER_TABLE_MARKERS = ([regex]::Matches($preview, '(?im)\bALTER\s+TABLE\b')).Count
    $report.STATUS='PASS_ANALYSIS_ONLY'
  } finally {
    Remove-Item Env:DIRECT_URL -ErrorAction SilentlyContinue
    Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
    $localPass=$null; $localUrl=$null
  }
} catch { $report.ERROR=$_.Exception.Message; $report.STATUS='FAIL' }
finally {
  if($launched) {
    & docker rm -f $container *> (Join-Path $BackupFolder 'drift-cleanup.log')
    if($LASTEXITCODE -eq 0) { $report.CONTAINER_REMOVED='YES' }
    else {$report.STATUS='FAIL'; $report.ERROR='CONTAINER_CLEANUP_FAILED'}
  }
  $output = Join-Path $BackupFolder ('drift-result-'+$stamp+'.json')
  $report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $output -Encoding UTF8
  Write-Host ('STATUS: '+$report.STATUS)
  Write-Host ('EVIDENCE: '+$output)
  Write-Host ('REVIEW_SHA: '+$ReviewSha)
  Write-Host ('BACKUP: '+$report.BACKUP+' RESTORE: '+$report.RESTORE+' DRIFT: '+$report.DRIFT)
  Write-Host ('REMAINING: Review SQL and reconcile migrations on an isolated clone; NO production changes performed')
  if($report.ERROR) { Write-Host ('ERROR: '+$report.ERROR) }
  if($report.STATUS -ne 'PASS_ANALYSIS_ONLY') { exit 1 }
}
