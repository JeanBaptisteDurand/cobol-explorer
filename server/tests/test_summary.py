"""The written record a version carries after it is merged.

The point of this feature is retrieval six months later: the title and the diff do not
say that eleven programs were downstream. These tests pin the two guarantees that make
the record trustworthy — it always exists, and it never invents an impact figure.
"""
import importlib
import re

import pytest
from fastapi.testclient import TestClient

from agent.tools import GraphTools
from run_ingest import ingest
from versioning import summarize
from versioning.changeset import VersionStore

COPYBOOK = "genapp-src/base/src/lgpolicy.cpy"


@pytest.fixture()
def store(tmp_path):
    graph = tmp_path / "g.json"
    ingest("corpora", str(graph))
    s = VersionStore(root=str(tmp_path / "versions"), corpus_root="corpora")
    return s, GraphTools(str(graph), "corpora")


def _edited(store_and_tools, note=""):
    s, gt = store_and_tools
    cs = s.create("Raise motor cover limit", "JB")
    s.add_edit(cs.id, COPYBOOK, s.read_effective(cs.id, COPYBOOK) + "\n      *> widened\n", note)
    s.compute_impact(cs.id, gt)
    return s, cs.id


def test_the_deterministic_record_states_the_facts(store):
    s, cid = _edited(store, note="regulatory change")
    text = summarize.deterministic(s.get(cid), {COPYBOOK: s.diff(cid, COPYBOOK)})
    assert "lgpolicy.cpy" in text
    assert re.search(r"\+\d+ / −0 lines", text), text
    assert "11 program(s)" in text
    assert "regulatory change" in text


def test_a_version_with_no_edit_says_so_rather_than_inventing(store):
    s, _ = store
    cs = s.create("Empty", "JB")
    assert summarize.deterministic(cs, {}) == "No file was edited in this version."


def test_summarize_falls_back_to_the_facts_when_no_model_answers(store, monkeypatch):
    """A model timeout must degrade the wording, never the record."""
    s, cid = _edited(store)
    monkeypatch.setenv("COBOL_EXPLORER_MODEL", "ollama:does-not-exist")
    out = summarize.summarize(s.get(cid), {COPYBOOK: s.diff(cid, COPYBOOK)})
    assert out["grounded"] is False
    assert "11 program(s)" in out["text"]


def test_the_prompt_only_offers_impact_names_the_graph_computed(store):
    """The model is handed the impact list so it can quote it, not guess it."""
    s, cid = _edited(store)
    cs = s.get(cid)
    prompt = summarize._prompt(cs, {COPYBOOK: s.diff(cid, COPYBOOK)}, summarize._facts(cs, {COPYBOOK: s.diff(cid, COPYBOOK)}))
    assert "LGACDB01" in prompt
    assert "never invent one" in prompt


# --- through the API ----------------------------------------------------------
@pytest.fixture()
def client(tmp_path, monkeypatch):
    graph = tmp_path / "graph.json"
    ingest("corpora", str(graph))
    monkeypatch.setenv("COBOL_EXPLORER_GRAPH", str(graph))
    monkeypatch.setenv("COBOL_EXPLORER_CORPUS", "corpora")
    monkeypatch.setenv("COBOL_EXPLORER_VERSIONS", str(tmp_path / "versions"))
    monkeypatch.setenv("COBOL_EXPLORER_VCS", "json")  # no git needed for this contract
    import api.app as appmod

    importlib.reload(appmod)
    return TestClient(appmod.app, raise_server_exceptions=False)


def _version_with_an_edit(client) -> str:
    cid = client.post("/api/changesets", json={"title": "Raise motor cover limit", "author": "JB"}).json()["id"]
    content = client.get(f"/api/changesets/{cid}/file", params={"path": COPYBOOK}).json()["content"]
    client.post(f"/api/changesets/{cid}/edit", json={"path": COPYBOOK, "content": content + "\n      *> widened\n", "note": "cap raised"})
    client.post(f"/api/changesets/{cid}/impact")
    return cid


def test_merging_writes_the_record_automatically(client):
    cid = _version_with_an_edit(client)
    merged = client.post(f"/api/changesets/{cid}/status", json={"status": "merged"}).json()
    assert merged["status"] == "merged"
    summary = merged["summary"]
    assert summary["text"] and summary["at"]
    assert "lgpolicy.cpy" in summary["text"]


def test_the_record_can_be_written_before_merging(client):
    cid = _version_with_an_edit(client)
    body = client.post(f"/api/changesets/{cid}/summary").json()
    assert "11 program(s)" in body["summary"]["text"] or body["summary"]["grounded"] is True
    # It survives a re-read: this is a record, not a computed view.
    assert client.get(f"/api/changesets/{cid}").json()["summary"]["text"] == body["summary"]["text"]


def test_a_summary_written_by_hand_is_not_overwritten_by_the_merge(client):
    cid = _version_with_an_edit(client)
    first = client.post(f"/api/changesets/{cid}/summary").json()["summary"]["text"]
    merged = client.post(f"/api/changesets/{cid}/status", json={"status": "merged"}).json()
    assert merged["summary"]["text"] == first
