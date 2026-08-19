"""Phase 1 exit criterion: full-corpus ingestion produces a rich graph and the
hero impact query works on REAL GenApp data."""
import os

from core.schema import nid
from graph.build import from_json
from graph.queries import impact
from run_ingest import ingest


def test_full_ingest_and_hero_impact(tmp_path):
    out = tmp_path / "graph.json"
    data = ingest("corpora", str(out), rekt=False)

    assert out.exists()
    info = data["_ingest"]
    # GenApp has 31 COBOL programs; all should parse via source extraction.
    assert info["cobol_parsed"] >= 25
    assert info["cobol_failed"] == 0

    kinds = info["node_kinds"]
    assert kinds.get("PGM", 0) >= 25
    assert kinds.get("COPYBOOK", 0) >= 3
    assert kinds.get("DOMAIN", 0) >= 3
    assert kinds.get("SCHED_JOB", 0) >= 2
    assert kinds.get("CICS_TXN", 0) >= 5  # gap #1: transactions
    assert kinds.get("BMS_MAP", 0) >= 3  # gap #1: screens
    assert kinds.get("CICS_FILE", 0) >= 2  # gap #2: VSAM files via CICS
    assert all(n["kind"] for n in data["nodes"]), "every node must have a kind (no untyped)"

    ekinds = info["edge_kinds"]
    assert ekinds.get("PGM_COPIES", 0) >= 10
    assert ekinds.get("PGM_CALLS", 0) >= 10  # CICS LINK graph
    assert ekinds.get("SCHED_TRIGGERS", 0) >= 1

    # Hero query on real data: changing LGPOLICY hits several programs + a batch chain.
    g = from_json(data)
    r = impact(g, nid("copy", "LGPOLICY"))
    assert len(r["programs"]) >= 3
    assert r["chains"], "copybook change should reach at least one scheduler chain"
