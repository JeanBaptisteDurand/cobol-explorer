#!/usr/bin/env bash
# Situation de démo : tu es JB, ta version est EN RETARD sur main (Léa a fusionné
# après que tu aies créé la tienne). À toi de cliquer "Importer main".
# Léa a modifié un AUTRE champ que toi -> l'import est propre (pas de conflit).
# Usage : bash scripts/demo-behind.sh
set -e
cd "$(dirname "$0")/.."
PY=.venv/bin/python

echo "→ restauration du corpus + purge des versions"
git -C corpora/genapp-src checkout -- . 2>/dev/null || true
pkill -f "uvicorn api.app:app" 2>/dev/null || true
sleep 1
rm -rf versions

echo "→ build du frontend + purge audit"
( cd web && npm run build >/dev/null 2>&1 )
cp docs/presentation.html web/dist/ 2>/dev/null; cp -r docs/shots web/dist/ 2>/dev/null
: > audit.log.jsonl; rm -f audit.log.jsonl.head

echo "→ reconstruction du graphe"
PYTHONPATH=packages/core:ingestion $PY -m run_ingest --corpus corpora --out graph.json | grep Wrote

echo "→ démarrage du serveur"
COBOL_EXPLORER_GRAPH_BACKEND=neo4j COBOL_EXPLORER_VECTOR=pgvector \
  COBOL_EXPLORER_WEB=web/dist PYTHONPATH=packages/core:ingestion:server \
  nohup $PY -m uvicorn api.app:app --host 127.0.0.1 --port 8000 >/tmp/cobol-server.log 2>&1 &
until curl -s -m 2 http://127.0.0.1:8000/api/health >/dev/null 2>&1; do sleep 1; done

$PY - <<'PY'
import json, urllib.request
B = "http://127.0.0.1:8000/api"
def H(u): return {"Content-Type": "application/json", "X-Cobol-User": u, "X-Cobol-Role": "D%C3%A9veloppeur"}
def call(p, d, u): return json.load(urllib.request.urlopen(urllib.request.Request(B+p, json.dumps(d).encode(), H(u))))
F = "genapp-src/base/src/lgpolicy.cpy"

# 1) TA version (JB), créée sur main propre. Tu modifies le plafond MOTEUR (+65 -> +72).
jb = call("/changesets", {"title": "Hausse plafond moteur (JB)", "author": "JB"}, "JB")["id"]
base = json.load(urllib.request.urlopen(f"{B}/changesets/{jb}/file?path={F}"))["content"]
call(f"/changesets/{jb}/edit", {"path": F, "content": base.replace("VALUE +65", "VALUE +72", 1), "note": "JB: moteur +65 -> +72"}, "JB")

# 2) Version de Léa, créée sur le MÊME main. Elle modifie un champ LOIN du tien
#    (WS-SUMRY-ENDOW-LEN, ~8 lignes plus bas) pour que l'import soit PROPRE (hunks
#    git non chevauchants) ; puis elle FUSIONNE -> main avance -> ta version "en retard".
lea = call("/changesets", {"title": "Correctif longueur (Lea)", "author": "Lea"}, "Lea")["id"]
lea_lines = base.split("\n")
for i, l in enumerate(lea_lines):
    if "WS-SUMRY-ENDOW-LEN" in l:
        lea_lines[i] = l.replace("+25", "+40")
call(f"/changesets/{lea}/edit", {"path": F, "content": "\n".join(lea_lines), "note": "Lea: sumry-endow +25 -> +40"}, "Lea")
call(f"/changesets/{lea}/status", {"status": "merged"}, "Lea")

st = json.load(urllib.request.urlopen(urllib.request.Request(f"{B}/changesets/{jb}", headers=H("JB"))))["sync"]
print(f"   ta version 'Hausse plafond moteur (JB)' -> {st}")
PY

echo ""
echo "✓ Prêt. Toi = JB. Ta version est EN RETARD sur main (Léa a fusionné après toi)."
echo "  → dans l'app : pastille en haut à droite -> nom 'JB' -> Entrer"
echo "  → barre latérale Versions -> clic 'Hausse plafond moteur (JB)'"
echo "  → panneau Modifs : « en retard de N commits » -> clique « ↓ Importer main »"
echo "  (Léa a touché un autre champ -> l'import est PROPRE, pas de conflit -> « à jour ».)"
