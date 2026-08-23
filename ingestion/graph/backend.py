"""Graph-query backend abstraction - lets ``graph_lookup`` run on NetworkX
(in-process, default) or on Neo4j (self-hosted graph DB, the scale path) behind
one interface. Both return identical shapes so the agent is unaffected.
"""
from __future__ import annotations

from core.schema import EdgeKind
from graph import queries


class NetworkxBackend:
    """In-process backend over the NetworkX graph (graph.json). Deterministic."""

    def __init__(self, g):
        self.g = g

    def impact(self, nid: str) -> dict:
        return queries.impact(self.g, nid)

    def lineage(self, nid: str) -> dict:
        return queries.lineage(self.g, nid)

    def callers(self, nid: str) -> list[str]:
        return queries.callers(self.g, nid)

    def callees(self, nid: str) -> list[str]:
        return queries.callees(self.g, nid)

    def neighbors(self, nid: str) -> dict:
        return queries.neighbors(self.g, nid)

    def summary(self, nid: str) -> dict:
        return queries.summary(self.g, nid)

    def copy_evidence(self, copy_id: str, pgm_id: str) -> dict:
        line = None
        for _u, v, _k, d in self.g.out_edges(pgm_id, keys=True, data=True):
            if v == copy_id and d.get("kind") == EdgeKind.PGM_COPIES:
                line = d.get("evidence", {}).get("line")
                break
        attrs = self.g.nodes[pgm_id].get("attrs", {}) if pgm_id in self.g else {}
        return {
            "id": pgm_id,
            "label": self.g.nodes[pgm_id].get("label") if pgm_id in self.g else pgm_id,
            "copy_line": line,
            "file": attrs.get("file"),
        }
