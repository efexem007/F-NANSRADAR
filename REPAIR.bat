
@echo off
echo ===================================================
echo   FinansRadar Yerel Sistem Onarici & Baslatici
echo ===================================================

echo [1/4] Calisan Node surecleri temizleniyor (Port kilitlerini cozmek icin)...
taskkill /F /IM node.exe /T 2>nul
set PORT=3001
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :%PORT%') do taskkill /f /pid %%a 2>nul
set PORT=5173
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :%PORT%') do taskkill /f /pid %%a 2>nul

echo [2/4] Veritabani kilidi aciliyor ve istemci guncelleniyor...
cd backend
del /f /q prisma\dev.db-journal 2>nul
call npx prisma generate

echo [3/4] Veritabani semasi senkronize ediliyor...
call npx prisma db push --accept-data-loss

echo [4/4] Sistem baslatiliyor...
start "FinansRadar BACKEND" cmd /c "npm run dev"
cd ../frontend
start "FinansRadar FRONTEND" cmd /c "npm run dev"

echo ===================================================
echo   Sistem baslatildi. Lutfen tarayicidan aciniz.
echo   Frontend: http://localhost:5173
echo ===================================================
pause
