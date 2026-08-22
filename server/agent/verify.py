"""Citation guardrail (anti-hallucination): re-verify that every ``file:line`` the
agent cites actually exists in the corpus, and that the line is in range. The UI
shows a "sources verified" badge; unresolved citations are flagged, so a plausible
but ungrounded answer cannot pass silently.
"""
from __future__ import annotations

import glob
import os
import re

SOURCE_EXT = ("cbl", "cpy", "jcl", "bms", "csd")
# A citation is a file, optionally followed by its line — written either as
# `lgacdb01.cbl:88` or as `LGACDB01.cbl (line 88)`. Both are the same claim, and
# both must be verified: the badge describes the answer, not the model's phrasing.
# ```?`` : in markdown the file is fenced, so the closing backtick sits between the
# name and its line — "`lgacdb01.cbl` (line 88)".
_LINE = r"(?:\s*[:#]\s*(\d+)|`?\s*[(\[]\s*(?:ligne|line|l\.)\s*(\d+))"
_CITE = re.compile(rf"([\w-]+\.(?:{'|'.join(SOURCE_EXT)}))(?:{_LINE})?", re.I)
# An LLM often writes the *entity* rather than its file — "`LGACDB01` (line 88)".
# That is a real citation and must be verified, not reported as unsourced: the badge
# has to describe the answer, not the wording the model happened to pick.
_ENTITY_CITE = re.compile(r"`?\b([A-Z][A-Z0-9$#@-]{2,9})\b`?\s*[(\[]\s*(?:ligne|line|l\.)\s*(\d+)", re.I)


_index_cache: dict[str, dict[str, str]] = {}


def _corpus_index(corpus_root: str) -> dict[str, str]:
    """lowercased basename -> absolute path, for the whole corpus.

    Mainframe members are quoted in whatever case the reader feels like (LGACDB01.cbl
    on screen, lgacdb01.cbl on disk). Matching by glob is case-sensitive on Linux, so
    every citation resolved on macOS and none did in production — this index removes
    the difference.
    """
    root = os.path.realpath(corpus_root)
    if root not in _index_cache:
        _index_cache[root] = {
            os.path.basename(p).lower(): p
            for ext in SOURCE_EXT
            for p in glob.glob(os.path.join(root, "**", f"*.{ext}"), recursive=True)
            + glob.glob(os.path.join(root, "**", f"*.{ext.upper()}"), recursive=True)
        }
    return _index_cache[root]


def _file_of_entity(corpus_root: str, name: str) -> str | None:
    """The source file of an entity cited by name alone (program, copybook, job)."""
    index = _corpus_index(corpus_root)
    for ext in SOURCE_EXT:
        hit = index.get(f"{name.lower()}.{ext}")
        if hit:
            return os.path.basename(hit)
    return None


def _resolve(corpus_root: str, file: str) -> str | None:
    from safe import safe_corpus_path

    p = safe_corpus_path(corpus_root, file)
    if p and os.path.exists(p):
        return p
    return _corpus_index(corpus_root).get(os.path.basename(file).lower())


def verify_citation(corpus_root: str, file: str, line: int | None) -> dict:
    p = _resolve(corpus_root, file)
    if not p:
        return {"file": file, "line": line, "ok": False, "reason": "file not found"}
    if line is not None:
        with open(p, errors="replace") as fh:
            n = sum(1 for _ in fh)
        if line < 1 or line > n:
            return {"file": os.path.basename(p), "line": line, "ok": False, "reason": f"line out of range (1..{n})"}
    return {"file": os.path.basename(p), "line": line, "ok": True}


def verify_answer(text: str, trace_sources: list[str], corpus_root: str) -> dict:
    cites: set[tuple[str, int | None]] = set()
    for m in _CITE.finditer(text or ""):
        line = m.group(2) or m.group(3)
        cites.add((m.group(1), int(line) if line else None))
    for m in _ENTITY_CITE.finditer(text or ""):
        file = _file_of_entity(corpus_root, m.group(1))
        if file:
            cites.add((file, int(m.group(2))))
    for s in trace_sources or []:
        m = _CITE.fullmatch((s or "").strip())
        if m:
            line = m.group(2) or m.group(3)
            cites.add((m.group(1), int(line) if line else None))
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
