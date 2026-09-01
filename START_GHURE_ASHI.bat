@echo off
setlocal
cd /d "%~dp0"
title Ghure Ashi Launcher

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-app.ps1"

if errorlevel 1 (
  echo.
  echo Ghure Ashi could not be started. Read the message above, then press any key.
  pause >nul
)

endlocal
