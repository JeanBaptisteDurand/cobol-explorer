"""Load a built index.json (IBM Granite embeddings) into PostgreSQL/pgvector.

Usage: PYTHONPATH=packages/core:ingestion:server python ingestion/index/load_pgvector.py [index.json]
The embeddings already exist in index.json, so no Ollama call is needed to load.
"""
from __future__ import annotations

import json
import sys

from agent.pgvector_index import PgVectorIndex


def main(index_path: str = "index.json", dsn: str | None = None) -> None:
    with open(index_path) as fh:
        data = json.load(fh)
    idx = PgVectorIndex(dsn, dim=int(data.get("dim", 768)))
    n = idx.load(data.get("docs", []))
    print(f"pgvector: {n} docs charges ({data.get('model')}, dim {data.get('dim')})")


if __name__ == "__main__":
    main(*sys.argv[1:])
