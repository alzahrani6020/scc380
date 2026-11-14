# Makkin Acceptance Engine v4 - isolated, pinned, fail-closed.
# No production credentials, database access, deployment, or branch merge.
[CmdletBinding()]
param(
  [string]$Repo = 'C:\Users\vip\scc380',
  [string]$Branch = 'fix/real-estate-verified-main-20261114',
  [Parameter(Mandatory=$true)][ValidatePattern('^[0-9a-fA-F]{40}$')][string]$ExpectedCommit,
  [switch]$UseLocalCommit,
  [switch]$RunDatabaseTests,
  [switch]$RunHrTests,
  [string]$EvidenceRoot = '',
  [int]$DatabasePort = 55432
)
$ErrorActionPreference='Stop'
$stamp=(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+$PID
$tempRoot=[System.IO.Path]::GetTempPath()
if(!$EvidenceRoot){$EvidenceRoot=Join-Path $tempRoot "makkin-v4-$stamp"}
New-Item -ItemType Directory -Path $EvidenceRoot -Force | Out-Null
# Keep Windows npm/Prisma build paths short; do not use the deep AppData Temp tree.
# Never reuse or delete an existing worktree path.
$tree=Join-Path (Split-Path -Parent $Repo) "mk-$($PID)-$(Get-Date -Format 'HHmmss')"
if(Test-Path -LiteralPath $tree){throw "Worktree target already exists: $tree"}
$container="makkin-db-$stamp".ToLowerInvariant()
$state=[ordered]@{engine='Makkin Acceptance v4';status='BLOCKED';commit=$null;
  functional='NOT_RUN';schemaDrift='NOT_RUN';production='UNKNOWN';
  backupRestore='NOT_VERIFIED';evidence=$EvidenceRoot;checks=@();remaining=@()}
# Windows build tools may resolve a globally installed pnpm (e.g. 11.x) inside Turbo.
# A temporary PATH-first shim pins all nested pnpm invocations to Corepack's
# repository-required pnpm version, without changing user/global installation.
$originalPath=$env:PATH
if([System.IO.Path]::DirectorySeparatorChar -eq '\\'){
  $shimDir=Join-Path $EvidenceRoot 'pnpm-shim'
  New-Item -ItemType Directory -Path $shimDir -Force | Out-Null
  $shimFile=Join-Path $shimDir 'pnpm.cmd'
  [System.IO.File]::WriteAllText($shimFile, "@echo off\r\ncorepack pnpm %*\r\n", [System.Text.Encoding]::ASCII)
  $env:PATH="$shimDir;$originalPath"
}
$oldEnv=@{}
foreach($k in @('DATABASE_URL','DIRECT_URL','REAL_ESTATE_DB_E2E','CRM_DB_E2E','ACCOUNTING_DB_E2E')){
  $v=Get-Item -LiteralPath "Env:$k" -ErrorAction SilentlyContinue
  $oldEnv[$k]=@{exists=($null -ne $v);value=$(if($v){$v.Value}else{$null})}
}
$madeTree=$false;$madeContainer=$false
function Check([string]$name,[string]$status,[string]$message=''){
  $script:state.checks+=@{name=$name;status=$status;message=$message}
  Write-Host "[$status] $name $message"
}
function Run([string]$name,[string]$exe,[string[]]$argumentList,[string]$cwd,[bool]$required=$true){
  $log=Join-Path $EvidenceRoot "$name.log"
  Push-Location $cwd
  try {
    $pref=$ErrorActionPreference
    try {
      $ErrorActionPreference='Continue'
      & $exe @argumentList 2>&1 | Out-File -FilePath $log -Encoding utf8
      $exit=$LASTEXITCODE
    } finally {$ErrorActionPreference=$pref}
  } finally {Pop-Location}
  if($exit -ne 0){
    Check $name 'FAIL' "exit=$exit log=$log"
    if($name -eq 'worktree'){Get-Content -LiteralPath $log -Tail 20 | ForEach-Object { Write-Host "git-worktree: $_" }}
    if($required){throw "$name failed (exit=$exit)"}
    return $false
  }
  Check $name 'PASS' "log=$log"
  return $true
}
try {
  # Do not allow build/test processes to inherit a live database URL.
  $env:DATABASE_URL='postgresql://makkin:local_only@127.0.0.1:1/not_connected?schema=public'
  $env:DIRECT_URL=$env:DATABASE_URL
  $env:REAL_ESTATE_DB_E2E='0';$env:CRM_DB_E2E='0';$env:ACCOUNTING_DB_E2E='0'
  if($RunHrTests -and !$RunDatabaseTests){throw 'HR database tests require -RunDatabaseTests'}
  if($DatabasePort -lt 1024 -or $DatabasePort -gt 65535){throw 'Invalid database port'}
  foreach($exe in @('git','node','corepack')){
    if(!(Get-Command $exe -ErrorAction SilentlyContinue)){throw "Missing prerequisite $exe"}
  }
  if(!(Test-Path (Join-Path $Repo '.git'))){throw 'Repository .git not found'}
  if($UseLocalCommit){
    # CI checkout of the PR merge ref contains the head commit as a parent.
    # This mode is allowed only when an external trusted caller pins ExpectedCommit.
    $sha=(& git -C $Repo rev-parse --verify "$ExpectedCommit^{commit}" 2>$null).Trim()
    if($LASTEXITCODE -ne 0){throw 'Pinned commit is not present in local Git object store'}
    Check 'local-commit' 'PASS' "sha=$sha"
  } else {
    [void](Run 'fetch' 'git' @('-C',$Repo,'fetch','--no-tags','origin',$Branch) $Repo)
    $sha=(& git -C $Repo rev-parse FETCH_HEAD).Trim()
  }
  if($LASTEXITCODE -ne 0 -or $sha.ToLowerInvariant() -ne $ExpectedCommit.ToLowerInvariant()){
    throw "Branch SHA differs: expected $ExpectedCommit got $sha"
  }
  $state.commit=$sha
  [void](Run 'worktree' 'git' @('-C',$Repo,'worktree','add','--detach',$tree,$sha) $Repo)
  $madeTree=$true
  $pkg=Get-Content (Join-Path $tree 'package.json') -Raw | ConvertFrom-Json
  if($pkg.packageManager -ne 'pnpm@8.15.0'){throw 'Unexpected pnpm version requirement'}
  [void](Run 'pnpm-version' 'corepack' @('pnpm','--version') $tree)
  if((Get-Content (Join-Path $EvidenceRoot 'pnpm-version.log') -Raw).Trim() -ne '8.15.0'){
    throw 'Pinned pnpm version not active'
  }
  [void](Run 'install' 'corepack' @('pnpm','install','--frozen-lockfile') $tree)
  [void](Run 'generate' 'corepack' @('pnpm','--filter','@scc/database','db:generate') $tree)
  [void](Run 'database-build' 'corepack' @('pnpm','--filter','@scc/database','build') $tree)
  # API needs the workspace dependency graph built first (same as the proven CI flow).
  [void](Run 'api-build' 'corepack' @('pnpm','turbo','run','build','--filter=@scc/api...') $tree)
  [void](Run 'web-build' 'corepack' @('pnpm','--filter','@scc/web','build') $tree)
  if($RunDatabaseTests){
    if(!(Get-Command docker -ErrorAction SilentlyContinue)){throw 'Docker unavailable'}
    if(Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue){
      if(Get-NetTCPConnection -LocalPort $DatabasePort -ErrorAction SilentlyContinue){throw 'Test port occupied'}
    }
    $inUse=& docker ps -a --filter "name=^/$container`$" --format '{{.Names}}'
    if($LASTEXITCODE -ne 0 -or $inUse){throw 'Docker unavailable or container name occupied'}
    $madeContainer=$true
    [void](Run 'start-postgres' 'docker' @('run','-d','--name',$container,
      '--label','makkin-test-v4=true','-e','POSTGRES_USER=makkin',
      '-e','POSTGRES_PASSWORD=local_test_only','-e','POSTGRES_DB=makkin',
      '-p',"127.0.0.1:$($DatabasePort):5432",'postgres:17-alpine') $tree)
    $ready=$false
    for($i=0;$i -lt 45;$i++){
      & docker exec $container pg_isready -U makkin -d makkin *> $null
      if($LASTEXITCODE -eq 0){$ready=$true;break}
      Start-Sleep -Seconds 1
    }
    if(!$ready){throw 'Disposable PostgreSQL 17 not ready'}
    $env:DATABASE_URL="postgresql://makkin:local_test_only@127.0.0.1:$DatabasePort/makkin?schema=public"
    $env:DIRECT_URL=$env:DATABASE_URL
    $env:REAL_ESTATE_DB_E2E='1'
    $env:CRM_DB_E2E='1'
    $env:ACCOUNTING_DB_E2E='1'
    [void](Run 'migrations' 'corepack' @('pnpm','--filter','@scc/database','exec',
      'prisma','migrate','deploy','--schema','prisma/schema.prisma') $tree)
    $tests=@('real-estate-db-acceptance.e2e.spec.ts',
      'real-estate-lease-guards.e2e.spec.ts','real-estate-draft-lifecycle.e2e.spec.ts',
      'real-estate-rent-accounting.e2e.spec.ts')
    if($RunHrTests){
      $tests+=@('hr-governance-db.e2e.spec.ts','hr-asset-custody.e2e.spec.ts',
        'hr-financial-lifecycle.e2e.spec.ts')
    }
    $ok=$true
    foreach($test in $tests){
      $file=Join-Path $tree "apps/api/test/$test"
      if(!(Test-Path $file)){Check $test 'FAIL' 'Missing test';$ok=$false;continue}
      if(!(Run "test-$test" 'corepack' @('pnpm','--filter','@scc/api','exec',
           'tsx','--test',"test/$test") $tree $false)){$ok=$false}
    }
    $state.functional=$(if($ok){'PASS'}else{'FAIL'})
    $drift=Run 'full-schema-drift' 'corepack' @('pnpm','--filter','@scc/database','exec',
      'prisma','migrate','diff','--from-url',$env:DIRECT_URL,
      '--to-schema-datamodel','prisma/schema.prisma','--exit-code') $tree $false
    $state.schemaDrift=$(if($drift){'PASS'}else{'FAIL'})
    if(!$ok -or !$drift){$state.status='FAIL'}else{$state.status='PARTIAL'}
  } else {
    Check 'db-acceptance' 'NOT_RUN' 'Supply -RunDatabaseTests'
    $state.status='PARTIAL'
  }
} catch {
  Check 'engine' 'BLOCKED' $_.Exception.Message
  $state.status='BLOCKED'
} finally {
  if($madeContainer){
    try {
      $matching=& docker ps -a --filter "name=^/$container`$" --filter 'label=makkin-test-v4=true' --format '{{.Names}}' 2>$null
      if($LASTEXITCODE -eq 0 -and $matching -contains $container){
        & docker rm -f $container *> (Join-Path $EvidenceRoot 'cleanup-docker.log')
        if($LASTEXITCODE -ne 0){Check 'cleanup-docker' 'FAIL';$state.status='FAIL'}
      }
    } catch {Check 'cleanup-docker' 'FAIL' $_.Exception.Message;$state.status='FAIL'}
  }
  $env:PATH=$originalPath
  foreach($k in $oldEnv.Keys){
    if($oldEnv[$k].exists){[Environment]::SetEnvironmentVariable($k,$oldEnv[$k].value,'Process')}
    else{[Environment]::SetEnvironmentVariable($k,$null,'Process')}
  }
  if($madeTree){
    try {
      & git -c core.longpaths=true -C $Repo worktree remove --force -- $tree *> (Join-Path $EvidenceRoot 'cleanup-worktree.log')
      if($LASTEXITCODE -ne 0){Check 'cleanup-worktree' 'FAIL';$state.status='FAIL'}
    } catch {Check 'cleanup-worktree' 'FAIL' $_.Exception.Message;$state.status='FAIL'}
  }
  $state.remaining=@('Render production schema/history UNKNOWN',
    'Production backup and recovery NOT_VERIFIED','Authenticated production acceptance NOT_RUN',
    'Global drift must PASS before merge/deploy')
  $state | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $EvidenceRoot 'result.json') -Encoding UTF8
  Write-Host "STATUS: $($state.status)"
  Write-Host "EVIDENCE: $(Join-Path $EvidenceRoot 'result.json')"
  Write-Host 'REMAINING: Production inventory, tested backup/restore, smoke acceptance'
  if($state.status -in @('FAIL','BLOCKED')){exit 1}
}
