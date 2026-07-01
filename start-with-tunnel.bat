@echo off
echo ========================================
echo ANJANI AI SALES OS - Starting with Cloudflare Tunnel
echo ========================================
echo.

REM Check if cloudflared is installed
where cloudflared >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] cloudflared is not installed!
    echo.
    echo Please install cloudflared first:
    echo 1. Download from: https://github.com/cloudflare/cloudflared/releases
    echo 2. Or use winget: winget install --id Cloudflare.cloudflared
    echo.
    pause
    exit /b 1
)

echo [OK] cloudflared found!
echo.

REM Start Next.js dev server in background
echo Starting Next.js dev server on port 3000...
start /B npm run dev > dev-server.log 2> dev-server.err.log

REM Wait a few seconds for the server to start
timeout /t 5 /nobreak > nul

echo.
echo Starting Cloudflare tunnel...
echo ========================================
echo.
echo Your public URLs will appear below:
echo - Customer webhook: https://YOUR-URL/api/webhook/customer
echo - Owner webhook: https://YOUR-URL/api/webhook/owner
echo - Debug endpoint: https://YOUR-URL/api/debug/webhooks
echo.
echo Copy the HTTPS URL and configure it in ChakraHQ dashboard!
echo ========================================
echo.

REM Start cloudflared tunnel
cloudflared tunnel --url http://localhost:3000

REM This will keep running until you press Ctrl+C
