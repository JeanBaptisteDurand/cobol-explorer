from core.schema import Edge, EdgeKind, Node, NodeKind, nid, split_id


def test_nid_roundtrip():
    assert nid("pgm", "LGIPOL01") == "pgm:LGIPOL01"
    assert split_id("copy:LGPOLICY") == ("copy", "LGPOLICY")


def test_split_id_handles_dsn_with_dots():
    # dataset ids can contain dots in the name part
    assert split_id("ds:INS.POLICY.MASTER") == ("ds", "INS.POLICY.MASTER")


def test_edge_requires_evidence():
    e = Edge(
        src="pgm:A",
        dst="copy:B",
        kind=EdgeKind.PGM_COPIES,
        evidence={"line": 42, "replacing": None, "usage": "data"},
    )
    assert e.evidence["line"] == 42
    assert e.kind == "PGM_COPIES"


def test_node_defaults_empty_attrs():
    n = Node(id="pgm:LGAPOL01", kind=NodeKind.PGM, label="LGAPOL01")
    assert n.attrs == {}
    assert n.to_dict()["id"] == "pgm:LGAPOL01"
