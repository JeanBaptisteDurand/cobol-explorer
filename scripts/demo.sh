#!/usr/bin/env bash
# One command, no infrastructure: `make demo`.
#
# Written for somebody who has just cloned the repository and wants to see the
# product, not configure it. So: no Docker, no API key, no account, nothing to
# sign up for. Everything runs in this process, against the graph and the index
# that are committed to the repository.
#
# The only optional piece is the conversational agent, which needs a local
# Granite through Ollama. Without it the workshop still works completely -
# browsing, the graph, impact, semantic search, versions, diffs, the merge gate
# and the audit chain - and the agent answers structural questions from the
# graph alone, deterministically, saying so in the answer. We check for Ollama
# and tell the truth about which of the two you are getting, rather than letting
# someone discover it from a stack trace.
set -euo pipefail
cd "$(dirname "$0")/.."

PY=.venv/bin/python
say() { printf '\n\033[1m%s\033[0m\n' "$1"; }

# --- 0. the two tools we cannot install for you ------------------------------
# Checked up front with a sentence each, because the alternative is `uv: command
# not found` from three layers down in make.
for tool in uv pnpm; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    case "$tool" in
      uv)   hint="curl -LsSf https://astral.sh/uv/install.sh | sh   (or: brew install uv)";;
      pnpm) hint="npm install -g pnpm   (or: brew install pnpm)";;
    esac
    echo "This demo needs '$tool', which is not installed. Get it with:" >&2
    echo "  $hint" >&2
    exit 1
  fi
done
PORT="${PORT:-8000}"
if command -v lsof >/dev/null 2>&1 && lsof -ti:"$PORT" >/dev/null 2>&1; then
  echo "Port $PORT is already in use - either that IS this demo (open http://127.0.0.1:$PORT)," >&2
  echo "or pick another port: PORT=8001 make demo" >&2
  exit 1
fi

# --- 1. dependencies ---------------------------------------------------------
if [ ! -x "$PY" ]; then
  say "No virtualenv yet - running make setup (a few minutes, once)."
  make setup
fi

# --- 2. the frontend ---------------------------------------------------------
if [ ! -f web/dist/index.html ]; then
  say "Building the frontend."
  (cd web && pnpm install --silent && pnpm build)
fi

# --- 3. the estate -----------------------------------------------------------
# graph.json and index.json are committed precisely so this step is normally a
# no-op: a reviewer should not have to run an ingestion to see the product.
if [ ! -f graph.json ]; then
  say "No graph.json - parsing the corpus."
  make ingest
fi
if [ ! -f index.json ]; then
  say "No index.json - building the semantic index (needs Ollama)."
  make index
fi

# --- 4. is there a local model? ----------------------------------------------
AGENT="deterministic"
if curl -sf --max-time 2 http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  if curl -sf --max-time 2 http://127.0.0.1:11434/api/tags | grep -q "granite3.3"; then
    AGENT="granite"
  else
    AGENT="ollama-no-model"
  fi
fi

cat <<BANNER

  COBOL Explorer - local demo
  ---------------------------
  URL          http://127.0.0.1:8000
  Estate       GenApp (insurance) · switch to CardDemo from the title bar
  Accounts     none needed: open mode, you pick a name and a role on entry
  Infra        none: in-process graph and index, no Docker, no API key
BANNER

case "$AGENT" in
  granite)
    echo "  Agent        IBM Granite via Ollama - full conversational answers"
    ;;
  ollama-no-model)
    echo "  Agent        Ollama is up but granite3.3 is missing. For the full agent:"
    echo "                 ollama pull granite3.3:8b granite-embedding:278m"
    echo "               Until then, answers are deterministic (graph only)."
    ;;
  deterministic)
    echo "  Agent        deterministic (no Ollama running). Everything else works;"
    echo "               questions naming a program, copybook or table are answered"
    echo "               from the graph, with citations, and the answer says so."
    echo "               For the conversational agent: ollama serve, then"
    echo "                 ollama pull granite3.3:8b granite-embedding:278m"
    ;;
esac

cat <<'BANNER'

  Guided tour  starts by itself on the first visit, replayable from the header
  Stop         Ctrl+C

BANNER

# --- 5. serve ----------------------------------------------------------------
# Deliberately the defaults: open auth (no accounts), NetworkX graph, in-process
# JSON vector index. Every scale backend stays opt-in through its own target.
exec env COBOL_EXPLORER_WEB=web/dist \
  PYTHONPATH=packages/core:ingestion:server \
  "$PY" -m uvicorn api.app:app --host 127.0.0.1 --port "${PORT:-8000}"
