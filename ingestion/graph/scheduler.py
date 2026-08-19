"""Load a scheduler chain (fictional for the POC) into SCHED_* graph elements.

Real production would parse an IWS / CA7 / Control-M export; the connector is
the same shape. ``scheduler.json`` references the JCL job names in the corpus.
"""
from __future__ import annotations

import json

from core.schema import Edge, EdgeKind, Node, NodeKind, nid


def load_scheduler(path: str) -> tuple[list[Node], list[Edge]]:
    with open(path) as fh:
        data = json.load(fh)

    nodes: list[Node] = []
    edges: list[Edge] = []
    seen: set[str] = set()

    for job in data.get("jobs", []):
        sid = nid("sched", job["id"])
        if sid not in seen:
            seen.add(sid)
            nodes.append(Node(sid, NodeKind.SCHED_JOB, job["id"], {"chain": data.get("chain"), "synthetic": True}))
        if job.get("runs"):
            edges.append(Edge(sid, nid("job", job["runs"]), EdgeKind.SCHED_RUNS, {}))
        for pred in job.get("after", []):
            edges.append(Edge(nid("sched", pred), sid, EdgeKind.SCHED_TRIGGERS, {"chain": data.get("chain")}))

    return nodes, edges
