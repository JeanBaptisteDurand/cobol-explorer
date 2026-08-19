from core.schema import nid
from graph.cross_resolve import resolve_file_lineage
from parsers.jcl import JclParser

FIX = "ingestion/tests/fixtures/jcl/DAILYPOL.jcl"


def test_lineage_join_read():
    pu = JclParser().parse(FIX)
    selects = {nid("pgm", "LGAPOL01"): {"POLICY-FILE": "POLFILE"}}
    new = resolve_file_lineage(pu.edges, selects)
    reads = [
        e
        for e in new
        if e.kind == "PGM_READS"
        and e.src == nid("pgm", "LGAPOL01")
        and e.dst == nid("ds", "INS.POLICY.MASTER")
    ]
    assert reads and reads[0].evidence["ddname"] == "POLFILE"
    assert reads[0].evidence["via_step"] == nid("step", "DAILYPOL.STEP01")


def test_lineage_write_from_disp():
    pu = JclParser().parse(FIX)
    selects = {nid("pgm", "LGAPOL01"): {"REPORT-FILE": "OUTREP"}}
    new = resolve_file_lineage(pu.edges, selects)
    writes = [e for e in new if e.kind == "PGM_WRITES" and e.dst == nid("ds", "INS.POLICY.REPORT")]
    assert writes and writes[0].evidence["disp"] == "write"
