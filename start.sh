#!/usr/bin/env bash
# Anjani AI Sales OS — Agent Startup (bash version for Git Bash / Linux)
set -euo pipefail

TUNNEL_DOMAIN="mangle-gazing-contempt.ngrok-free.dev"

echo "============================================"
echo "   ANJANI AI SALES OS — AGENT STARTUP"
echo "   Permanent Domain: ${TUNNEL_DOMAIN}"
echo "============================================"
echo ""

# ── Step 0: Check Node.js ───────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "[FAIL] Node.js is not installed. Download from https://nodejs.org"
  exit 1
fi
echo "[OK] Node.js: $(node -v)"

# ── Step 1: Load env file ───────────────────────────────────────────
ENV_FILE=""
if [[ -f env.local ]]; then
  ENV_FILE="env.local"
elif [[ -f .env.local ]]; then
  ENV_FILE=".env.local"
elif [[ -f env ]]; then
  ENV_FILE="env"
elif [[ -f .env ]]; then
  ENV_FILE=".env"
else
  echo "[WARN] No .env, .env.local, env, or env.local found! Copy .env.local.example to .env.local"
fi

if [[ -n "$ENV_FILE" ]]; then
  echo "[OK] Loading environment variables from $ENV_FILE"
  # Load env variables line by line while stripping carriage returns (\r)
  while IFS= read -r line || [[ -n "$line" ]]; do
    # Skip comments and empty lines
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" =~ ^[[:space:]]*$ ]] && continue
    
    # Strip carriage return \r
    line=$(echo "$line" | tr -d '\r')
    
    if [[ "$line" =~ ^([^=]+)=(.*)$ ]]; then
      key="${BASH_REMATCH[1]}"
      val="${BASH_REMATCH[2]}"
      
      # Trim leading/trailing whitespace
      key="${key#"${key%%[![:space:]]*}"}"
      key="${key%"${key##*[![:space:]]}"}"
      val="${val#"${val%%[![:space:]]*}"}"
      val="${val%"${val##*[![:space:]]}"}"
      
      # Remove surrounding quotes if any
      val="${val#\"}"
      val="${val%\"}"
      val="${val#\'}"
      val="${val%\'}"
      
      export "$key=$val"
    fi
  done < "$ENV_FILE"
fi

# ── Step 2: Validate env vars ───────────────────────────────────────
echo ""
echo "--- Environment Check ---"

MISSING_ENV=0
[[ -z "${CHAKRA_API_KEY:-}" ]] && echo "[WARN] CHAKRA_API_KEY is missing — WhatsApp will not work" && ((MISSING_ENV++)) || echo "[OK] CHAKRA_API_KEY is set"
[[ -z "${CHAKRA_PLUGIN_ID:-}" ]] && echo "[WARN] CHAKRA_PLUGIN_ID is missing" && ((MISSING_ENV++)) || echo "[OK] CHAKRA_PLUGIN_ID is set"
[[ -z "${CHAKRA_PHONE_ID:-}" ]] && echo "[WARN] CHAKRA_PHONE_ID is missing" && ((MISSING_ENV++)) || echo "[OK] CHAKRA_PHONE_ID is set"
[[ -z "${SARVAM_API_KEY:-}" ]] && echo "[WARN] SARVAM_API_KEY is missing — AI chat will not work" && ((MISSING_ENV++)) || echo "[OK] SARVAM_API_KEY is set"
[[ -z "${OWNER_PHONE:-}" ]] && echo "[WARN] OWNER_PHONE is not set — Guru escalation won't route" || echo "[OK] OWNER_PHONE set to $OWNER_PHONE"

# ── Step 3: Install dependencies if needed ──────────────────────────
if [[ ! -d "node_modules/next" ]]; then
  echo ""
  echo "--- Installing dependencies ---"
  npm install
  echo "[OK] Dependencies installed"
fi

# ── Step 4: Initialize database & runtime data ──────────────────────
echo ""
echo "--- Initializing Database ---"

mkdir -p data/runtime

ISO_DATE=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
printf '{\n  "agentEnabled": true,\n  "raviEnabled": true,\n  "outboundSalesEnabled": false,\n  "autoSendRaviReplies": true,\n  "updatedAt": "%s"\n}\n' "$ISO_DATE" > data/runtime/agent-state.json

echo "[OK] Database directory ready"
echo "[OK] Agent state initialized — Ravi is ENABLED and auto-reply is ON"

# ── Step 5: Check ngrok existence ───────────────────────────────────
NGROK_MISSING=0
NGROK_BIN=""

if command -v ngrok &>/dev/null; then
  NGROK_BIN="ngrok"
elif [[ -f "ngrok" ]]; then
  NGROK_BIN="./ngrok"
elif [[ -f "ngrok.exe" ]]; then
  NGROK_BIN="./ngrok.exe"
else
  echo "[WARN] ngrok not found in PATH or project root. Tunnel won't auto-start."
  NGROK_MISSING=1
fi

# ── Step 6: Kill stale ngrok and port 3000 processes ───────────────
pkill -f ngrok.exe 2>/dev/null || true
pkill ngrok 2>/dev/null || true
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
  cmd /c "for /f \"tokens=5\" %a in ('netstat -aon ^| findstr :3000') do taskkill /F /PID %a >nul 2>&1" || true
else
  lsof -ti:3000 | xargs kill -9 2>/dev/null || true
fi
sleep 1

# ── Step 7: Start ngrok tunnel ──────────────────────────────────────
if [[ "$NGROK_MISSING" == "0" ]]; then
  echo ""
  echo "[1/3] Starting ngrok tunnel..."

  if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    # Windows: start in a new window
    start "NGROK TUNNEL - DO NOT CLOSE" cmd /c "$NGROK_BIN http 3000" &
  else
    # Linux/macOS: background
    "$NGROK_BIN" http 3000 --log=stdout > /dev/null 2>&1 &
  fi
  sleep 5
  echo "[OK] ngrok tunnel started"
else
  echo ""
  echo "[SKIP] ngrok tunnel — binary not found"
fi

# ── Step 8: Show summary ────────────────────────────────────────────
echo ""
echo "============================================"
echo "             STARTUP SUMMARY"
echo "============================================"
echo ""
echo " Agent Status:        ENABLED (Ravi + Guru)"
echo " Auto Reply:          ON"
echo " Database:            data/sales_agent.db"
echo ""
echo " Configure in ChakraHQ Dashboard → Settings → Webhooks:"
echo ""
echo " Customer Webhook URL:"
echo "   https://${TUNNEL_DOMAIN}/api/webhook/customer"
echo ""
echo " Owner Webhook URL:"
echo "   https://${TUNNEL_DOMAIN}/api/webhook/owner"
echo ""
echo " Dashboard (local):   http://localhost:3000"
echo " Dashboard (public):  https://${TUNNEL_DOMAIN}"
echo " System Status:       http://localhost:3000/api/system/status"
echo " Agent State:         http://localhost:3000/api/agent/state"
echo ""
if [[ "$MISSING_ENV" -gt 0 ]]; then
  echo " ⚠ $MISSING_ENV env variable(s) missing — check warnings above!"
fi
echo "============================================"
echo ""
echo "[2/3] Starting Next.js dev server..."
echo ""

# ── Step 9: Open dashboard in browser (detect platform) ─────────────
sleep 3
echo "Opening http://localhost:3000 in browser..."
case "$OSTYPE" in
  msys|cygwin)  start http://localhost:3000 ;;
  darwin*)      open http://localhost:3000 ;;
  linux*)       xdg-open http://localhost:3000 2>/dev/null || true ;;
esac

# ── Step 10: Start Next.js ──────────────────────────────────────────
exec npm run dev
