from core.schema import Edge, EdgeKind, Node, NodeKind, nid
from graph.build import build_graph, from_json, to_json
from graph.queries import callees, callers, impact, lineage


def _demo_graph():
    nodes = [
        Node(nid("copy", "LGPOLICY"), NodeKind.COPYBOOK, "LGPOLICY"),
        Node(nid("pgm", "LGAPOL01"), NodeKind.PGM, "LGAPOL01"),
        Node(nid("pgm", "LGIPOL01"), NodeKind.PGM, "LGIPOL01"),
        Node(nid("step", "DAILYPOL.STEP01"), NodeKind.STEP, "STEP01"),
        Node(nid("step", "DAILYPOL.STEP02"), NodeKind.STEP, "STEP02"),
        Node(nid("job", "DAILYPOL"), NodeKind.JOB, "DAILYPOL"),
        Node(nid("sched", "NIGHTLY"), NodeKind.SCHED_JOB, "NIGHTLY"),
        Node(nid("ds", "INS.POLICY.MASTER"), NodeKind.DATASET, "INS.POLICY.MASTER"),
    ]
    edges = [
        Edge(nid("pgm", "LGAPOL01"), nid("copy", "LGPOLICY"), EdgeKind.PGM_COPIES, {"line": 10, "usage": "data"}),
        Edge(nid("pgm", "LGIPOL01"), nid("copy", "LGPOLICY"), EdgeKind.PGM_COPIES, {"line": 12, "usage": "data"}),
        Edge(nid("step", "DAILYPOL.STEP01"), nid("pgm", "LGAPOL01"), EdgeKind.STEP_EXECUTES, {}),
        Edge(nid("step", "DAILYPOL.STEP02"), nid("pgm", "LGIPOL01"), EdgeKind.STEP_EXECUTES, {}),
        Edge(nid("job", "DAILYPOL"), nid("step", "DAILYPOL.STEP01"), EdgeKind.JOB_CONTAINS, {}),
        Edge(nid("job", "DAILYPOL"), nid("step", "DAILYPOL.STEP02"), EdgeKind.JOB_CONTAINS, {}),
        Edge(nid("sched", "NIGHTLY"), nid("job", "DAILYPOL"), EdgeKind.SCHED_RUNS, {}),
        Edge(nid("pgm", "LGAPOL01"), nid("ds", "INS.POLICY.MASTER"), EdgeKind.PGM_WRITES, {"ddname": "POLFILE"}),
        Edge(nid("pgm", "LGIPOL01"), nid("ds", "INS.POLICY.MASTER"), EdgeKind.PGM_READS, {"ddname": "POLFILE"}),
        Edge(nid("pgm", "LGIPOL01"), nid("pgm", "LGAPOL01"), EdgeKind.PGM_CALLS, {"line": 50}),
    ]
    return build_graph(nodes, edges)


def test_impact_copybook_hero_query():
    g = _demo_graph()
    r = impact(g, nid("copy", "LGPOLICY"))
    assert set(r["programs"]) == {nid("pgm", "LGAPOL01"), nid("pgm", "LGIPOL01")}
    assert r["jobs"] == [nid("job", "DAILYPOL")]
    assert r["chains"] == [nid("sched", "NIGHTLY")]


def test_lineage_read_write():
    g = _demo_graph()
    r = lineage(g, nid("ds", "INS.POLICY.MASTER"))
    assert r["written_by"] == [nid("pgm", "LGAPOL01")]
    assert r["read_by"] == [nid("pgm", "LGIPOL01")]


def test_callers_callees():
    g = _demo_graph()
    assert callers(g, nid("pgm", "LGAPOL01")) == [nid("pgm", "LGIPOL01")]
    assert callees(g, nid("pgm", "LGIPOL01")) == [nid("pgm", "LGAPOL01")]


def test_json_roundtrip_preserves_impact():
    g = _demo_graph()
    g2 = from_json(to_json(g))
    assert g2.number_of_nodes() == g.number_of_nodes()
    assert impact(g2, nid("copy", "LGPOLICY"))["programs"] == impact(g, nid("copy", "LGPOLICY"))["programs"]
