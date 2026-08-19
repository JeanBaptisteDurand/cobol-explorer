"""Neo4j graph-RAG backend must return the SAME answers as the NetworkX backend.
Skips cleanly when no Neo4j is reachable; run `docker compose up -d` to exercise it."""
import json
import os

import pytest

from graph.backend import NetworkxBackend
from graph.build import from_json


@pytest.fixture(scope="module")
def backends():
    if not os.path.exists("graph.json"):
        pytest.skip("graph.json non construit")
    data = json.load(open("graph.json"))
    nx = NetworkxBackend(from_json(data))
    try:
        from agent.neo4j_store import Neo4jGraph

        neo = Neo4jGraph()
        neo.load(data)
    except Exception as e:
        pytest.skip(f"neo4j indisponible: {e}")
    return nx, neo


def test_impact_matches(backends):
    nx, neo = backends
    a, b = nx.impact("copy:LGPOLICY"), neo.impact("copy:LGPOLICY")
    assert sorted(a["programs"]) == sorted(b["programs"])
    assert sorted(a["jobs"]) == sorted(b["jobs"])
    assert sorted(a["chains"]) == sorted(b["chains"])
    assert len(a["programs"]) >= 3


def test_summary_matches(backends):
    nx, neo = backends
    a, b = nx.summary("pgm:LGIPOL01"), neo.summary("pgm:LGIPOL01")
    for k in ("copybooks", "calls", "called_by", "transactions", "tables_read", "tables_written"):
        assert sorted(a[k]) == sorted(b[k]), f"mismatch on {k}"


def test_callers_and_neighbors_match(backends):
    nx, neo = backends
    assert sorted(nx.callers("pgm:LGIPDB01")) == sorted(neo.callers("pgm:LGIPDB01"))
    a, b = nx.neighbors("copy:LGPOLICY"), neo.neighbors("copy:LGPOLICY")
    assert len(a["in"]) == len(b["in"]) and len(a["out"]) == len(b["out"])
