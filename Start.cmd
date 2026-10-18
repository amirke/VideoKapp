@echo off
cd /d "%~dp0"
if not exist node_modules\electron\dist\electron.exe call Setup.cmd
if errorlevel 1 exit /b 1
if not exist bin\ffmpeg.exe call Setup.cmd
if errorlevel 1 exit /b 1
call npm start
if errorlevel 1 pause
