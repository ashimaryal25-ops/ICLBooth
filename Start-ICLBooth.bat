@echo off
REM One-click ICLBooth kiosk launcher.
REM Double-click this file to start the booth + camera mirror.
REM If the booth/mirror land on the wrong screens, edit the line below to add  -SwapMonitors
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-ICLBooth.ps1" %*
