"""pgvector backend (scale path). Skips cleanly when no PostgreSQL is reachable,
so it never breaks CI; run `docker compose up -d` to exercise it for real."""
import json
import os

import pytest

from agent.pgvector_index import PgVectorIndex


@pytest.fixture
def pg():
    idx = PgVectorIndex()
    try:
        idx.ensure_schema()
    except Exception as e:  # no DB in this environment
        pytest.skip(f"pgvector indisponible: {e}")
    return idx


def test_pgvector_self_match(pg):
    if not os.path.exists("index.json"):
        pytest.skip("index.json non construit")
    docs = json.load(open("index.json"))["docs"]
    assert pg.load(docs) == len(docs)
    assert pg.ready()
    # Querying with a document's own embedding must rank that document first, score ~1.0.
    target = docs[0]
    r = pg.search("ignored", k=3, embed_fn=lambda _q: target["embedding"])
    assert r[0]["id"] == target["id"]
    assert abs(r[0]["score"] - 1.0) < 1e-3
