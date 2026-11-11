@echo off
title MOHAMED KAREEM GAMES - ONE-CLICK GITHUB SYNC
echo ========================================================
echo   SYNCING MOHAMED KAREEM GAMES TO GITHUB
echo ========================================================
echo.
cd /d "%~dp0"

echo [1/3] Adding all updated files and games...
git add .

echo [2/3] Creating commit...
git commit -m "Update games and platform (%date% %time%)"

echo [3/3] Pushing to GitHub...
git push origin main

echo.
echo ========================================================
echo   SUCCESS! Everything is uploaded to GitHub!
echo   GitHub Pages will update your live site in ~60 seconds.
echo ========================================================
echo.
pause
