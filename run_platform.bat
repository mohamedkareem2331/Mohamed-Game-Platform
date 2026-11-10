@echo off
title MOHAMED KAREEM GAMES - LOCAL PLATFORM LAUNCHER
echo ========================================================
echo   MOHAMED KAREEM GAMES - PERSONAL GAMING PLATFORM
echo ========================================================
echo.
echo Starting local gaming platform server on http://localhost:8080 ...
echo Press Ctrl+C at any time to stop the server.
echo.

start http://localhost:8080
python -m http.server 8080
pause
