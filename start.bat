@echo off
echo =========================================
echo   FinansRadar Pro - Baslatiliyor...
echo =========================================
echo.

cd /d "%~dp0backend"
start "FinansRadar Backend" cmd /k "npm run dev"

cd /d "%~dp0frontend"
start "FinansRadar Frontend" cmd /k "npm run dev"

echo.
echo =========================================
echo   Sunucular baslatildi!
echo   - API: http://localhost:3001
echo   - UI:  http://localhost:5173
echo =========================================
pause
