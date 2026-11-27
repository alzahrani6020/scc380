#requires -Version 5.1
<#
.SYNOPSIS
  Send authenticated SCC380 simulation camera heartbeats every 60 seconds while this window is open.
.DESCRIPTION
  Starts an RTSP OPTIONS responder bound exclusively to 127.0.0.1 and launches the
  real SCC380 outbound site agent every interval. Prompts for the existing gateway
  credential once, never stores it on disk, and removes its environment value on exit.
  -ProbeOnly runs the RTSP simulator/check without network calls to SCC380.
  No membership, site, camera, token, scheduled task or service is created.
.EXAMPLE
  powershell.exe -NoProfile -File scripts\surveillance-windows-watch.ps1 -ProbeOnly -MaxCycles 2 -IntervalSeconds 1
.EXAMPLE
  powershell.exe -NoProfile -File scripts\surveillance-windows-watch.ps1 -CameraId cmwya84cq000rr04fznu7n7fr
#>
param(
  [string]$CameraId = '',
  [ValidateRange(1,3600)][int]$IntervalSeconds = 60,
  [ValidateRange(0,10000)][int]$MaxCycles = 0,
  [ValidateRange(1024,65535)][int]$Port = 18554,
  [switch]$ProbeOnly
)
$ErrorActionPreference = 'Stop'
$node = Get-Command node -ErrorAction Stop
$simulator = Join-Path $PSScriptRoot 'surveillance-rtsp-simulator.mjs'
$agent = Join-Path $PSScriptRoot 'surveillance-site-agent.mjs'
if (!(Test-Path -LiteralPath $simulator) -or !(Test-Path -LiteralPath $agent)) {
  throw 'STATUS: FAIL - Simulator or site agent missing'
}
if (!$ProbeOnly -and $CameraId -notmatch '^[A-Za-z0-9_-]{10,80}$') {
  throw 'STATUS: FAIL - CameraId must be copied from an existing simulated camera in SCC380'
}
if (!$ProbeOnly -and $IntervalSeconds -lt 30) {
  throw 'STATUS: FAIL - Production heartbeat interval must be at least 30 seconds'
}
$child = $null
$configFile = $null
try {
  $child = Start-Process -FilePath $node.Source -ArgumentList @($simulator,[string]$Port) -WindowStyle Hidden -PassThru
  $started = $false
  for ($attempt=0; $attempt -lt 25; $attempt++) {
    if ($child.HasExited) { throw 'STATUS: FAIL - RTSP simulator did not start (port may be occupied)' }
    $client = New-Object System.Net.Sockets.TcpClient
    try {
      $result = $client.BeginConnect('127.0.0.1',$Port,$null,$null)
      if ($result.AsyncWaitHandle.WaitOne(200) -and $client.Connected) {
        $client.EndConnect($result)
        $stream = $client.GetStream()
        $bytes = [Text.Encoding]::ASCII.GetBytes(("OPTIONS rtsp://127.0.0.1:{0}/ RTSP/1.0" -f $Port) + "`r`nCSeq: 1`r`n`r`n")
        $stream.Write($bytes,0,$bytes.Length)
        $stream.ReadTimeout = 1500
        $buffer = New-Object byte[] 256
        $count = $stream.Read($buffer,0,$buffer.Length)
        if ([Text.Encoding]::ASCII.GetString($buffer,0,$count) -match '^RTSP/1\.0 200 OK') {
          $started = $true
          break
        }
      }
    } catch { } finally { $client.Close() }
    Start-Sleep -Milliseconds 200
  }
  if (!$started) { throw 'STATUS: FAIL - RTSP simulator did not respond 200' }
  Write-Host 'STATUS: LOCAL_RTSP_SIMULATION_PASS'
  if (!$ProbeOnly) {
    $configFile = Join-Path ([IO.Path]::GetTempPath()) ('scc380-watch-'+[guid]::NewGuid().ToString('N')+'.json')
    $config = @{ cameras=@(@{cameraId=$CameraId;host='127.0.0.1';port=$Port}) } | ConvertTo-Json -Depth 5
    [IO.File]::WriteAllText($configFile,$config,[Text.UTF8Encoding]::new($false))
    Write-Host 'Enter a valid private gateway token. The terminal does not display it.'
    $secret = Read-Host 'Gateway token' -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
    try {
      $env:SCC_GATEWAY_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
      if ($env:SCC_GATEWAY_TOKEN -cnotmatch '^sccg_[A-Za-z0-9_-]{43}$') {
        throw 'STATUS: FAIL - Gateway token format invalid'
      }
    } finally {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
      Remove-Variable secret,ptr -ErrorAction SilentlyContinue
    }
  }
  $cycle = 0
  while ($true) {
    if ($child.HasExited) { throw 'STATUS: FAIL - RTSP simulator unexpectedly stopped' }
    $cycle++
    if ($ProbeOnly) {
      $client = New-Object System.Net.Sockets.TcpClient
      try {
        $client.Connect('127.0.0.1',$Port)
        $stream = $client.GetStream()
        $bytes = [Text.Encoding]::ASCII.GetBytes(("OPTIONS rtsp://127.0.0.1:{0}/ RTSP/1.0" -f $Port) + "`r`nCSeq: 1`r`n`r`n")
        $stream.Write($bytes,0,$bytes.Length)
        $stream.ReadTimeout = 1500
        $buffer = New-Object byte[] 256
        $count = $stream.Read($buffer,0,$buffer.Length)
        if ([Text.Encoding]::ASCII.GetString($buffer,0,$count) -notmatch '^RTSP/1\.0 200 OK') {
          throw 'STATUS: FAIL - RTSP probe did not return 200'
        }
      } finally { $client.Close() }
      Write-Host "STATUS: LOCAL_PROBE_PASS cycle=$cycle"
    } else {
      & $node.Source $agent --config $configFile
      if ($LASTEXITCODE -ne 0) {
        throw "STATUS: FAIL - Gateway agent exited $LASTEXITCODE; retry requires operator review"
      }
      Write-Host "STATUS: HEARTBEAT_ACCEPTED cycle=$cycle"
    }
    if ($MaxCycles -gt 0 -and $cycle -ge $MaxCycles) { break }
    Start-Sleep -Seconds $IntervalSeconds
  }
  Write-Host "STATUS: WATCH_COMPLETED cycles=$cycle"
} finally {
  Remove-Item Env:SCC_GATEWAY_TOKEN -ErrorAction SilentlyContinue
  if ($configFile -and (Test-Path -LiteralPath $configFile)) {
    Remove-Item -LiteralPath $configFile -Force -ErrorAction SilentlyContinue
  }
  if ($child -and !$child.HasExited) {
    Stop-Process -Id $child.Id -Force -ErrorAction SilentlyContinue
  }
}
