from core.schema import Node, NodeKind, nid
from graph.domains import apply_domains, load_mapping
from graph.scheduler import load_scheduler


def test_scheduler_triggers_and_runs():
    nodes, edges = load_scheduler("corpora/scheduler.json")
    ids = {n.id for n in nodes}
    assert nid("sched", "SDAILYPOL") in ids and nid("sched", "SPOLRPT") in ids

    trig = [e for e in edges if e.kind == "SCHED_TRIGGERS"]
    runs = [e for e in edges if e.kind == "SCHED_RUNS"]
    assert any(e.src == nid("sched", "SDAILYPOL") and e.dst == nid("sched", "SPOLRPT") for e in trig)
    assert any(e.src == nid("sched", "SDAILYPOL") and e.dst == nid("job", "DAILYPOL") for e in runs)


def test_domains_grouping_first_match_wins():
    mapping = load_mapping("corpora/domains.yaml")
    nodes = [
        Node(nid("pgm", "LGAPOL01"), NodeKind.PGM, "LGAPOL01"),
        Node(nid("pgm", "LGAPDB01"), NodeKind.PGM, "LGAPDB01"),
        Node(nid("pgm", "LGACUS01"), NodeKind.PGM, "LGACUS01"),
    ]
    dnodes, dedges = apply_domains(nodes, mapping)
    pairs = {(e.src, e.dst) for e in dedges}
    assert (nid("domain", "POLICY-UNDERWRITING"), nid("pgm", "LGAPOL01")) in pairs
    assert (nid("domain", "DB2-DATA-ACCESS"), nid("pgm", "LGAPDB01")) in pairs
    assert (nid("domain", "CUSTOMER-MANAGEMENT"), nid("pgm", "LGACUS01")) in pairs
