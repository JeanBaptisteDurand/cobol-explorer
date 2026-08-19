"""Assemble nodes/edges into a NetworkX MultiDiGraph and (de)serialise it.

v1 keeps the whole graph in memory (corpus is curated). ``to_json`` /
``from_json`` persist it as ``graph.json`` — the single artifact the API and
frontend load. Neo4j is the documented scale path (fast-follow).
"""
from __future__ import annotations

from collections.abc import Iterable

import networkx as nx

from core.schema import Edge, Node, PREFIX_TO_KIND, split_id


def _merge_evidence(existing: dict | None, new: dict | None) -> dict:
    """Fold a repeated occurrence of the SAME relationship (same src/dst/kind, e.g.
    a program that PERFORMs a paragraph or reads a table from several sites) into
    one edge — WITHOUT losing any citation. ``evidence.line`` stays the first line
    (backward compatible), and ``evidence.lines`` accumulates every occurrence, so
    no per-line evidence is dropped (the old key=kind add silently kept only the
    last)."""
    ev = dict(existing or {})
    new = new or {}
    lines = list(ev.get("lines") or ([ev["line"]] if ev.get("line") is not None else []))
    nl = new.get("line")
    if nl is not None and nl not in lines:
        lines.append(nl)
    if lines:
        ev["lines"] = sorted(lines)
        ev.setdefault("line", ev["lines"][0])
    for k in ("via", "literal"):  # keep the first-seen qualifier, fill if absent
        if k not in ev and new.get(k) is not None:
            ev[k] = new[k]
    return ev


def build_graph(nodes: Iterable[Node], edges: Iterable[Edge]) -> nx.MultiDiGraph:
    g = nx.MultiDiGraph()
    for n in nodes:
        if n.id in g:
            # Merge attrs so a richer node (e.g. COBOL PGM with 'file') is not
            # clobbered by a minimal one (e.g. a JCL EXEC PGM= reference).
            attrs = dict(g.nodes[n.id].get("attrs") or {})
            for k, v in (n.attrs or {}).items():
                attrs.setdefault(k, v)
            g.nodes[n.id]["attrs"] = attrs
        else:
            g.add_node(n.id, kind=n.kind, label=n.label, attrs=dict(n.attrs or {}))
    for e in edges:
        # A referenced endpoint may be outside the corpus (e.g. a CICS system
        # program like DFHMIRS). Synthesize it with a kind inferred from its
        # prefix and mark it external, so the graph has no untyped nodes.
        for endpoint in (e.src, e.dst):
            if endpoint not in g:
                prefix, name = split_id(endpoint)
                g.add_node(endpoint, kind=PREFIX_TO_KIND.get(prefix, prefix.upper()), label=name, attrs={"external": True})
        # One edge per (src, dst, kind); repeated occurrences merge their evidence.
        if g.has_edge(e.src, e.dst, key=e.kind):
            d = g[e.src][e.dst][e.kind]
            d["evidence"] = _merge_evidence(d.get("evidence"), e.evidence)
        else:
            g.add_edge(e.src, e.dst, key=e.kind, kind=e.kind, evidence=_merge_evidence(None, e.evidence))
    return g


def to_json(g: nx.MultiDiGraph) -> dict:
    return {
        "nodes": [
            {"id": n, "kind": d.get("kind"), "label": d.get("label"), "attrs": d.get("attrs", {})}
            for n, d in g.nodes(data=True)
        ],
        "edges": [
            {"src": u, "dst": v, "kind": k, "evidence": d.get("evidence", {})}
            for u, v, k, d in g.edges(keys=True, data=True)
        ],
        "stats": {"nodes": g.number_of_nodes(), "edges": g.number_of_edges()},
    }


def from_json(data: dict) -> nx.MultiDiGraph:
    g = nx.MultiDiGraph()
    for n in data["nodes"]:
        g.add_node(n["id"], kind=n["kind"], label=n["label"], attrs=n.get("attrs", {}))
    for e in data["edges"]:
        g.add_edge(e["src"], e["dst"], key=e["kind"], kind=e["kind"], evidence=e.get("evidence", {}))
    return g
