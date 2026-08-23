#!/usr/bin/env bash
# Generate the "How IBM Bob was used" attribution table - from git, not from memory.
#
# Why this exists: a jury can verify a dated, quantified claim ("Bob authored 4,900
# lines between these two timestamps") and cannot verify "Bob helped a lot". The only
# honest way to produce the first kind of claim is to record it while you work.
#
# HOW TO RECORD A BOB SESSION
#   Commit your Bob work with a trailer, on its own:
#     git commit -m "feat(x): ..." -m "Tool: IBM-Bob"
#   Everything else stays untagged. This script then counts only what is tagged.
#
# USAGE
#   scripts/bob-attribution.sh                 # every commit carrying the trailer
#   scripts/bob-attribution.sh --since 2026-08-20 --until 2026-08-27
set -euo pipefail
cd "$(dirname "$0")/.."

TRAILER="${BOB_TRAILER:-Tool: IBM-Bob}"
RANGE=()
while [ $# -gt 0 ]; do
  case "$1" in
    --since) RANGE+=(--since "$2"); shift 2 ;;
    --until) RANGE+=(--until "$2"); shift 2 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

COMMITS=$(git log "${RANGE[@]+"${RANGE[@]}"}" --grep="$TRAILER" --format=%H)
if [ -z "$COMMITS" ]; then
  echo "No commit carries the trailer \"$TRAILER\"."
  echo "Tag your Bob sessions with:  git commit -m \"...\" -m \"$TRAILER\""
  exit 0
fi

count=$(echo "$COMMITS" | wc -l | tr -d ' ')
first=$(echo "$COMMITS" | tail -1)
last=$(echo "$COMMITS" | head -1)

echo "### How IBM Bob was used - measured from git"
echo
echo "| | |"
echo "|---|---|"
echo "| Commits authored in Bob | **$count** |"
echo "| Window | **$(git show -s --format=%cI "$first")** → **$(git show -s --format=%cI "$last")** |"

# Lines added/removed across those commits only, excluding generated artefacts so the
# number reflects authored code rather than a rebuilt graph.json or lockfile.
stats=$(for c in $COMMITS; do
  git show --numstat --format="" "$c" -- \
    ':(exclude)*.json' ':(exclude)*lock*' ':(exclude)web/dist/*' ':(exclude)corpora/*' ':(exclude)systems/*'
done | awk '{a+=$1; d+=$2} END {print a"|"d}')
echo "| Lines added / removed (excluding generated files) | **+${stats%|*} / −${stats#*|}** |"

echo
echo "**Files Bob touched, by area:**"
echo
for c in $COMMITS; do
  git show --name-only --format="" "$c"
done | grep -v '^$' | sort -u | awk -F/ '{print $1"/"($2==""?"":$2)}' | sort | uniq -c | sort -rn |
  awk '{printf "- `%s` - %d file(s)\n", $2, $1}'

echo
echo "**Commits:**"
echo
for c in $COMMITS; do
  printf -- "- \`%s\` %s - %s\n" "$(git show -s --format=%h "$c")" "$(git show -s --format=%cs "$c")" "$(git show -s --format=%s "$c")"
done
