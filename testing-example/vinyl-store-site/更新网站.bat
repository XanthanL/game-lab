@echo off
rem Update site data: drag your exported CSV onto this file icon.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0update.ps1" %1
echo.
pause
