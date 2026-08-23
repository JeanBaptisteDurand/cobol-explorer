#!/usr/bin/env bash
# Serve the workshop on a THROWAWAY copy of the estate, with real authentication.
#
# Why a copy: merging a version calls export_main(), which writes the merged result
# back into the corpus - by design, that is how "apply the change to the patrimony"
# works. Run the governance scenario against the repo's own corpora/ and it rewrites
# your source files. This script gives the scenario its own corpus, versions, account
# store and audit log, all under a temp directory that is wiped on exit.
set -euo pipefail

cd "$(dirname "$0")/.."
PORT="${PORT:-8000}"
SANDBOX="$(mktemp -d "${TMPDIR:-/tmp}/cobol-explorer-sandbox.XXXXXX")"
trap 'rm -rf "$SANDBOX"' EXIT

cp -R corpora "$SANDBOX/corpora"
.venv/bin/python -c "import sys; sys.path[:0]=['packages/core','ingestion']; from run_ingest import ingest; ingest('$SANDBOX/corpora', '$SANDBOX/graph.json')" >/dev/null

echo "sandbox: $SANDBOX   ·   http://127.0.0.1:$PORT   ·   auth: jwt"
COBOL_EXPLORER_AUTH=jwt \
COBOL_EXPLORER_JWT_SECRET="${COBOL_EXPLORER_JWT_SECRET:-sandbox-secret}" \
COBOL_EXPLORER_CORPUS="$SANDBOX/corpora" \
COBOL_EXPLORER_GRAPH="$SANDBOX/graph.json" \
COBOL_EXPLORER_VERSIONS="$SANDBOX/versions" \
COBOL_EXPLORER_USERS="$SANDBOX/users.json" \
COBOL_EXPLORER_AUDIT="$SANDBOX/audit.jsonl" \
COBOL_EXPLORER_WEB=web/dist \
PYTHONPATH=packages/core:ingestion:server \
  .venv/bin/python -m uvicorn api.app:app --host 127.0.0.1 --port "$PORT"
