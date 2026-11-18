#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT/backend"
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000 &
API_PID=$!
cd "$ROOT/frontend"
if [ ! -d node_modules ]; then npm install; fi
npm run dev
kill "$API_PID" 2>/dev/null || true
