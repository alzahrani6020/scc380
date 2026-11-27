@echo off
setlocal EnableExtensions
rem One-click, user-initiated local camera/microphone test. Does not start cloud streaming.
cd /d "%~dp0.."
where node.exe >nul 2>&1
if errorlevel 1 (
  echo STATUS: FAIL - Node.js not available.
  pause
  exit /b 1
)
set "SCC_FFMPEG=ffmpeg"
set "SCC_FFPROBE=ffprobe"
where ffmpeg.exe >nul 2>&1
if errorlevel 1 (
  rem Known WinGet package layout. No install, download or mutation performed.
  for /d %%G in ("%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg_*") do (
    for /d %%B in ("%%~fG\ffmpeg-*_build") do (
      if exist "%%~fB\bin\ffmpeg.exe" (
        set "SCC_FFMPEG=%%~fB\bin\ffmpeg.exe"
        set "SCC_FFPROBE=%%~fB\bin\ffprobe.exe"
      )
    )
  )
)
if /i "%SCC_FFMPEG%"=="ffmpeg" (
  where ffmpeg.exe >nul 2>&1
  if errorlevel 1 (
    echo STATUS: FAIL - FFmpeg not found on this computer.
    pause
    exit /b 1
  )
)
echo SCC380 local recording: starting 15 seconds with automatic microphone selection.
node "scripts\surveillance-windows-av.mjs" --record --duration 15 --ffmpeg "%SCC_FFMPEG%" --ffprobe "%SCC_FFPROBE%"
if errorlevel 1 (
  echo STATUS: FAIL - check microphone permissions and device availability.
  pause
  exit /b 1
)
echo STATUS: RECORDING_CREATED
start "" explorer.exe "%LOCALAPPDATA%\SCC380\av-tests"
pause
