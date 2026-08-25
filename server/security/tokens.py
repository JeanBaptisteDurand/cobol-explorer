"""Bearer tokens: compact JWT (HS256) minted and verified in-process, stdlib only.

The workshop authenticates its own users, so it signs a short-lived token instead
of keeping server-side sessions - no session store, no extra dependency. The key
comes from ``COBOL_EXPLORER_JWT_SECRET``; when unset a random one is drawn at
import, which invalidates tokens on restart. That is deliberate: a constant
shipped in the repo would let anyone forge a token against a deployed instance.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time

HEADER = {"alg": "HS256", "typ": "JWT"}
TTL = int(os.environ.get("COBOL_EXPLORER_JWT_TTL", "28800"))  # 8 h - a working day
_SECRET = (os.environ.get("COBOL_EXPLORER_JWT_SECRET") or secrets.token_hex(32)).encode()


def _b64(raw: bytes) -> str:
    """base64url without padding, as the JWT spec requires."""
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _unb64(seg: str) -> bytes:
    return base64.urlsafe_b64decode(seg + "=" * (-len(seg) % 4))


def _seg(obj: dict) -> str:
    return _b64(json.dumps(obj, separators=(",", ":"), sort_keys=True).encode())


def _sign(signing_input: str) -> str:
    return _b64(hmac.new(_SECRET, signing_input.encode(), hashlib.sha256).digest())


def mint(name: str, role: str, ttl: int | None = None, username: str | None = None) -> str:
    """Sign a token carrying who the caller is and which RBAC role they hold.

    ``username`` is the ACCOUNT id (the users.json key). ``sub`` is a display
    name and two accounts may share one ("Sofia" twice) - anything that must
    land on the right account row, like minting an MCP key, needs the claim.
    Absent for federated sign-ins, which have no local account row."""
    now = int(time.time())
    claims = {"sub": name, "role": role, "iat": now, "exp": now + (ttl if ttl is not None else TTL)}
    if username:
        claims["u"] = username
    body = f"{_seg(HEADER)}.{_seg(claims)}"
    return f"{body}.{_sign(body)}"


def read(token: str | None) -> dict | None:
    """Claims of a valid token, else ``None`` - bad shape, bad signature, or expired.

    Every failure mode collapses to ``None`` on purpose: the caller must not be
    able to tell a forged token from an expired one.
    """
    if not token:
        return None
    parts = token.split(".")
    if len(parts) != 3:
        return None
    head, payload, sig = parts
    if not hmac.compare_digest(sig, _sign(f"{head}.{payload}")):
        return None
    try:
        claims = json.loads(_unb64(payload))
    except Exception:
        return None
    if not isinstance(claims, dict) or float(claims.get("exp", 0)) < time.time():
        return None
    return claims


def bearer(headers) -> str | None:
    """The token carried by ``Authorization: Bearer <token>``, if any."""
    raw = headers.get("authorization") or headers.get("Authorization") or ""
    scheme, _, token = raw.partition(" ")
    return token.strip() if scheme.lower() == "bearer" and token.strip() else None
