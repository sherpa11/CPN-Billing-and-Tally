@echo off
TITLE CPN VEGETABLES - Wholesale Billing and Management System
COLOR 0A

echo =====================================================================
echo   CPN VEGETABLES - Wholesale Billing and Management System
echo   22-A, Gandhi Market, Dindigul
echo =====================================================================
echo.
echo Starting CPN Billing Server on port 5000...
echo.

cd /d "%~dp0"

:: Start the production server
set NODE_ENV=production
set PORT=5000

:: Open default browser after 3 seconds in background
start "" /B cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:5000"

:: Launch Express backend (which serves API + React Client)
node server/server.js

pause
