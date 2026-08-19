"""Path confinement: keep every file access inside the corpus root.

Rejects absolute paths and ``..`` escapes. Used by every endpoint that turns a
client-supplied path into a file read (/api/file, /api/source, change-sets).
"""
from __future__ import annotations

import os


def safe_corpus_path(corpus_root: str, rel: str) -> str | None:
    """Resolve ``rel`` under ``corpus_root``; return the real path, or None if it
    escapes the corpus (absolute path, symlink out, ``../`` traversal)."""
    if not rel:
        return None
    base = os.path.realpath(corpus_root)
    candidate = os.path.realpath(os.path.join(base, rel))
    if candidate == base or candidate.startswith(base + os.sep):
        return candidate
    return None
