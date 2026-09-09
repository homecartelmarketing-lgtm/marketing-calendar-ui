@echo off
setlocal enabledelayedexpansion
title HomeCartel - Push Updates to GitHub & Vercel

echo ==============================================================================
echo       HomeCartel Marketing Calendar - Push Updates to Cloud (Vercel)
echo ==============================================================================
echo.

:: Check if git is installed
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Git is not installed or not in PATH!
    pause
    exit /b 1
)

:: Navigate to current script directory
cd /d "%~dp0"

echo [1/3] Checking for code changes...
git status --short
echo.

:: Prompt for commit message
set "COMMIT_MSG="
set /p COMMIT_MSG="[2/3] Enter update description (or press Enter for default): "

if "!COMMIT_MSG!"=="" (
    set "COMMIT_MSG=Update Marketing Calendar UI - %date% %time%"
)

echo.
echo [3/3] Staging, committing, and pushing to GitHub...
echo.

git add .
git commit -m "!COMMIT_MSG!"
if %errorlevel% neq 0 (
    echo.
    echo [INFO] No new changes to commit. Everything is up to date.
    echo.
    pause
    exit /b 0
)

echo.
echo Pushing to GitHub (origin main)...
git push origin main

if %errorlevel% equ 0 (
    echo.
    echo ==============================================================================
    echo  SUCCESS! Successfully pushed to GitHub!
    echo.
    echo  AUTOMATIC DEPLOYMENT IN PROGRESS:
    echo  Vercel has detected the commit and is building the new deployment now.
    echo  Your updates will be live in 30-60 seconds at:
    echo.
    echo  👉 https://marketing-calendar-ui-delta.vercel.app/
    echo ==============================================================================
) else (
    echo.
    echo [ERROR] Push failed. Please check your internet connection or GitHub login.
)

echo.
pause
