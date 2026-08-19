"""Regression: parallel occurrences of the same relationship must merge evidence,
not overwrite it (the old key=kind add kept only the last line)."""
from core.schema import Edge, Node, NodeKind, EdgeKind
from graph.build import build_graph, to_json


def test_repeated_edge_merges_all_evidence_lines():
    nodes = [Node("pgm:P", NodeKind.PGM, "P"), Node("para:P.A", NodeKind.PARAGRAPH, "A")]
    edges = [
        Edge("pgm:P", "para:P.A", EdgeKind.PGM_PERFORMS, {"line": 100}),
        Edge("pgm:P", "para:P.A", EdgeKind.PGM_PERFORMS, {"line": 200}),
        Edge("pgm:P", "para:P.A", EdgeKind.PGM_PERFORMS, {"line": 300}),
    ]
    g = build_graph(nodes, edges)
    d = to_json(g)
    assert d["stats"]["edges"] == 1  # one logical relationship
    ev = d["edges"][0]["evidence"]
    assert ev["lines"] == [100, 200, 300]  # every citation kept
    assert ev["line"] == 100  # primary line stable (first), backward compatible
