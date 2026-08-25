"""Real authentication: signed tokens, password hashing, and the jwt gate.

Covers the three things a demo login must actually guarantee - a forged or expired
token is refused, credentials are checked against a hash and never a plaintext, and
the role carried by the token (not by a client header) is what RBAC enforces.
"""
import importlib
import json
import os

import pytest
from fastapi.testclient import TestClient

from run_ingest import ingest
from security import mailer, oidc, rbac, tokens, users


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
    # Context-managed so the lifespan runs: the remote MCP transport starts its
    # task group there, and without it every /mcp call is a 500.
    with TestClient(appmod.app, raise_server_exceptions=False) as c:
        yield c
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
    """The demo headers are ignored once a token is required - no self-promotion."""
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
    assert actor["name"] == "Nadia" and actor["role"] == "risk" and actor["verified"] is True
    assert users.authenticate("nadia", "correct-horse") == {"name": "Nadia", "role": "risk"}
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
        ({"username": "no", "password": "correct-horse"}, "username too short"),
        ({"username": "na dia", "password": "correct-horse"}, "space in username"),
        ({"username": "nadia", "password": "short"}, "password too short"),
        ({"username": "nadia", "password": "correct-horse", "role": "root"}, "unknown role"),
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
    # 'risk' may propose but never merge - the role travels in the token.
    assert tokens.read(token)["role"] == "risk"


def test_signup_endpoint_reports_why_it_refused(client, tmp_path, monkeypatch):
    monkeypatch.setattr(users, "STORE", str(tmp_path / "users.json"))
    r = client.post("/api/signup", json={"username": "nadia", "password": "short"})
    assert r.status_code == 400 and "password too short" in r.json()["detail"]


# --- e-mail verification ------------------------------------------------------
def test_unverified_account_cannot_sign_in_but_verification_opens_it(store):
    created = users.create_account("nadia", "correct-horse", email="nadia@example.com", verified=False)
    assert created["verified"] is False and created["token"]

    with pytest.raises(users.UnverifiedAccount):
        users.authenticate("nadia", "correct-horse")

    actor = users.verify(created["token"])
    assert actor == {"name": "nadia", "role": "dev"}
    assert users.authenticate("nadia", "correct-horse") == actor


def test_a_verification_link_works_exactly_once(store):
    created = users.create_account("nadia", "correct-horse", email="nadia@example.com", verified=False)
    assert users.verify(created["token"]) is not None
    assert users.verify(created["token"]) is None


def test_an_expired_link_is_refused(store, monkeypatch):
    monkeypatch.setattr(users, "VERIFY_TTL", -1)
    created = users.create_account("nadia", "correct-horse", email="nadia@example.com", verified=False)
    assert users.verify(created["token"]) is None
    with pytest.raises(users.UnverifiedAccount):
        users.authenticate("nadia", "correct-horse")


def test_a_wrong_token_never_verifies_anyone(store):
    users.create_account("nadia", "correct-horse", email="nadia@example.com", verified=False)
    assert users.verify("not-the-token") is None
    assert users.verify("") is None


@pytest.mark.parametrize("bad", ["", "nadia", "nadia@", "@example.com", "nadia example.com"])
def test_signup_requiring_verification_needs_a_real_address(store, bad):
    with pytest.raises(users.SignupError):
        users.create_account("nadia", "correct-horse", email=bad, verified=False)


def test_an_address_cannot_be_registered_twice(store):
    users.create_account("nadia", "correct-horse", email="nadia@example.com", verified=False)
    with pytest.raises(users.SignupError):
        users.create_account("other", "correct-horse", email="NADIA@example.com", verified=False)


def test_signup_endpoint_says_when_verification_is_disabled(client, tmp_path, monkeypatch):
    """No relay configured: the UI must not claim an e-mail was sent."""
    monkeypatch.setattr(users, "STORE", str(tmp_path / "users.json"))
    monkeypatch.setattr(mailer, "HOST", "")
    r = client.post("/api/signup", json={"username": "nadia", "password": "correct-horse"})
    assert r.status_code == 200
    assert r.json()["verification_required"] is False and r.json()["token"]


def test_signup_endpoint_sends_the_link_and_withholds_the_token(client, tmp_path, monkeypatch):
    sent: dict = {}
    monkeypatch.setattr(users, "STORE", str(tmp_path / "users.json"))
    monkeypatch.setattr(mailer, "HOST", "smtp.example.com")
    monkeypatch.setattr(mailer, "send_verification",
                        lambda to, display, token: sent.update(to=to, token=token) or True)

    r = client.post("/api/signup", json={
        "username": "nadia", "password": "correct-horse", "email": "nadia@example.com"})
    assert r.status_code == 200
    body = r.json()
    assert body["verification_required"] is True
    assert "token" not in body, "an unverified signup must not hand out a session"
    assert sent["to"] == "nadia@example.com"

    # Signing in before clicking the link is refused with a reason the UI can show.
    assert client.post("/api/login", json={"username": "nadia", "password": "correct-horse"}).status_code == 403

    # The link activates the account and redirects back to the front door.
    r = client.get("/api/verify", params={"token": sent["token"]}, follow_redirects=False)
    assert r.status_code == 303 and r.headers["location"] == "/?verified=1"
    assert client.post("/api/login", json={"username": "nadia", "password": "correct-horse"}).status_code == 200


def test_an_invalid_link_redirects_without_activating_anything(client, tmp_path, monkeypatch):
    monkeypatch.setattr(users, "STORE", str(tmp_path / "users.json"))
    r = client.get("/api/verify", params={"token": "garbage"}, follow_redirects=False)
    assert r.status_code == 303 and r.headers["location"] == "/?verified=expired"


# --- "Sign in with IBM" (OIDC / App ID) ---------------------------------------
@pytest.fixture()
def ibm(monkeypatch):
    """A configured tenant, without ever calling IBM."""
    monkeypatch.setattr(oidc, "TENANT", "tenant-guid")
    monkeypatch.setattr(oidc, "CLIENT_ID", "client-id")
    monkeypatch.setattr(oidc, "SECRET", "client-secret")
    monkeypatch.setattr(oidc, "BASE", "https://us-south.appid.cloud.ibm.com/oauth/v4/tenant-guid")
    monkeypatch.setattr(oidc, "REDIRECT_URI", "https://example.test/api/auth/ibm/callback")
    return oidc


def test_ibm_sign_in_is_offered_only_when_configured(monkeypatch):
    monkeypatch.setattr(oidc, "TENANT", "")
    assert oidc.ready() is False


def test_authorization_url_carries_client_redirect_and_state(ibm):
    url = ibm.authorization_url("the-state")
    assert url.startswith(f"{ibm.BASE}/authorization?")
    for fragment in ["client_id=client-id", "response_type=code", "scope=openid", "state=the-state"]:
        assert fragment in url
    assert "redirect_uri=https%3A%2F%2Fexample.test%2Fapi%2Fauth%2Fibm%2Fcallback" in url


def test_state_round_trips_and_rejects_tampering(ibm):
    state = ibm.new_state()
    assert ibm.valid_state(state) is True
    nonce, issued, signature = state.rsplit(".", 2)
    assert ibm.valid_state(f"{nonce}.{issued}.{'0' * len(signature)}") is False
    assert ibm.valid_state("garbage") is False
    assert ibm.valid_state("") is False


def test_an_expired_state_is_refused(ibm, monkeypatch):
    state = ibm.new_state()
    monkeypatch.setattr(oidc, "STATE_TTL", -1)
    assert ibm.valid_state(state) is False


def test_callback_without_a_valid_state_never_mints_a_token(client, ibm):
    """The CSRF guard: a code alone must not be enough to obtain a session."""
    r = client.get("/api/auth/ibm/callback", params={"code": "abc", "state": "forged"}, follow_redirects=False)
    assert r.status_code == 303 and r.headers["location"] == "/?ibm=failed"


def test_callback_reports_a_refused_consent(client, ibm):
    r = client.get("/api/auth/ibm/callback", params={"error": "access_denied"}, follow_redirects=False)
    assert r.status_code == 303 and r.headers["location"] == "/?ibm=failed"


def test_a_successful_exchange_mints_our_own_token(client, ibm, monkeypatch):
    monkeypatch.setattr(oidc, "exchange", lambda code: {"name": "Jean-Baptiste", "role": "risk", "email": "jb@example.com"})
    r = client.get("/api/auth/ibm/callback",
                   params={"code": "abc", "state": oidc.new_state()}, follow_redirects=False)
    assert r.status_code == 303
    location = r.headers["location"]
    assert location.startswith("/#"), "the token must ride in the fragment, never in the query"

    from urllib.parse import parse_qs
    handed = parse_qs(location[2:])
    claims = tokens.read(handed["token"][0])
    assert claims["sub"] == "Jean-Baptiste" and claims["role"] == "risk"


def test_ibm_sign_in_grants_a_least_privileged_role(ibm):
    """Federating an identity says who you are, not what you may do here."""
    assert oidc.ROLE == "risk"
    assert not rbac.allowed(oidc.ROLE, "merge")
    assert rbac.allowed(oidc.ROLE, "propose")


# --- one-click role switching (demo accounts in the auth config) ---------------
def test_config_lists_verified_demo_accounts_in_jwt_mode(client):
    """The switcher in the profile dialog is fed by the server, not hardcoded in
    the UI - and only accounts that REALLY open with the demo password appear."""
    cfg = client.get("/api/auth/config").json()
    got = {d["user"]: d["role"] for d in cfg["demo_accounts"]}
    assert got == {"amine": "dev", "claire": "architect", "sofia": "risk", "marc": "auditor"}
    # Every advertised account must actually authenticate: the UI logs in with it.
    for d in cfg["demo_accounts"]:
        assert client.post("/api/login", json={"username": d["user"], "password": "demo"}).status_code == 200


def test_config_hides_demo_accounts_in_open_mode():
    import api.app as appmod
    cfg = TestClient(appmod.app).get("/api/auth/config").json()
    assert cfg["demo_accounts"] == []


# --- per-account MCP keys and the remote /mcp endpoint --------------------------
def test_mcp_key_minting_requires_real_credentials(client):
    r = client.post("/api/mcp-key", json={"username": "amine", "password": "wrong"})
    assert r.status_code == 401
    r = client.post("/api/mcp-key", json={"username": "amine", "password": users.DEMO_PASSWORD})
    assert r.status_code == 200
    key = r.json()["key"]
    assert key.startswith("ce_") and len(key) > 30
    # Only the hash is stored - the plaintext appears nowhere in the account store.
    acct = users.accounts()["amine"]
    assert acct["mcp_key_hash"] != key and key not in json.dumps(users.accounts())
    # The key resolves to the account, with its role.
    actor = users.actor_for_mcp_key(key)
    assert actor["role"] == "dev" and actor["username"] == "amine"
    # Re-minting replaces the previous key.
    key2 = client.post("/api/mcp-key", json={"username": "amine", "password": users.DEMO_PASSWORD}).json()["key"]
    assert users.actor_for_mcp_key(key) is None and users.actor_for_mcp_key(key2) is not None


def test_remote_mcp_requires_a_key_in_jwt_mode(client):
    r = client.post("/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"})
    assert r.status_code == 401
    assert "MCP key" in r.json()["error"]


def test_remote_mcp_lists_and_calls_tools_with_a_key(client):
    key = client.post("/api/mcp-key", json={"username": "sofia", "password": users.DEMO_PASSWORD}).json()["key"]
    h = {"Authorization": f"Bearer {key}", "Accept": "application/json, text/event-stream",
         "Content-Type": "application/json"}

    def rpc(payload):
        r = client.post("/mcp", json=payload, headers=h)
        assert r.status_code == 200, r.text
        body = r.text
        if body.startswith("event:") or "\ndata: " in body or body.startswith("data:"):
            data = [ln[6:] for ln in body.splitlines() if ln.startswith("data: ")][-1]
            return json.loads(data)
        return json.loads(body)

    init = rpc({"jsonrpc": "2.0", "id": 1, "method": "initialize",
                "params": {"protocolVersion": "2025-03-26", "capabilities": {},
                           "clientInfo": {"name": "t", "version": "1"}}})
    assert init["result"]["serverInfo"]["name"] == "cobol-explorer"

    tools_ = rpc({"jsonrpc": "2.0", "id": 2, "method": "tools/list"})
    names = {t["name"] for t in tools_["result"]["tools"]}
    assert names == {"graph_lookup", "read_source_lines", "search_code"}

    call = rpc({"jsonrpc": "2.0", "id": 3, "method": "tools/call",
                "params": {"name": "graph_lookup", "arguments": {"op": "impact", "node": "LGPOLICY"}}})
    payload = json.loads(call["result"]["content"][0]["text"])
    assert len(payload["programs"]) == 11 and len(payload["chains"]) == 2

    # Attribution: the call is in the audit chain under Sofia's name.
    mtoken = client.post("/api/login", json={"username": "marc", "password": users.DEMO_PASSWORD}).json()["token"]
    entries = client.get("/api/audit", headers={"Authorization": f"Bearer {mtoken}"}).json()["entries"]
    mine = [e for e in entries if e["action"] == "mcp:graph_lookup"]
    assert mine and mine[-1]["actor"] == "Sofia" and mine[-1]["role"] == "risk"


def test_mcp_key_minted_from_the_session_lands_on_the_account(client):
    # Sign in as amine, mint with the TOKEN only: the key belongs to amine.
    t = _token(client, "amine")
    r = client.post("/api/mcp-key", json={}, headers={"Authorization": f"Bearer {t}"})
    assert r.status_code == 200 and r.json()["account"] == "Amine"
    assert users.actor_for_mcp_key(r.json()["key"])["username"] == "amine"


def test_mcp_key_for_a_federated_session_is_durable(client):
    # An IBM sign-in has no local account row: the first mint creates a durable
    # slot, and the same person re-minting lands on the SAME slot.
    from security import tokens
    t = tokens.mint("Jean-Baptiste Durand", "risk")  # no username claim, like oidc.py
    k1 = client.post("/api/mcp-key", json={}, headers={"Authorization": f"Bearer {t}"}).json()["key"]
    a1 = users.actor_for_mcp_key(k1)
    assert a1["username"].startswith("fed:") and a1["role"] == "risk"
    k2 = client.post("/api/mcp-key", json={}, headers={"Authorization": f"Bearer {t}"}).json()["key"]
    assert users.actor_for_mcp_key(k1) is None          # replaced, same slot
    assert users.actor_for_mcp_key(k2)["username"] == a1["username"]
    # The federated row cannot be used to sign in: it has no password.
    assert client.post("/api/login", json={"username": a1["username"], "password": ""}).status_code == 401
