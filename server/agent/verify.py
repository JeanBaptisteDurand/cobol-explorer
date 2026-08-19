"""Citation guardrail (anti-hallucination): re-verify that every ``file:line`` the
agent cites actually exists in the corpus, and that the line is in range. The UI
shows a "sources vérifiées" badge; unresolved citations are flagged, so a plausible
but ungrounded answer cannot pass silently.
"""
from __future__ import annotations

import glob
import os
import re

_CITE = re.compile(r"([\w-]+\.(?:cbl|cpy|jcl|bms|csd))(?::(\d+))?", re.I)


def _resolve(corpus_root: str, file: str) -> str | None:
    from safe import safe_corpus_path

    p = safe_corpus_path(corpus_root, file)
    if p and os.path.exists(p):
        return p
    hits = glob.glob(os.path.join(os.path.realpath(corpus_root), "**", os.path.basename(file)), recursive=True)
    return hits[0] if hits else None


def verify_citation(corpus_root: str, file: str, line: int | None) -> dict:
    p = _resolve(corpus_root, file)
    if not p:
        return {"file": file, "line": line, "ok": False, "reason": "fichier introuvable"}
    if line is not None:
        with open(p, errors="replace") as fh:
            n = sum(1 for _ in fh)
        if line < 1 or line > n:
            return {"file": os.path.basename(p), "line": line, "ok": False, "reason": f"ligne hors bornes (1..{n})"}
    return {"file": os.path.basename(p), "line": line, "ok": True}


def verify_answer(text: str, trace_sources: list[str], corpus_root: str) -> dict:
    cites: set[tuple[str, int | None]] = set()
    for m in _CITE.finditer(text or ""):
        cites.add((m.group(1), int(m.group(2)) if m.group(2) else None))
    for s in trace_sources or []:
        m = _CITE.fullmatch((s or "").strip())
        if m:
            cites.add((m.group(1), int(m.group(2)) if m.group(2) else None))
    results = [verify_citation(corpus_root, f, ln) for f, ln in sorted(cites, key=lambda x: (x[0], x[1] or 0))]
    return {
        "citations": results,
        "count": len(results),
        # all_grounded: of the citations present, do they all resolve? (True for zero,
        # vacuously — used by the UI badge, which is only shown when count>0).
        "all_grounded": all(r["ok"] for r in results) if results else True,
        # grounded: STRICT — at least one citation AND all resolve. This is what an
        # answer must satisfy to count as source-backed; an uncited answer is NOT
        # grounded (it gets no free pass in the eval).
        "grounded": bool(results) and all(r["ok"] for r in results),
    }
