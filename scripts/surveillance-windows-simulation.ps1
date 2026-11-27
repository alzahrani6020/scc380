#requires -Version 5.1
<#
.SYNOPSIS
  Local Windows RTSP simulation, optionally followed by the real SCC380 gateway agent.
.DESCRIPTION
  Runs a loopback-only RTSP OPTIONS simulator. If given a genuine existing camera ID,
  prompts for a gateway key, runs the real agent once and deletes the temporary config.
  Never creates companies, users, sites, cameras, or gateway tokens.
.EXAMPLE
  powershell -NoProfile -File scripts\surveillance-windows-simulation.ps1
.EXAMPLE
  powershell -NoProfile -File scripts\surveillance-windows-simulation.ps1 -CameraId "CAMERA_ID_FROM_SCC380"
#>
param(
  [string]$CameraId = "",
  [ValidateRange(1024,65535)][int]$Port = 18554
)
$ErrorActionPreference = 'Stop'
$node = Get-Command node -ErrorAction Stop
$sim = Join-Path $PSScriptRoot 'surveillance-rtsp-simulator.mjs'
$agent = Join-Path $PSScriptRoot 'surveillance-site-agent.mjs'
if (!(Test-Path -LiteralPath $sim) -or !(Test-Path -LiteralPath $agent)) {
  throw 'STATUS: FAIL - Missing simulator or site-agent file'
}
if ($CameraId -and $CameraId -notmatch '^[A-Za-z0-9_-]{10,80}$') {
  throw 'STATUS: FAIL - Invalid camera ID. Copy the ID from SCC380 > Surveillance > Cameras.'
}
$child = $null
$configFile = $null
try {
  $child = Start-Process -FilePath $node.Source -ArgumentList @($sim,[string]$Port) -PassThru -WindowStyle Hidden
  $ready = $false
  for ($i = 0; $i -lt 25; $i++) {
    if ($child.HasExited) { throw 'STATUS: FAIL - RTSP simulator exited unexpectedly' }
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
        $line = [Text.Encoding]::ASCII.GetString($buffer,0,$count)
        if ($line -match '^RTSP/1\.0 200 OK') { $ready = $true; break }
      }
    } catch { } finally { $client.Close() }
    Start-Sleep -Milliseconds 200
  }
  if (!$ready) { throw 'STATUS: FAIL - Simulated RTSP OPTIONS did not return 200' }
  Write-Host 'STATUS: LOCAL_RTSP_SIMULATION_PASS'
  Write-Host ("SIMULATED_CAMERA: 127.0.0.1:{0}" -f $Port)
  Write-Host 'FACT: This is a protocol responder, not a real video camera.'
  if (!$CameraId) {
    Write-Host 'STATUS: WAITING_FOR_EXISTING_CAMERA_ID'
    Write-Host 'Copy an existing camera ID from SCC380, then rerun this script with -CameraId.'
    return
  }
  $configFile = Join-Path ([IO.Path]::GetTempPath()) ('scc380-sim-'+[guid]::NewGuid().ToString('N')+'.json')
  $config = @{ cameras = @(@{cameraId=$CameraId;host='127.0.0.1';port=$Port}) } | ConvertTo-Json -Depth 5
  [IO.File]::WriteAllText($configFile,$config,[Text.UTF8Encoding]::new($false))
  Write-Host 'Enter the one-time gateway token locally. Never paste it into chat.'
  $secret = Read-Host 'Gateway token' -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
  try {
    $env:SCC_GATEWAY_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    if ($env:SCC_GATEWAY_TOKEN -notmatch '^sccg_[A-Za-z0-9_-]{43}$') {
      throw 'STATUS: FAIL - Gateway token format invalid'
    }
    & $node.Source $agent --config $configFile
    if ($LASTEXITCODE -ne 0) { throw "STATUS: FAIL - Gateway agent exit code $LASTEXITCODE" }
    Write-Host 'STATUS: GATEWAY_HEARTBEAT_ACCEPTED'
    Write-Host 'REMAINING: Sign into the same company workspace, refresh and verify ONLINE/CONNECTED.'
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    Remove-Item Env:SCC_GATEWAY_TOKEN -ErrorAction SilentlyContinue
  }
} finally {
  if ($configFile -and (Test-Path -LiteralPath $configFile)) {
    Remove-Item -LiteralPath $configFile -Force -ErrorAction SilentlyContinue
  }
  if ($child -and !$child.HasExited) { Stop-Process -Id $child.Id -Force -ErrorAction SilentlyContinue }
}
