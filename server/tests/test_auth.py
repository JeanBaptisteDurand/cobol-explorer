"""Real authentication: signed tokens, password hashing, and the jwt gate.

Covers the three things a demo login must actually guarantee — a forged or expired
token is refused, credentials are checked against a hash and never a plaintext, and
the role carried by the token (not by a client header) is what RBAC enforces.
"""
import importlib
import os

import pytest
from fastapi.testclient import TestClient

from run_ingest import ingest
from security import tokens, users


# --- tokens -------------------------------------------------------------------
def test_token_roundtrip_carries_name_and_role():
    claims = tokens.read(tokens.mint("Amine", "dev"))
    assert claims["sub"] == "Amine" and claims["role"] == "dev"


def test_token_rejected_when_signature_tampered():
    head, payload, sig = tokens.mint("Amine", "dev").split(".")
    forged = tokens.mint("Amine", "auditor").split(".")[1]  # swap in another role
    assert tokens.read(f"{head}.{forged}.{sig}") is None


def test_token_rejected_when_expired():
    assert tokens.read(tokens.mint("Amine", "dev", ttl=-1)) is None


@pytest.mark.parametrize("bad", [None, "", "garbage", "a.b", "a.b.c"])
def test_malformed_tokens_never_authenticate(bad):
    assert tokens.read(bad) is None


def test_bearer_extraction():
    assert tokens.bearer({"authorization": "Bearer xyz"}) == "xyz"
    assert tokens.bearer({"authorization": "Basic xyz"}) is None
    assert tokens.bearer({}) is None


# --- passwords ----------------------------------------------------------------
def test_password_is_hashed_not_stored():
    stored = users.hash_password("s3cret")
    assert "s3cret" not in stored and stored.startswith("pbkdf2_sha256$")
    assert users.verify_password("s3cret", stored)
    assert not users.verify_password("wrong", stored)


def test_authenticate_maps_account_to_rbac_role():
    actor = users.authenticate("amine", users.DEMO_PASSWORD)
    assert actor == {"name": "Amine", "role": "dev"}
    assert users.authenticate("amine", "wrong") is None
    assert users.authenticate("ghost", users.DEMO_PASSWORD) is None


# --- the gate -----------------------------------------------------------------
@pytest.fixture()
def client(tmp_path, monkeypatch):
    graph = tmp_path / "graph.json"
    ingest("corpora", str(graph))
    monkeypatch.setenv("COBOL_EXPLORER_GRAPH", str(graph))
    monkeypatch.setenv("COBOL_EXPLORER_CORPUS", "corpora")
    monkeypatch.setenv("COBOL_EXPLORER_VERSIONS", str(tmp_path / "versions"))
    monkeypatch.setenv("COBOL_EXPLORER_AUDIT", str(tmp_path / "audit.jsonl"))
    monkeypatch.setenv("COBOL_EXPLORER_AUTH", "jwt")
    import api.app as appmod

    importlib.reload(appmod)
    yield TestClient(appmod.app, raise_server_exceptions=False)
    monkeypatch.delenv("COBOL_EXPLORER_AUTH")
    importlib.reload(appmod)  # leave the module in open mode for the other suites


def _token(client, user="amine") -> str:
    r = client.post("/api/login", json={"username": user, "password": users.DEMO_PASSWORD})
    assert r.status_code == 200
    return r.json()["token"]


def test_login_rejects_bad_credentials(client):
    assert client.post("/api/login", json={"username": "amine", "password": "nope"}).status_code == 401


def test_protected_endpoint_needs_a_token(client):
    assert client.get("/api/graph").status_code == 401
    assert client.get("/api/graph", headers={"Authorization": f"Bearer {_token(client)}"}).status_code == 200


def test_identity_headers_cannot_forge_a_role_in_jwt_mode(client):
    """The demo headers are ignored once a token is required — no self-promotion."""
    r = client.get("/api/graph", headers={"X-Cobol-User": "mallory", "X-Cobol-Role": "dev"})
    assert r.status_code == 401


def test_rbac_uses_the_role_from_the_token(client):
    auditor = f"Bearer {_token(client, 'marc')}"  # auditor: reads, never proposes
    assert client.get("/api/graph", headers={"Authorization": auditor}).status_code == 200
    r = client.post("/api/changesets", json={"title": "x", "author": "Marc"}, headers={"Authorization": auditor})
    assert r.status_code == 403

    dev = f"Bearer {_token(client, 'amine')}"
    assert client.post("/api/changesets", json={"title": "x", "author": "Amine"}, headers={"Authorization": dev}).status_code == 200


def test_expired_token_is_refused(client):
    stale = tokens.mint("Amine", "dev", ttl=-1)
    assert client.get("/api/graph", headers={"Authorization": f"Bearer {stale}"}).status_code == 401


def test_me_reports_the_authenticated_caller(client):
    r = client.get("/api/me", headers={"Authorization": f"Bearer {_token(client)}"})
    assert r.json() == {"name": "Amine", "role": "dev", "authenticated": True}


def test_auth_config_is_reachable_without_a_token(client):
    assert client.get("/api/auth/config").json()["required"] is True


def test_login_attempts_are_audited(client, tmp_path):
    client.post("/api/login", json={"username": "amine", "password": "nope"})
    _token(client)
    lines = (tmp_path / "audit.jsonl").read_text().splitlines()
    logins = [x for x in lines if '"action": "login"' in x]
    assert any('"result": "denied"' in x for x in logins)
    assert any('"result": "granted"' in x for x in logins)


def test_open_mode_still_needs_no_token(tmp_path, monkeypatch):
    """The demo must keep working out of the box: default mode stays open."""
    graph = tmp_path / "graph.json"
    ingest("corpora", str(graph))
    monkeypatch.setenv("COBOL_EXPLORER_GRAPH", str(graph))
    monkeypatch.setenv("COBOL_EXPLORER_VERSIONS", str(tmp_path / "versions"))
    monkeypatch.delenv("COBOL_EXPLORER_AUTH", raising=False)
    import api.app as appmod

    importlib.reload(appmod)
    c = TestClient(appmod.app, raise_server_exceptions=False)
    assert c.get("/api/graph").status_code == 200
    assert c.get("/api/auth/config").json()["required"] is False


# --- signup -------------------------------------------------------------------
@pytest.fixture()
def store(tmp_path, monkeypatch):
    """An isolated account store, so a test signup never touches the real one."""
    monkeypatch.setattr(users, "STORE", str(tmp_path / "users.json"))
    return str(tmp_path / "users.json")


def test_signup_creates_a_usable_account(store):
    actor = users.create_account("nadia", "correct-horse", display="Nadia", role="risk")
    assert actor == {"name": "Nadia", "role": "risk"}
    assert users.authenticate("nadia", "correct-horse") == actor
    assert os.path.exists(store)


def test_signup_keeps_the_demo_accounts_working(store):
    users.create_account("nadia", "correct-horse")
    assert users.authenticate("amine", users.DEMO_PASSWORD) is not None


def test_signup_never_stores_the_password(store):
    users.create_account("nadia", "correct-horse")
    assert "correct-horse" not in open(store).read()


@pytest.mark.parametrize(
    "kwargs, reason",
    [
        ({"username": "no", "password": "correct-horse"}, "trop court"),
        ({"username": "na dia", "password": "correct-horse"}, "espace"),
        ({"username": "nadia", "password": "short"}, "mot de passe"),
        ({"username": "nadia", "password": "correct-horse", "role": "root"}, "rôle inconnu"),
    ],
)
def test_signup_refuses_bad_input(store, kwargs, reason):
    with pytest.raises(users.SignupError):
        users.create_account(**kwargs)


def test_signup_refuses_a_taken_username(store):
    users.create_account("nadia", "correct-horse")
    with pytest.raises(users.SignupError):
        users.create_account("NADIA", "another-password")


def test_signup_endpoint_signs_the_new_user_in(client, tmp_path, monkeypatch):
    monkeypatch.setattr(users, "STORE", str(tmp_path / "users.json"))
    r = client.post("/api/signup", json={"username": "nadia", "password": "correct-horse", "display": "Nadia", "role": "risk"})
    assert r.status_code == 200
    token = r.json()["token"]
    assert client.get("/api/graph", headers={"Authorization": f"Bearer {token}"}).status_code == 200
    # 'risk' may propose but never merge — the role travels in the token.
    assert tokens.read(token)["role"] == "risk"


def test_signup_endpoint_reports_why_it_refused(client, tmp_path, monkeypatch):
    monkeypatch.setattr(users, "STORE", str(tmp_path / "users.json"))
    r = client.post("/api/signup", json={"username": "nadia", "password": "short"})
    assert r.status_code == 400 and "mot de passe" in r.json()["detail"]
