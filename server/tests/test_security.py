"""B1/B2: path traversal must be blocked on every file-reading endpoint."""
import importlib

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
    return TestClient(appmod.app, raise_server_exceptions=False)


def _leaks(resp) -> bool:
    body = resp.text if resp.status_code == 200 else ""
    return "root:" in body and "/bin/" in body


def test_file_blocks_absolute(client):
    assert client.get("/api/file", params={"path": "/etc/passwd"}).status_code == 404


def test_file_blocks_traversal(client):
    assert client.get("/api/file", params={"path": "../../../../etc/passwd"}).status_code == 404


def test_source_blocks_absolute(client):
    r = client.get("/api/source", params={"file": "/etc/passwd", "start": 1, "end": 5})
    assert not _leaks(r)
    assert r.json().get("error") == "not found"


def test_changeset_file_blocks_absolute(client):
    cs = client.post("/api/changesets", json={"title": "x", "author": "a"}).json()
    r = client.get(f"/api/changesets/{cs['id']}/file", params={"path": "/etc/passwd"})
    assert not _leaks(r)


def test_legit_file_still_works(client):
    r = client.get("/api/file", params={"path": "genapp-src/base/src/lgpolicy.cpy"})
    assert r.status_code == 200 and "POLICY" in r.json()["content"].upper()


def test_audit_detects_tampering_and_truncation(tmp_path, monkeypatch):
    """The tamper-evident guarantee: altered line, corrupt line, AND a chopped tail
    are all detected - and a corrupt line never crashes recent()."""
    from security.audit import AuditLog
    logp = tmp_path / "audit.jsonl"
    monkeypatch.setenv("COBOL_EXPLORER_AUDIT", str(logp))
    a = AuditLog(str(logp))
    for i in range(4):
        a.record("alice", "dev", "ask", f"q{i}")
    assert a.verify_chain() is True

    lines = logp.read_text().splitlines()
    # 1) trailing deletion (truncation) must be caught by the head anchor
    logp.write_text("\n".join(lines[:2]) + "\n")
    assert a.verify_chain() is False
    # 2) a corrupt line: recent() survives, verify_chain() flags it
    logp.write_text("\n".join(lines) + "\nnot-json-garbage\n")
    assert a.recent() and len(a.recent()) == 4  # garbage skipped for display
    assert a.verify_chain() is False
    # 3) an altered field breaks the HMAC
    import json
    rows = [json.loads(x) for x in lines]
    rows[1]["target"] = "TAMPERED"
    logp.write_text("\n".join(json.dumps(r) for r in rows) + "\n")
    assert a.verify_chain() is False
