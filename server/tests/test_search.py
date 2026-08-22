"""Semantic search: cosine ranking + graceful no-index path.

Uses an injected embed_fn so unit tests don't require Ollama; the live Granite
path is exercised by build_index + manual/e2e checks.
"""
import json

from agent.search import VectorIndex, cosine
from agent.tools import GraphTools
from run_ingest import ingest


def test_cosine():
    assert cosine([1, 0], [1, 0]) == 1.0
    assert abs(cosine([1, 0], [0, 1])) < 1e-9


def test_vector_index_ranks(tmp_path):
    idx = tmp_path / "index.json"
    idx.write_text(
        json.dumps(
            {
                "model": "granite-embedding",
                "dim": 2,
                "docs": [
                    {"id": "pgm:A", "kind": "PGM", "label": "A", "file": "a.cbl", "path": "a.cbl", "snippet": "s", "embedding": [1.0, 0.0]},
                    {"id": "pgm:B", "kind": "PGM", "label": "B", "file": "b.cbl", "path": "b.cbl", "snippet": "s", "embedding": [0.0, 1.0]},
                ],
            }
        )
    )
    vi = VectorIndex(str(idx))
    res = vi.search("q", k=2, embed_fn=lambda _q: [0.9, 0.1])
    assert res[0]["label"] == "A"
    assert res[0]["score"] >= res[1]["score"]


def test_search_code_without_index(tmp_path):
    g = tmp_path / "g.json"
    ingest("corpora", str(g))
    gt = GraphTools(str(g), "corpora", str(tmp_path / "missing.json"))
    r = gt.search_code("add a policy")
    assert r["results"] == [] and "index" in r["note"]
