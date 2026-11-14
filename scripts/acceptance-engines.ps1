# SCC380 acceptance engine launcher. Read-only by default, PowerShell 5.1+.
[CmdletBinding()]
param(
  [string]$Web = 'https://dr-talal-h-alzahrani.com',
  [string]$Api = 'https://scc380-api.onrender.com',
  [string]$ExpectedSha = '',
  [string]$ObservedApiImage = '',
  [string]$Output = '',
  [int]$TimeoutMs = 10000,
  [switch]$SafeAuthProbes,
  [switch]$Browser
)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$runner = Join-Path $PSScriptRoot 'acceptance-engines.cjs'
if (-not (Test-Path -LiteralPath $runner)) { throw "Runner missing: $runner" }
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { throw 'Node.js 20 or newer required' }
$version = (& node -p "process.versions.node.split('.')[0]").Trim()
if ([int]$version -lt 20) { throw "Node.js 20 or newer required; found $version" }
if (-not $Output) { $Output = Join-Path $repo 'artifacts\acceptance' }
$arguments = @($runner, '--web', $Web, '--api', $Api, '--output', $Output, '--timeout-ms', [string]$TimeoutMs)
if ($ExpectedSha) { $arguments += @('--expected-sha', $ExpectedSha) }
if ($ObservedApiImage) { $arguments += @('--observed-api-image', $ObservedApiImage) }
if ($SafeAuthProbes) { $arguments += '--safe-auth-probes' }
if ($Browser) { $arguments += '--browser' }
& node @arguments
exit $LASTEXITCODE
