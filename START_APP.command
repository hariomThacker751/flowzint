#!/bin/bash
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

cd "$(dirname "$0")"

# ── Load env file ──────────────────────────────────────────────────
ENV_FILE=""
if [[ -f env.local ]]; then
  ENV_FILE="env.local"
elif [[ -f .env.local ]]; then
  ENV_FILE=".env.local"
elif [[ -f env ]]; then
  ENV_FILE="env"
elif [[ -f .env ]]; then
  ENV_FILE=".env"
fi

if [[ -n "$ENV_FILE" ]]; then
  echo "Loading environment variables from $ENV_FILE ..."
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" =~ ^[[:space:]]*$ ]] && continue
    line=$(echo "$line" | tr -d '\r')
    if [[ "$line" =~ ^([^=]+)=(.*)$ ]]; then
      key="${BASH_REMATCH[1]}"
      val="${BASH_REMATCH[2]}"
      key="${key#"${key%%[![:space:]]*}"}"
      key="${key%"${key##*[![:space:]]}"}"
      val="${val#"${val%%[![:space:]]*}"}"
      val="${val%"${val##*[![:space:]]}"}"
      val="${val#\"}"
      val="${val%\"}"
      val="${val#\'}"
      val="${val%\'}"
      export "$key=$val"
    fi
  done < "$ENV_FILE"
fi

echo "============================================"
echo "   ANJANI AI SALES OS — Starting..."
echo "============================================"
echo ""

# Find npm/node via nvm if needed
for p in /opt/homebrew/bin /usr/local/bin ~/.nvm/versions/node/*/bin; do
  [ -x "$p/npm" ] && export PATH="$p:$PATH" && break
done

echo "Node: $(node -v 2>/dev/null || echo 'not found')"
echo "npm:  $(npm -v 2>/dev/null || echo 'not found')"
echo ""

# Kill any stale Next.js server on port 3000
lsof -ti tcp:3000 | xargs kill -9 2>/dev/null && echo "Cleared port 3000" || true
echo ""

# Install dependencies if missing
if [ ! -f "node_modules/.bin/next" ]; then
  echo "Installing dependencies (first run)..."
  npm install
  echo ""
fi

# Rebuild better-sqlite3 if native bindings are missing or broken
echo "Checking SQLite native bindings..."
if ! node -e "require('better-sqlite3')" 2>/dev/null; then
  echo "Rebuilding better-sqlite3 for Node $(node -v)..."
  npm rebuild better-sqlite3
  echo "Done."
else
  echo "SQLite OK."
fi
echo ""

echo "Starting on http://localhost:3000 ..."
echo ""

# Wait for server to be ready, then open browser
(
  for i in $(seq 1 30); do
    sleep 1
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
      open http://localhost:3000
      break
    fi
  done
) &

npm run dev
