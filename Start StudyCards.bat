@echo off
cd /d "%~dp0"
title StudyCards
echo ===================================================
echo    StudyCards is starting up...
echo.
echo    Keep this black window OPEN while you study.
echo    Your web browser will open by itself in a moment.
echo.
echo    To STOP the app: just close this window.
echo ===================================================
echo.
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep 6; Start-Process 'http://localhost:3000'"
call npm run start
echo.
echo StudyCards has stopped. You can close this window.
pause
