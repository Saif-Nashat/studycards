@echo off
cd /d "%~dp0"
title StudyCards - First-time setup
echo ===================================================
echo    StudyCards one-time setup
echo    This installs everything and builds the app.
echo    It can take a few minutes. Please wait...
echo ===================================================
echo.
echo [1/3] Installing components...
call npm install
echo.
echo [2/3] Preparing the database and starter cards...
call npm run setup
echo.
echo [3/3] Building the app...
call npm run build
echo.
echo ===================================================
echo    Done! From now on, just double-click
echo    "Start StudyCards" to use the app.
echo ===================================================
pause
