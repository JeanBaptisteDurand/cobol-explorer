"""Account store: usernames, salted password hashes, and the RBAC role they carry.

Demo-grade by design. Accounts come from ``COBOL_EXPLORER_USERS`` (a JSON file of
``{username: {display, role, password_hash}}``); when that file is absent the four
demo accounts below are served from memory, so ``make demo`` needs no setup. A real
deployment swaps this module for the corporate IdP — the contract the rest of the
app depends on stays ``authenticate(username, password) -> {name, role} | None``.

Hashes are PBKDF2-HMAC-SHA256, ``pbkdf2_sha256$<iterations>$<salt>$<hash>``;
plaintext passwords are never stored, and comparison is constant-time.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets

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
    """Demo accounts, hashed once — PBKDF2 is deliberately slow, so never per request."""
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


def authenticate(username: str, password: str) -> dict | None:
    """The caller's identity if the credentials match, else ``None``."""
    account = accounts().get((username or "").strip().lower())
    if not account or not verify_password(password or "", account.get("password_hash", "")):
        return None
    return {
        "name": account.get("display") or username,
        "role": rbac.canonical(account.get("role", "")),
    }


# Roles a visitor may take when signing up. Deliberately excludes nothing today —
# this is a public demo of a governance workflow, and a signup that cannot reach
# 'merge' would hide half of what the product does. A real deployment maps roles
# from the corporate IdP instead and never lets a caller pick their own.
SIGNUP_ROLES = ("dev", "architect", "risk", "compliance", "auditor")
MIN_PASSWORD = 8


class SignupError(ValueError):
    """Why a signup was refused, in a sentence the UI can show as-is."""


def create_account(username: str, password: str, display: str = "", role: str = "dev") -> dict:
    """Register a new account and persist it. Raises ``SignupError`` if refused.

    The store is created on first signup, seeded with the demo accounts so the
    documented ``amine/demo`` logins keep working once a real user exists.
    """
    user = (username or "").strip().lower()
    if not user.isalnum() or not (3 <= len(user) <= 32):
        raise SignupError("identifiant invalide : 3 à 32 caractères alphanumériques")
    if len(password or "") < MIN_PASSWORD:
        raise SignupError(f"mot de passe trop court : {MIN_PASSWORD} caractères minimum")
    canonical_role = rbac.canonical(role or "dev")
    if canonical_role not in SIGNUP_ROLES:
        raise SignupError(f"rôle inconnu : {role!r}")

    current = dict(accounts())
    if user in current:
        raise SignupError("cet identifiant est déjà pris")

    current[user] = {
        "display": (display or username).strip()[:64],
        "role": canonical_role,
        "password_hash": hash_password(password),
    }
    _write(current)
    return {"name": current[user]["display"], "role": canonical_role}


def _write(all_accounts: dict[str, dict]) -> None:
    """Persist the store atomically — a truncated users.json locks everyone out."""
    directory = os.path.dirname(os.path.abspath(STORE))
    os.makedirs(directory, exist_ok=True)
    tmp = f"{STORE}.tmp.{os.getpid()}"
    with open(tmp, "w") as fh:
        json.dump(all_accounts, fh, ensure_ascii=False, indent=2)
    os.replace(tmp, STORE)
    os.chmod(STORE, 0o600)
