@echo off
color 0A
echo =========================================================
echo       FINANSRADAR - OTOMATIK BASLATICI VE ONARICI
echo =========================================================

echo.
echo [ADIM 1] Kilitli portlar ve arka plan surecleri temizleniyor...
taskkill /F /IM node.exe /T >nul 2>&1
call npx kill-port 3001 5173 >nul 2>&1

echo.
echo [ADIM 2] Veritabani kilitleri kontrol ediliyor...
cd backend
del /f /q prisma\dev.db-journal >nul 2>&1
cd ..

echo.
echo [ADIM 3] Sistem (Backend ve Frontend) ayni anda baslatiliyor...
echo.
echo Uygulama hazir oldugunda tarayiciniz otomatik olarak acilacaktir.
echo =========================================================
echo.

start http://localhost:5173

call npm run dev
pause
