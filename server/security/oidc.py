"""“Sign in with IBM” — OAuth 2.0 authorization-code flow against IBM Cloud App ID.

Two different OAuth2 exchanges live in this project and they are easy to confuse:

- **machine-to-machine** (``ibm_watsonx_ai``): the API key is swapped for an IAM token
  so the agent may call Granite. No human involved.
- **this module**: a *person* signs in with their IBMid, and App ID hands us back who
  they are. The result is mapped onto the same signed token every other caller uses,
  so the rest of the app never learns there is a second way in.

Configuration (all four required; without them the button simply is not offered):

    COBOL_EXPLORER_OIDC_TENANT=<App ID tenant guid>
    COBOL_EXPLORER_OIDC_REGION=us-south
    COBOL_EXPLORER_OIDC_CLIENT_ID=...
    COBOL_EXPLORER_OIDC_SECRET=...

The role an IBM sign-in receives is deliberately the least privileged one that can
still use the workshop (``COBOL_EXPLORER_OIDC_ROLE``, default ``risk``: read and
propose, never merge). Federating an identity says who someone is, not what they are
allowed to do here — that stays a decision of this deployment.
"""
from __future__ import annotations

import base64
import json
import os
import secrets
import time
import urllib.parse

import httpx

TENANT = os.environ.get("COBOL_EXPLORER_OIDC_TENANT", "")
REGION = os.environ.get("COBOL_EXPLORER_OIDC_REGION", "us-south")
CLIENT_ID = os.environ.get("COBOL_EXPLORER_OIDC_CLIENT_ID", "")
SECRET = os.environ.get("COBOL_EXPLORER_OIDC_SECRET", "")
ROLE = os.environ.get("COBOL_EXPLORER_OIDC_ROLE", "risk")
PUBLIC_URL = os.environ.get("COBOL_EXPLORER_PUBLIC_URL", "http://127.0.0.1:8000").rstrip("/")

BASE = f"https://{REGION}.appid.cloud.ibm.com/oauth/v4/{TENANT}"
REDIRECT_URI = f"{PUBLIC_URL}/api/auth/ibm/callback"
STATE_TTL = 600


def ready() -> bool:
    """True when the deployment is wired to an App ID tenant."""
    return bool(TENANT and CLIENT_ID and SECRET)


# --- CSRF state ---------------------------------------------------------------
# The state is signed rather than stored: a single worker holding it in memory would
# lose every in-flight login on restart, and a shared store is overkill for a value
# that lives ten minutes. Same idea as the session token, one directory up.
def _sign(payload: str) -> str:
    import hashlib
    import hmac

    return hmac.new(SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()[:32]


def new_state() -> str:
    payload = f"{secrets.token_urlsafe(12)}.{int(time.time())}"
    return f"{payload}.{_sign(payload)}"


def valid_state(state: str) -> bool:
    import hmac

    try:
        nonce, issued, signature = (state or "").rsplit(".", 2)
    except ValueError:
        return False
    payload = f"{nonce}.{issued}"
    if not hmac.compare_digest(signature, _sign(payload)):
        return False
    return time.time() - int(issued) < STATE_TTL


# --- the flow -----------------------------------------------------------------
def authorization_url(state: str) -> str:
    """Where to send the browser to start the sign-in."""
    query = urllib.parse.urlencode({
        "client_id": CLIENT_ID,
        "response_type": "code",
        "redirect_uri": REDIRECT_URI,
        "scope": "openid",
        "state": state,
    })
    return f"{BASE}/authorization?{query}"


def _claims_of(id_token: str) -> dict:
    """Read the claims of an id_token.

    Not a verification: the token was just fetched over TLS from the token endpoint,
    authenticated with our client secret — it never passed through the browser. A
    token arriving by any other route must not be trusted by this function.
    """
    try:
        payload = id_token.split(".")[1]
        return json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
    except Exception:
        return {}


def exchange(code: str) -> dict | None:
    """Swap the authorization code for the caller's identity, or ``None``."""
    try:
        response = httpx.post(
            f"{BASE}/token",
            data={"grant_type": "authorization_code", "code": code, "redirect_uri": REDIRECT_URI},
            auth=(CLIENT_ID, SECRET),
            timeout=15,
        )
        if response.status_code != 200:
            return None
        claims = _claims_of(response.json().get("id_token", ""))
    except Exception:
        return None

    name = claims.get("name") or claims.get("given_name") or claims.get("email") or claims.get("sub")
    if not name:
        return None
    return {"name": str(name)[:64], "role": ROLE, "email": claims.get("email", "")}
