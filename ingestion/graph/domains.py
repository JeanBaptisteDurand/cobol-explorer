"""Group programs/jobs into business DOMAIN nodes from a manual mapping.

Heuristic auto-grouping on mainframe naming is fragile, so the POC uses an
explicit ``domains.yaml``. First matching pattern wins (glob, case-insensitive).
"""
from __future__ import annotations

from fnmatch import fnmatchcase

import yaml

from core.schema import Edge, EdgeKind, Node, NodeKind, nid, split_id


def load_mapping(path: str) -> dict[str, list[str]]:
    with open(path) as fh:
        data = yaml.safe_load(fh) or {}
    return data.get("domains", {})


def apply_domains(nodes, mapping: dict[str, list[str]]) -> tuple[list[Node], list[Edge]]:
    """Create DOMAIN nodes and DOMAIN_GROUPS edges for matching PGM nodes."""
    domain_nodes: dict[str, Node] = {}
    edges: list[Edge] = []

    for n in nodes:
        prefix, name = split_id(n.id)
        if prefix != "pgm":
            continue
        upper = name.upper()
        for domain, patterns in mapping.items():
            if any(fnmatchcase(upper, p.upper()) for p in patterns):
                did = nid("domain", domain)
                if did not in domain_nodes:
                    domain_nodes[did] = Node(did, NodeKind.DOMAIN, domain)
                edges.append(Edge(did, n.id, EdgeKind.DOMAIN_GROUPS, {}))
                break  # first matching domain wins

    return list(domain_nodes.values()), edges
