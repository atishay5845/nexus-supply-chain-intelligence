from __future__ import annotations

import os
from pathlib import Path

APP_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = APP_DIR.parent
DATA_DIR = APP_DIR / "data"
CSV_DIR = DATA_DIR / "csv"
RUNTIME_DIR = BACKEND_DIR / "runtime"
RUNS_DIR = RUNTIME_DIR / "runs"
AUDIT_LOG = RUNTIME_DIR / "append_only_run_log.jsonl"

for directory in (RUNTIME_DIR, RUNS_DIR):
    directory.mkdir(parents=True, exist_ok=True)

if not AUDIT_LOG.exists():
    AUDIT_LOG.touch()

APP_NAME = "NEXUS Supply Chain Intelligence"
APP_VERSION = "1.0.0"
AI_PROVIDER = os.getenv("NEXUS_AI_PROVIDER", "off").strip().lower()
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen3:4b")
