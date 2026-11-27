# SCC380 local camera simulation — Windows

This tests a **simulated RTSP OPTIONS endpoint** on `127.0.0.1:18554`. It does **not** deliver video, audio or PTZ control. It may be linked to a **clearly marked simulated camera** in a real SCC380 company workspace using its actual camera ID and a one-time gateway token. That real link sends an authorized heartbeat to production; do not confuse the result with physical-camera acceptance.

## Preparation

1. Open [SCC380 Surveillance](https://scc380-web-dr-talal.vercel.app/dashboard/surveillance) in an authorized company administrator session.
2. Select the existing company workspace. Add a site only if needed, and create a camera with an explicit name such as `SIMULATED - Windows local RTSP probe` (not a real device). Do **not** create another company or membership.
3. Under Cameras, use **نسخ cameraId** to copy that camera ID. The camera ID is not a secret.
4. Under `ربط الفروع`, create a dedicated **simulation gateway** for the exact site and save the one-time token privately. The token is a credential: **never put it into a chat, file, terminal command arguments, issue or screenshot**.
5. If you already have a dedicated simulation gateway/token, reuse it; do not create duplicates.

## First, only test local fake RTSP — no workspace change

On Windows PowerShell:

```powershell
$repo = "$env:USERPROFILE\scc380-camera-agent"
$sim = Join-Path $repo "scripts\surveillance-windows-simulation.ps1"
Test-Path -LiteralPath $sim
powershell.exe -NoProfile -ExecutionPolicy Bypass -File $sim
```

Expected: `STATUS: LOCAL_RTSP_SIMULATION_PASS` then `STATUS: WAITING_FOR_EXISTING_CAMERA_ID`. The script runs on a loopback-only test port, checks RTSP 200, and shuts down its own child process. It does not modify `C:\SCC380\site-cameras.json`.

## Pair the simulated camera with the already authorized workspace

After obtaining a *real* ID from SCC380, run:

```powershell
$repo = "$env:USERPROFILE\scc380-camera-agent"
$sim = Join-Path $repo "scripts\surveillance-windows-simulation.ps1"
$cameraId = Read-Host "Paste cameraId from SCC380 (not the gateway token)"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File $sim -CameraId $cameraId
```

The script prompts for the gateway token through a `SecureString` entry, creates a **temporary** site-agent configuration only, launches the actual Node.js site agent and reports `HEARTBEAT_ACCEPTED` on valid authorization. It removes the temporary file and clears the token variable. **No production company, membership or camera is automatically created by the script.** The simulation gateway heartbeat *does* update the chosen existing simulated camera status in production; do not use a real camera's ID for this test.

Go back to the same workspace, refresh cameras and `ربط الفروع`: verify camera `ONLINE` and gateway `CONNECTED` plus timestamps. Optionally revoke the simulation gateway using the UI to prevent future reports.

### Status interpretation

- `LOCAL_RTSP_SIMULATION_PASS`: only the local RTSP protocol responder was verified
- `WAITING_FOR_EXISTING_CAMERA_ID`: no production write was attempted
- `HEARTBEAT_ACCEPTED`: the authenticated SCC380 API accepted the simulation report
- `ONLINE` + `CONNECTED` after refresh: real database readback for a **simulated** camera and site gateway
- No real video, audio, GPS location or ONVIF support is proved by this procedure

Use the [real-device runbook](surveillance-on-prem-runbook.md) for physical cameras.

## Keep the simulation status fresh for a limited trial

Use the recurring foreground watchdog after the one-shot test has passed with a valid, **non-revoked** gateway key. This is deliberately **not** a Windows service or persistent scheduled task; closing the terminal stops it, and credentials are not saved in a file.

```powershell
$repo = 'C:\Users\vip\scc380-camera-agent'
git -C $repo status --short
git -C $repo pull --ff-only origin main
$watch = Join-Path $repo 'scripts\surveillance-windows-watch.ps1'
powershell.exe -NoProfile -File $watch -ProbeOnly -MaxCycles 2 -IntervalSeconds 1
```

Expected offline result: `LOCAL_RTSP_SIMULATION_PASS`, `LOCAL_PROBE_PASS cycle=1`, `LOCAL_PROBE_PASS cycle=2`, `WATCH_COMPLETED cycles=2`. This phase makes no production API requests and needs no token.

For a bounded authorized five-minute trial (five authenticated reports, 60 seconds apart), on a connected Windows machine:

```powershell
$watch = 'C:\Users\vip\scc380-camera-agent\scripts\surveillance-windows-watch.ps1'
powershell.exe -NoProfile -File $watch -CameraId 'cmwya84cq000rr04fznu7n7fr' -IntervalSeconds 60 -MaxCycles 5
```

Enter the **current** private gateway token interactively when prompted. Do not paste it into chat or save it in a file; any token shown in a screenshot should be revoked first. Keep the window open, use `Ctrl+C` to stop it early. Stop the watchdog before revoking the token or switching tenants. A rejected heartbeat causes the watchdog to **stop** instead of retrying indefinitely. The temporary camera list is removed and the token environment variable cleared on normal exit/errors. The simulator binds only to loopback and performs **RTSP OPTIONS**, not live footage playback.

For a continuously running foreground session, omit `-MaxCycles 5`, but only after the bounded trial is verified in the same workspace. A single run every 60 seconds is not a production SLA or long-term resilient service; production installations need a separately reviewed service manager and protected credential store, not saved plaintext tokens.
