@echo off
title Anjani AI Sales OS — Agent Startup
color 0A

setlocal enabledelayedexpansion

echo ============================================
echo    ANJANI AI SALES OS — AGENT STARTUP
echo    Permanent Domain: mangle-gazing-contempt.ngrok-free.dev
echo ============================================
echo.

REM ── Step 0: Check Node.js ─────────────────────────────────────────────
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [FAIL] Node.js is not installed. Download from https://nodejs.org
    pause
    exit /b 1
)
echo [OK] Node.js found:
node -v

REM ── Step 1: Load environment configuration file ──────────────────────
if exist env.local (
    echo [OK] Using env.local for configuration
    set "ENV_FILE=env.local"
) else if exist .env.local (
    echo [OK] Using .env.local for configuration
    set "ENV_FILE=.env.local"
) else if exist env (
    echo [OK] Using env for configuration
    set "ENV_FILE=env"
) else if exist .env (
    echo [OK] Using .env for configuration
    set "ENV_FILE=.env"
) else (
    echo [WARN] No env configuration file found! Copy .env.local.example to .env.local
)

REM ── Step 2: Validate critical environment variables ──────────────────
echo.
echo --- Environment Check ---

set "MISSING_ENV=0"

REM Read env vars from the file (crude but works for batch)
for /f "usebackq tokens=1,* delims==" %%a in ("%ENV_FILE%") do (
    if /i "%%a"=="CHAKRA_API_KEY" set "CHAKRA_VAL=%%b"
    if /i "%%a"=="CHAKRA_PLUGIN_ID" set "PLUGIN_VAL=%%b"
    if /i "%%a"=="CHAKRA_PHONE_ID" set "PHONE_VAL=%%b"
    if /i "%%a"=="SARVAM_API_KEY" set "SARVAM_VAL=%%b"
    if /i "%%a"=="OWNER_PHONE" set "OWNER_VAL=%%b"
)

if "%CHAKRA_VAL%"=="" (
    echo [WARN] CHAKRA_API_KEY is missing — WhatsApp messaging will fail
    set /a MISSING_ENV+=1
) else (
    echo [OK] CHAKRA_API_KEY is set
)
if "%PLUGIN_VAL%"=="" (
    echo [WARN] CHAKRA_PLUGIN_ID is missing
    set /a MISSING_ENV+=1
) else (
    echo [OK] CHAKRA_PLUGIN_ID is set
)
if "%PHONE_VAL%"=="" (
    echo [WARN] CHAKRA_PHONE_ID is missing
    set /a MISSING_ENV+=1
) else (
    echo [OK] CHAKRA_PHONE_ID is set
)
if "%SARVAM_VAL%"=="" (
    echo [WARN] SARVAM_API_KEY is missing — AI chat will not work
    set /a MISSING_ENV+=1
) else (
    echo [OK] SARVAM_API_KEY is set
)
if "%OWNER_VAL%"=="" (
    echo [WARN] OWNER_PHONE is not set — Guru owner escalation will not route
) else (
    echo [OK] OWNER_PHONE is set to %OWNER_VAL%
)

REM ── Step 3: Install dependencies if needed ───────────────────────────
if not exist "node_modules\next\package.json" (
    echo.
    echo --- Installing dependencies ---
    call npm install
    if %errorlevel% neq 0 (
        echo [FAIL] npm install failed. Fix errors and try again.
        pause
        exit /b 1
    )
    echo [OK] Dependencies installed
)

REM ── Step 4: Initialize database & runtime data ───────────────────────
echo.
echo --- Initializing Database ---

if not exist "data" mkdir data
if not exist "data\runtime" mkdir data\runtime

REM Seed agent state — ENABLED by default (so it works out of the box)
echo {> "data\runtime\agent-state.json"
echo   "agentEnabled": true,>> "data\runtime\agent-state.json"
echo   "raviEnabled": true,>> "data\runtime\agent-state.json"
echo   "outboundSalesEnabled": false,>> "data\runtime\agent-state.json"
echo   "autoSendRaviReplies": true,>> "data\runtime\agent-state.json"
echo   "updatedAt": "%DATE:~10,4%-%DATE:~4,2%-%DATE:~7,2%T%TIME:~0,2%:%TIME:~3,2%:%TIME:~6,2%.000Z">> "data\runtime\agent-state.json"
echo }>> "data\runtime\agent-state.json"

echo [OK] Database directory ready
echo [OK] Agent state initialized — Ravi is ENABLED and auto-reply is ON
echo [OK] SQLite database will auto-create on first request

REM ── Step 5: Ensure ngrok exists ──────────────────────────────────────
set "NGROK_MISSING=0"
set "NGROK_BIN="

where ngrok >nul 2>&1
if %errorlevel% equ 0 (
    set "NGROK_BIN=ngrok"
) else if exist "ngrok.exe" (
    set "NGROK_BIN=.\ngrok.exe"
) else (
    echo [WARN] ngrok not found in PATH or project root.
    echo        Download from https://ngrok.com/download
    echo        The tunnel will NOT start automatically.
    set "NGROK_MISSING=1"
)

REM ── Step 6: Kill stale processes ─────────────────────────────────────
taskkill /F /IM ngrok.exe >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do taskkill /F /PID %%a >nul 2>&1

REM ── Step 7: Start ngrok tunnel ───────────────────────────────────────
if "%NGROK_MISSING%"=="0" (
    echo.
    echo [1/3] Starting ngrok tunnel...
    start "NGROK TUNNEL - DO NOT CLOSE" cmd /k "%NGROK_BIN% http 3000 --log=stdout"
    timeout /t 5 /nobreak >nul
    echo [OK] ngrok tunnel started
) else (
    echo.
    echo [SKIP] ngrok tunnel — ngrok not found
)

REM ── Step 8: Show startup summary ──────────────────────────────────────
echo.
echo ============================================
echo             STARTUP SUMMARY
echo ============================================
echo.
echo  Agent Status:        ENABLED (Ravi + Guru)
echo  Auto Reply:          ON
echo  Database:            data/sales_agent.db
echo.
echo  Configure these in ChakraHQ Dashboard -> Settings -> Webhooks:
echo.
echo  Customer Webhook URL:
echo    https://mangle-gazing-contempt.ngrok-free.dev/api/webhook/customer
echo.
echo  Owner Webhook URL:
echo    https://mangle-gazing-contempt.ngrok-free.dev/api/webhook/owner
echo.
echo  Dashboard Local:
echo    http://localhost:3000
echo.
echo  Dashboard Public:
echo    https://mangle-gazing-contempt.ngrok-free.dev
echo.
echo  System Status (after startup):
echo    http://localhost:3000/api/system/status
echo.
echo  Agent State (check/set):
echo    http://localhost:3000/api/agent/state
echo.
if %MISSING_ENV% gtr 0 (
    echo  ⚠ %MISSING_ENV% environment variables missing — check warnings above!
)
echo ============================================
echo.
echo [2/3] Starting Next.js dev server...
echo.

REM ── Step 9: Open dashboard in default browser ─────────────────────────
echo Opening dashboard in browser...
timeout /t 3 /nobreak >nul
start http://localhost:3000

REM ── Step 10: Start Next.js dev server ────────────────────────────────
REM This window stays open with the dev server logs
npm run dev
