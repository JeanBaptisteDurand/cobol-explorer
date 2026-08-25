"""Account store: usernames, salted password hashes, and the RBAC role they carry.

Demo-grade by design. Accounts come from ``COBOL_EXPLORER_USERS`` (a JSON file of
``{username: {display, role, password_hash}}``); when that file is absent the four
demo accounts below are served from memory, so ``make demo`` needs no setup. A real
deployment swaps this module for the corporate IdP - the contract the rest of the
app depends on stays ``authenticate(username, password) -> {name, role} | None``.

Hashes are PBKDF2-HMAC-SHA256, ``pbkdf2_sha256$<iterations>$<salt>$<hash>``;
plaintext passwords are never stored, and comparison is constant-time.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import secrets
import time

from security import rbac

STORE = os.environ.get("COBOL_EXPLORER_USERS", "users.json")
ITERATIONS = 120_000

# One account per gesture of the workshop, so a reviewer can see RBAC bite:
# dev proposes and merges, risk proposes but cannot merge, auditor only reads.
DEMO_PASSWORD = os.environ.get("COBOL_EXPLORER_DEMO_PASSWORD", "demo")
DEMO_ACCOUNTS = {
    "amine": {"display": "Amine", "role": "dev"},
    "claire": {"display": "Claire", "role": "architect"},
    "sofia": {"display": "Sofia", "role": "risk"},
    "marc": {"display": "Marc", "role": "auditor"},
}


def hash_password(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), ITERATIONS).hex()
    return f"pbkdf2_sha256${ITERATIONS}${salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    """Constant-time check of a password against a stored hash."""
    try:
        algo, iterations, salt, digest = stored.split("$")
    except ValueError:
        return False
    if algo != "pbkdf2_sha256":
        return False
    candidate = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), int(iterations)).hex()
    return hmac.compare_digest(candidate, digest)


_demo_cache: dict[str, dict] | None = None


def _demo_accounts() -> dict[str, dict]:
    """Demo accounts, hashed once - PBKDF2 is deliberately slow, so never per request."""
    global _demo_cache
    if _demo_cache is None:
        _demo_cache = {
            user: {**meta, "password_hash": hash_password(DEMO_PASSWORD)}
            for user, meta in DEMO_ACCOUNTS.items()
        }
    return _demo_cache


def accounts() -> dict[str, dict]:
    """All known accounts, from the JSON store or the in-memory demo fallback."""
    if os.path.exists(STORE):
        try:
            with open(STORE) as fh:
                data = json.load(fh)
            if isinstance(data, dict):
                return data
        except (OSError, json.JSONDecodeError):
            pass  # an unreadable store must not lock everyone out of the demo
    return _demo_accounts()


# --- Per-account MCP keys ------------------------------------------------------
# A key lets an MCP client (IBM Bob) call the remote /mcp endpoint AS this
# account: every tool call is written to the audit chain under the account's
# name. Only the SHA-256 of the key is stored - the plaintext is shown once at
# minting and never kept, exactly like a password.

def _hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


def _set_key(account_id: str, allc: dict) -> str:
    key = "ce_" + secrets.token_urlsafe(33)
    allc[account_id]["mcp_key_hash"] = _hash_key(key)
    _write(allc)
    return key


def mint_mcp_key(username: str, password: str) -> str | None:
    """A fresh MCP key against explicit credentials, or None if they are wrong."""
    actor = authenticate(username, password)
    if not actor:
        return None
    return _set_key((username or "").strip().lower(), accounts())


def mint_mcp_key_for_session(claims: dict) -> tuple[str, dict] | None:
    """A fresh MCP key for the SIGNED SESSION's account: (key, actor) or None.

    The key belongs to the account, not to the session: switch to a demo role
    afterwards and it neither moves nor dies. Password accounts are found by the
    token's ``u`` claim; federated sign-ins (IBM OIDC) have no local row, so one
    is created for them - keyed ``fed:<name>``, no password, unable to sign in
    by itself - purely to give the key somewhere durable to live, so the SAME
    federated person gets the SAME key slot on every visit.
    """
    if not claims:
        return None
    allc = accounts()
    account_id = (claims.get("u") or "").strip().lower()
    if not account_id or account_id not in allc:
        sub = (claims.get("sub") or "").strip()
        if not sub or sub == "guest":
            return None
        account_id = "fed:" + re.sub(r"[^a-z0-9]+", "-", sub.lower()).strip("-")
        if account_id not in allc:
            allc[account_id] = {"display": sub, "role": rbac.canonical(claims.get("role", "")),
                                "federated": True, "verified": True}
    account = allc[account_id]
    actor = {"name": account.get("display") or account_id,
             "role": rbac.canonical(account.get("role", "")), "username": account_id}
    return _set_key(account_id, allc), actor


def actor_for_mcp_key(key: str) -> dict | None:
    """The {name, role, username} behind a presented key, or None."""
    if not key or not key.startswith("ce_"):
        return None
    h = _hash_key(key)
    for username, account in accounts().items():
        if account.get("mcp_key_hash") and hmac.compare_digest(account["mcp_key_hash"], h):
            return {"name": account.get("display") or username,
                    "role": rbac.canonical(account.get("role", "")), "username": username}
    return None


class UnverifiedAccount(Exception):
    """Credentials are right, but the address was never confirmed."""


def authenticate(username: str, password: str) -> dict | None:
    """The caller's identity if the credentials match, else ``None``.

    Raises :class:`UnverifiedAccount` when the password is correct but the e-mail was
    never confirmed - so the UI can say "check your inbox" instead of "wrong password".
    """
    account = accounts().get((username or "").strip().lower())
    if not account or not verify_password(password or "", account.get("password_hash", "")):
        return None
    if not account.get("verified", True):
        raise UnverifiedAccount(account.get("email", ""))
    return {
        "name": account.get("display") or username,
        "role": rbac.canonical(account.get("role", "")),
    }


# Roles a visitor may take when signing up. Deliberately excludes nothing today -
# this is a public demo of a governance workflow, and a signup that cannot reach
# 'merge' would hide half of what the product does. A real deployment maps roles
# from the corporate IdP instead and never lets a caller pick their own.
SIGNUP_ROLES = ("dev", "architect", "risk", "compliance", "auditor")
MIN_PASSWORD = 8


class SignupError(ValueError):
    """Why a signup was refused, in a sentence the UI can show as-is."""


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s.]+\.[^@\s]+$")
VERIFY_TTL = 24 * 3600


def create_account(
    username: str, password: str, display: str = "", role: str = "dev",
    email: str = "", verified: bool = True,
) -> dict:
    """Register a new account and persist it. Raises ``SignupError`` if refused.

    The store is created on first signup, seeded with the demo accounts so the
    documented ``amine/demo`` logins keep working once a real user exists.

    ``verified=False`` stores a single-use confirmation token; the account exists but
    cannot sign in until :func:`verify` consumes it.
    """
    user = (username or "").strip().lower()
    if not user.isalnum() or not (3 <= len(user) <= 32):
        raise SignupError("invalid username: 3 to 32 alphanumeric characters")
    if len(password or "") < MIN_PASSWORD:
        raise SignupError(f"password too short: {MIN_PASSWORD} characters minimum")
    canonical_role = rbac.canonical(role or "dev")
    if canonical_role not in SIGNUP_ROLES:
        raise SignupError(f"unknown role: {role!r}")
    email = (email or "").strip().lower()
    if not verified and not EMAIL_RE.match(email):
        raise SignupError("a valid e-mail address is required")

    current = dict(accounts())
    if user in current:
        raise SignupError("that username is already taken")
    if email and any((a.get("email") or "").lower() == email for a in current.values()):
        raise SignupError("that e-mail address is already registered")

    account = {
        "display": (display or username).strip()[:64],
        "role": canonical_role,
        "password_hash": hash_password(password),
        "email": email,
        "verified": bool(verified),
    }
    if not verified:
        account["verify_token"] = secrets.token_urlsafe(32)
        account["verify_expires"] = int(time.time()) + VERIFY_TTL
    current[user] = account
    _write(current)
    return {
        "name": account["display"], "role": canonical_role,
        "verified": account["verified"], "token": account.get("verify_token", ""),
    }


def verify(token: str) -> dict | None:
    """Consume a confirmation token and activate the account, or return ``None``.

    The token is removed on success, so a link works exactly once; an expired token
    is refused without revealing whether it ever existed.
    """
    current = dict(accounts())
    for user, account in current.items():
        if account.get("verify_token") and secrets.compare_digest(account["verify_token"], token or ""):
            if account.get("verify_expires", 0) < time.time():
                return None
            account["verified"] = True
            account.pop("verify_token", None)
            account.pop("verify_expires", None)
            _write(current)
            return {"name": account.get("display") or user, "role": rbac.canonical(account.get("role", ""))}
    return None


def _write(all_accounts: dict[str, dict]) -> None:
    """Persist the store atomically - a truncated users.json locks everyone out."""
    directory = os.path.dirname(os.path.abspath(STORE))
    os.makedirs(directory, exist_ok=True)
    tmp = f"{STORE}.tmp.{os.getpid()}"
    with open(tmp, "w") as fh:
        json.dump(all_accounts, fh, ensure_ascii=False, indent=2)
    os.replace(tmp, STORE)
    os.chmod(STORE, 0o600)
