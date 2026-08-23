"""Pluggable caller identity, in decreasing order of trust.

- **Bearer token** (any mode): a signed JWT minted by ``/api/login``. Its claims are
  authoritative - a client cannot change its own role without the signing key.
- ``jwt`` mode: that token is *required*; no token, no access (checked in ``app.gate``).
- ``enforce`` mode: identity headers are trusted ONLY with the shared
  ``X-Cobol-Proxy-Secret``, i.e. injected by an authenticating reverse proxy that already
  validated the user (OIDC/SAML against the corporate IdP) and stripped any inbound
  ``X-Cobol-*``. Use it when SSO must stay outside the app.
- ``open`` mode (default, dev/demo): falls back to the ``X-Cobol-User`` / ``X-Cobol-Role``
  headers. These are client-controlled - NOT a security boundary, only for the demo.

The rest of the app only depends on the returned {name, role}.
"""
from __future__ import annotations

from urllib.parse import unquote

from security import rbac, tokens


def identify(headers) -> dict:
    """Resolve the caller: signed token first, then the demo identity headers."""
    claims = tokens.read(tokens.bearer(headers))
    if claims:
        return {"name": claims.get("sub") or "guest", "role": rbac.canonical(claims.get("role") or "")}
    get = headers.get
    name = unquote(get("x-cobol-user") or "").strip() or "guest"
    role = rbac.canonical(unquote(get("x-cobol-role") or ""))
    return {"name": name, "role": role}
