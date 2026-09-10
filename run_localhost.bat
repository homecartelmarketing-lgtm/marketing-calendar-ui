@echo off
setlocal enabledelayedexpansion
title HomeCartel Marketing Calendar - Localhost

echo ==============================================================================
echo       HomeCartel Marketing Calendar UI - Localhost Server
echo ==============================================================================
echo.

cd /d "%~dp0"

echo [1/2] Checking dependencies...
where pnpm >nul 2>nul
if %errorlevel% equ 0 (
    set "RUN_CMD=pnpm run dev"
) else (
    set "RUN_CMD=npm run dev"
)

echo [2/2] Opening browser at http://localhost:3000 ...
start http://localhost:3000

echo.
echo Starting Next.js Dev Server (!RUN_CMD!)...
echo Press Ctrl+C in this window to stop the server.
echo.
!RUN_CMD!

pause
