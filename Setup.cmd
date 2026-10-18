@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22 or newer from https://nodejs.org/en/download and run Setup.cmd again.
  pause
  exit /b 1
)
node -e "if(Number(process.versions.node.split('.')[0])<22)process.exit(1)"
if errorlevel 1 exit /b 1
call npm ci
if errorlevel 1 goto failed
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup-ffmpeg.ps1"
if errorlevel 1 goto failed
echo Setup complete. Run Start.cmd.
exit /b 0
:failed
echo Setup failed. Review the error above.
pause
exit /b 1
