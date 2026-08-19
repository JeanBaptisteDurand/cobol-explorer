"""API tests (non-LLM endpoints) via FastAPI TestClient."""
import importlib
import os
import shutil

import pytest
from fastapi.testclient import TestClient

from run_ingest import ingest


@pytest.fixture()
def client(tmp_path, monkeypatch):
    graph = tmp_path / "graph.json"
    ingest("corpora", str(graph))
    monkeypatch.setenv("COBOL_EXPLORER_GRAPH", str(graph))
    monkeypatch.setenv("COBOL_EXPLORER_CORPUS", "corpora")
    monkeypatch.setenv("COBOL_EXPLORER_VERSIONS", str(tmp_path / "versions"))
    import api.app as appmod

    importlib.reload(appmod)
    return TestClient(appmod.app)


@pytest.fixture()
def iso_client(tmp_path, monkeypatch):
    """Client on an ISOLATED copy of the corpus — safe for tests that merge (which
    rewrite the served corpus). Never point a merging test at the real corpora/."""
    corpus = tmp_path / "corpus"
    shutil.copytree("corpora", corpus, ignore=shutil.ignore_patterns(".git"))
    graph = tmp_path / "graph.json"
    ingest(str(corpus), str(graph))
    monkeypatch.setenv("COBOL_EXPLORER_GRAPH", str(graph))
    monkeypatch.setenv("COBOL_EXPLORER_CORPUS", str(corpus))
    monkeypatch.setenv("COBOL_EXPLORER_VERSIONS", str(tmp_path / "versions"))
    import api.app as appmod

    importlib.reload(appmod)
    return TestClient(appmod.app), str(corpus)


POLICY = "genapp-src/base/src/lgpolicy.cpy"


def test_health_and_graph(client):
    assert client.get("/api/health").json()["ok"] is True
    g = client.get("/api/graph").json()
    assert g["stats"]["nodes"] > 100


def test_impact_endpoint_grounded(client):
    r = client.get("/api/impact", params={"node": "LGPOLICY"}).json()
    assert "LGPOLICY" in r["answer"].upper()
    assert len(r["impact"]["programs"]) >= 3
    assert r["trace"]


def test_source_endpoint(client):
    r = client.get("/api/source", params={"file": "lgipol01.cbl", "start": 55, "end": 55}).json()
    assert "COPY LGPOLICY" in r["text"].upper()


def test_changeset_flow(client):
    cs = client.post("/api/changesets", json={"title": "Hausse valeur auto", "author": "risk"}).json()
    cid = cs["id"]
    # edit the policy copybook
    content = client.get(f"/api/changesets/{cid}/file", params={"path": "genapp-src/base/src/lgpolicy.cpy"}).json()["content"]
    edited = content.replace("VALUE +65", "VALUE +72", 1)
    updated = client.post(f"/api/changesets/{cid}/edit", json={"path": "genapp-src/base/src/lgpolicy.cpy", "content": edited, "note": "auto +65->+72"}).json()
    assert updated["impact"]["programs"]
    diff = client.get(f"/api/changesets/{cid}/diff", params={"path": "genapp-src/base/src/lgpolicy.cpy"}).json()["diff"]
    assert "+72" in diff
    # collaborate
    client.post(f"/api/changesets/{cid}/comment", json={"author": "bob", "text": "ok"})
    client.post(f"/api/changesets/{cid}/status", json={"status": "proposed"})
    final = client.get(f"/api/changesets/{cid}").json()
    assert final["status"] == "proposed"
    assert final["comments"][0]["author"] == "bob"
    assert cid in {c["id"] for c in client.get("/api/changesets").json()}


def test_saving_unchanged_content_is_noop_not_500(client):
    # Saving a file with content identical to main must not crash (git "nothing to
    # commit" exits non-zero) and must not fabricate a phantom edited file.
    cid = client.post("/api/changesets", json={"title": "No-op", "author": "a"}).json()["id"]
    content = client.get(f"/api/changesets/{cid}/file", params={"path": POLICY}).json()["content"]
    r = client.post(f"/api/changesets/{cid}/edit", json={"path": POLICY, "content": content, "note": "same"})
    assert r.status_code == 200
    assert all(e["path"] != POLICY for e in r.json()["edits"])


def test_edit_path_traversal_is_blocked(client):
    # Arbitrary-file-write via a crafted path must be refused (400) and write nothing.
    import os
    cid = client.post("/api/changesets", json={"title": "Trav", "author": "a"}).json()["id"]
    marker = "/tmp/cobol_explorer_pwned_test"
    if os.path.exists(marker):
        os.remove(marker)
    r = client.post(f"/api/changesets/{cid}/edit", json={"path": "../../../../tmp/cobol_explorer_pwned_test", "content": "HACKED", "note": "x"})
    assert r.status_code == 400
    assert not os.path.exists(marker)


def test_status_whitelist_rejects_garbage(client):
    cid = client.post("/api/changesets", json={"title": "Whitelist", "author": "a"}).json()["id"]
    assert client.post(f"/api/changesets/{cid}/status", json={"status": "banane"}).status_code == 400
    assert client.post(f"/api/changesets/{cid}/status", json={"status": "proposed"}).status_code == 200


def test_compose_tolerates_malformed_history():
    # A non-string history 'text' must not raise (loose list[dict] from the API).
    from agent.agent import _compose

    out = _compose("Que fait LGIPOL01 ?", [{"role": "user", "text": 123}, "pas un dict", {"role": "ai"}])
    assert "LGIPOL01" in out  # composed without crashing
    assert _compose("q", None) == "q"  # no history -> passthrough


def test_unknown_changeset_is_404_not_500(client):
    # Operating on a non-existent version must be a clean 404, never a stack trace.
    assert client.post("/api/changesets/does-not-exist/edit",
                       json={"path": POLICY, "content": "x", "note": "n"}).status_code == 404
    assert client.post("/api/changesets/does-not-exist/status", json={"status": "proposed"}).status_code == 404


def test_merged_version_is_readonly(iso_client):
    client, _ = iso_client
    cid = client.post("/api/changesets", json={"title": "V close", "author": "alice"}).json()["id"]
    content = client.get(f"/api/changesets/{cid}/file", params={"path": POLICY}).json()["content"]
    client.post(f"/api/changesets/{cid}/edit", json={"path": POLICY, "content": content.replace("+65", "+72", 1), "note": "e"})
    assert client.post(f"/api/changesets/{cid}/status", json={"status": "merged"}).status_code == 200
    # Once merged, the version is closed: no more edits, syncs, re-proposals or re-merges.
    assert client.post(f"/api/changesets/{cid}/edit", json={"path": POLICY, "content": "y", "note": "e"}).status_code == 409
    assert client.post(f"/api/changesets/{cid}/sync", json={"strategy": None}).status_code == 409
    assert client.post(f"/api/changesets/{cid}/status", json={"status": "proposed"}).status_code == 409
    assert client.post(f"/api/changesets/{cid}/status", json={"status": "merged"}).status_code == 409


def test_merge_propagates_to_read_paths(iso_client):
    """The core #2/#10 fix: after a merge, the change is visible in read-only
    browsing and impact — not only inside the version's own diff."""
    client, _ = iso_client
    cid = client.post("/api/changesets", json={"title": "Propage", "author": "alice"}).json()["id"]
    content = client.get(f"/api/changesets/{cid}/file", params={"path": POLICY}).json()["content"]
    # +65 (WS-MOTOR-LEN) is unique in the file; +327 is a sentinel absent originally.
    client.post(f"/api/changesets/{cid}/edit", json={"path": POLICY, "content": content.replace("+65", "+327", 1), "note": "e"})
    # Before merge: read-only browsing still shows the team (main) value.
    assert "+327" not in client.get("/api/file", params={"path": POLICY}).json()["content"]
    client.post(f"/api/changesets/{cid}/status", json={"status": "merged"})
    # After merge: the served corpus reflects it (file browser, /api/source, search).
    assert "+327" in client.get("/api/file", params={"path": POLICY}).json()["content"]
