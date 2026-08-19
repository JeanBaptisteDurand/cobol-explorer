"""Load graph.json into Neo4j (the self-hosted graph-RAG backend).

Usage: PYTHONPATH=packages/core:ingestion:server python ingestion/graph/load_neo4j.py [graph.json]
"""
from __future__ import annotations

import json
import sys

from agent.neo4j_store import Neo4jGraph


def main(graph_path: str = "graph.json", uri: str | None = None) -> None:
    with open(graph_path) as fh:
        g = json.load(fh)
    n = Neo4jGraph(uri).load(g)
    print(f"neo4j: {n} noeuds charges ({len(g['edges'])} aretes)")


if __name__ == "__main__":
    main(*sys.argv[1:])
