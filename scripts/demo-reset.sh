#!/usr/bin/env bash
# Remet la démo à zéro : corpus original, main propre, 0 version à toi,
# 1 version "Ajustement tarif (Bob)" prête pour le conflit. Relance le serveur.
# Usage : bash scripts/demo-reset.sh
set -e
cd "$(dirname "$0")/.."
PY=.venv/bin/python

echo "→ restauration du corpus original"
git -C corpora/genapp-src checkout -- . 2>/dev/null || true

echo "→ arrêt du serveur + purge des versions"
pkill -f "uvicorn api.app:app" 2>/dev/null || true
sleep 1
rm -rf versions

echo "→ build du frontend + purge audit"
( cd web && npm run build >/dev/null 2>&1 )
cp docs/presentation.html web/dist/ 2>/dev/null; cp -r docs/shots web/dist/ 2>/dev/null
: > audit.log.jsonl; rm -f audit.log.jsonl.head

echo "→ reconstruction du graphe"
PYTHONPATH=packages/core:ingestion $PY -m run_ingest --corpus corpora --out graph.json | grep Wrote

echo "→ démarrage du serveur (Neo4j + pgvector)"
COBOL_EXPLORER_GRAPH_BACKEND=neo4j COBOL_EXPLORER_VECTOR=pgvector \
  COBOL_EXPLORER_WEB=web/dist PYTHONPATH=packages/core:ingestion:server \
  nohup $PY -m uvicorn api.app:app --host 127.0.0.1 --port 8000 >/tmp/cobol-server.log 2>&1 &
until curl -s -m 2 http://127.0.0.1:8000/api/health >/dev/null 2>&1; do sleep 1; done

echo "→ pré-seed de la version de Bob (pour l'étape conflit)"
$PY - <<'PY'
import json, urllib.request
B = "http://127.0.0.1:8000/api"
def H(u): return {"Content-Type": "application/json", "X-Cobol-User": u, "X-Cobol-Role": "D%C3%A9veloppeur"}
def call(p, d, u): return json.load(urllib.request.urlopen(urllib.request.Request(B+p, json.dumps(d).encode(), H(u))))
F = "genapp-src/base/src/lgpolicy.cpy"
b = call("/changesets", {"title": "Ajustement tarif (Bob)", "author": "Bob"}, "Bob")["id"]
base = json.load(urllib.request.urlopen(f"{B}/changesets/{b}/file?path={F}"))["content"]
call(f"/changesets/{b}/edit", {"path": F, "content": base.replace("VALUE +65", "VALUE +80", 1), "note": "Bob: moteur -> +80"}, "Bob")
print("   version de Bob prête (moteur +80)")
PY

echo ""
echo "✓ Démo prête sur http://127.0.0.1:8000  (fais Cmd+Shift+R au 1er chargement)"
echo "  main = propre (moteur +65) · 1 version : Ajustement tarif (Bob)"
