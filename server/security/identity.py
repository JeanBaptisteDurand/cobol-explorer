"""Pluggable caller identity.

- ``open`` mode (default, dev): identity comes from ``X-Cobol-User`` / ``X-Cobol-Role``
  headers. These are client-controlled — NOT a security boundary, only for the demo.
- ``enforce`` mode: the app trusts identity headers ONLY when accompanied by the shared
  ``X-Cobol-Proxy-Secret`` (checked in ``app.gate``), i.e. injected by an authenticating
  reverse proxy that already validated the user (OIDC/SAML against AXA's IdP) and stripped
  any inbound ``X-Cobol-*``. Swap this module for a direct token validator to skip the proxy.
The rest of the app only depends on the returned {name, role}.
"""
from __future__ import annotations

from urllib.parse import unquote

from security import rbac


def identify(headers) -> dict:
    """Resolve the caller from request headers (URL-decoded; latin-1 safe)."""
    get = headers.get
    name = unquote(get("x-cobol-user") or "").strip() or "invité"
    role = rbac.canonical(unquote(get("x-cobol-role") or ""))
    return {"name": name, "role": role}
