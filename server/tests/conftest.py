"""Shared test bootstrap.

The audit log path is read from COBOL_EXPLORER_AUDIT when api.app is imported,
default "audit.log.jsonl" in the working directory - the developer's live log.
Two test modules already redirected it per-test, but any test that imports the
app without doing so appended its merges and refusals to the real file, and
those junk entries ended up photographed on the public landing page. Session-
scoped here, before anything imports the app, so no test can forget.
"""
import os
import tempfile

_dir = tempfile.mkdtemp(prefix="cobol-explorer-test-audit-")
os.environ.setdefault("COBOL_EXPLORER_AUDIT", os.path.join(_dir, "audit.jsonl"))
