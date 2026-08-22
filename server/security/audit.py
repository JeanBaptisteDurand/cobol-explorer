"""Immutable, append-only, tamper-evident audit trail — who asked / changed what.

Each line is chained with an **HMAC-SHA256** keyed by a server-held secret
(``COBOL_EXPLORER_AUDIT_SECRET``), so re-linking an altered log requires the key,
not just any writer. Denied access attempts are recorded too. Appends take an OS
advisory lock so concurrent workers don't interleave. Production ships this to a
WORM store / SIEM.
"""
from __future__ import annotations

import datetime
import hashlib
import hmac
import json
import os
import threading

# The chain key. It must survive restarts — old entries are verified against it —
# so unlike the JWT secret it cannot default to a random per-process value. The
# demo default is repo-visible, which means: with it, someone who can WRITE the
# log file can also re-link the chain. Tamper evidence is real against everyone
# else; against the key holder it is exactly as strong as the key is secret.
# Deployments set COBOL_EXPLORER_AUDIT_SECRET (documented in the README), and the
# server says so out loud below instead of letting the default pass silently.
_SECRET = os.environ.get("COBOL_EXPLORER_AUDIT_SECRET", "dev-audit-secret-change-in-prod").encode()
if _SECRET == b"dev-audit-secret-change-in-prod" and os.environ.get("COBOL_EXPLORER_AUTH") in ("jwt", "enforce"):
    import logging
    logging.getLogger("uvicorn.error").warning(
        "audit: running with the demo chain key — set COBOL_EXPLORER_AUDIT_SECRET "
        "or the tamper evidence is only as secret as this repository")


def _mac(prev: str, payload: str) -> str:
    return hmac.new(_SECRET, (prev + payload).encode(), hashlib.sha256).hexdigest()


class AuditLog:
    def __init__(self, path: str | None = None):
        self.path = path or os.environ.get("COBOL_EXPLORER_AUDIT", "audit.log.jsonl")
        self._lock = threading.Lock()

    def _last_hash(self) -> str:
        if not os.path.exists(self.path) or os.path.getsize(self.path) == 0:
            return "genesis"
        try:
            with open(self.path, "rb") as fh:
                last = fh.readlines()[-1]
            return json.loads(last)["hash"] if last.strip() else "genesis"
        except Exception:
            return "genesis"

    def record(self, actor: str, role: str, action: str, target: str = "", result: str = "granted") -> dict:
        with self._lock:
            entry = {
                "ts": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "actor": actor, "role": role, "action": action, "target": target, "result": result,
            }
            with open(self.path, "a") as fh:
                _flock(fh)
                entry["prev"] = self._last_hash()  # re-read under the lock (multi-worker safe)
                entry["hash"] = _mac(entry["prev"], json.dumps(_base(entry), sort_keys=True))
                fh.write(json.dumps(entry, ensure_ascii=False) + "\n")
            # Head anchor: persist the latest hash to a sidecar so deleting TRAILING
            # lines (log truncation) is detectable — a forward-only chain check alone
            # can't see a chopped tail (the surviving prefix stays self-consistent).
            with open(self._head_path(), "w") as hf:
                hf.write(entry["hash"])
        return entry

    def _head_path(self) -> str:
        return self.path + ".head"

    def _raw_lines(self) -> list[str]:
        if not os.path.exists(self.path):
            return []
        with open(self.path) as fh:
            return [x for x in fh.readlines() if x.strip()]

    def recent(self, n: int = 100) -> list[dict]:
        out: list[dict] = []
        for x in self._raw_lines()[-n:]:
            try:  # a corrupt line must not crash the view; verify_chain flags it
                out.append(json.loads(x))
            except json.JSONDecodeError:
                continue
        return out

    def verify_chain(self) -> bool:
        """True iff the HMAC chain is intact — no line inserted, altered, or removed
        (including a chopped tail, caught via the persisted head anchor)."""
        prev = "genesis"
        for x in self._raw_lines():
            try:
                e = json.loads(x)
            except json.JSONDecodeError:
                return False  # an unparseable line is tampering, not a display glitch
            if e.get("prev") != prev:
                return False
            if e.get("hash") != _mac(prev, json.dumps(_base(e), sort_keys=True)):
                return False
            prev = e["hash"]
        # Trailing-deletion / truncation detection: the log tail must match the anchor.
        if os.path.exists(self._head_path()):
            try:
                with open(self._head_path()) as fh:
                    anchor = fh.read().strip()
            except OSError:
                anchor = ""
            if anchor and anchor != prev:
                return False
        return True


def _base(e: dict) -> dict:
    # .get so a malformed / legacy line never crashes recent()/verify_chain().
    return {k: e.get(k) for k in ("ts", "actor", "role", "action", "target", "result", "prev")}


def _flock(fh) -> None:
    try:
        import fcntl

        fcntl.flock(fh.fileno(), fcntl.LOCK_EX)
    except Exception:  # non-POSIX / unsupported FS — in-process lock still applies
        pass
