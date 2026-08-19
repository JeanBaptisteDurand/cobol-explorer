"""Gap #1: CICS transactions (CSD) + BMS maps + COBOL SEND/RECEIVE MAP."""
from core.schema import nid
from parsers.bms import BmsParser
from parsers.cobol import CobolParser
from parsers.csd import CsdParser


def test_csd_transaction_to_program(tmp_path):
    f = tmp_path / "cdef.jcl"
    f.write_text(
        "//X JOB\n//SYSIN DD *\n"
        " Define Transaction(SSC1) Group(GENASAT)\n"
        "        Program(LGTESTC1) TaskDataLoc(Any)\n"
        " Define Program(LGTESTC1) Group(GENASAP)\n/*\n"
    )
    pu = CsdParser().parse(str(f))
    assert nid("txn", "SSC1") in {n.id for n in pu.nodes}
    assert any(
        e.kind == "TXN_INVOKES" and e.src == nid("txn", "SSC1") and e.dst == nid("pgm", "LGTESTC1")
        for e in pu.edges
    )


def test_bms_maps_grouped_by_mapset(tmp_path):
    f = tmp_path / "m.bms"
    f.write_text(
        "SSMAP   DFHMSD TYPE=MAP,MODE=INOUT,LANG=COBOL\n"
        "SSMAPC1 DFHMDI SIZE=(24,80)\n"
        "SSMAPP1 DFHMDI SIZE=(24,80)\n"
        "        DFHMSD TYPE=FINAL\n"
    )
    pu = BmsParser().parse(str(f))
    labels = {n.label for n in pu.nodes}
    assert {"SSMAPC1", "SSMAPP1"} <= labels
    assert all(n.kind == "BMS_MAP" for n in pu.nodes)
    assert pu.nodes[0].attrs["mapset"] == "SSMAP"


def test_cobol_sends_map_real():
    pu = CobolParser().parse("corpora/genapp-src/base/src/lgtestp1.cbl")
    sends = [e for e in pu.edges if e.kind == "PGM_USES_MAP"]
    assert any(e.dst == nid("map", "SSMAPP1") for e in sends)


def test_cics_file_ops_real():
    # LGIPVS01 reads the policy VSAM file via EXEC CICS READ FILE('KSDSPOLY')
    pu = CobolParser().parse("corpora/genapp-src/base/src/lgipvs01.cbl")
    reads = [e for e in pu.edges if e.kind == "PGM_READS_FILE"]
    assert any(e.dst == nid("file", "KSDSPOLY") for e in reads)
    # LGDPVS01 deletes from the policy VSAM file -> write
    pu2 = CobolParser().parse("corpora/genapp-src/base/src/lgdpvs01.cbl")
    writes = [e for e in pu2.edges if e.kind == "PGM_WRITES_FILE"]
    assert any(e.dst == nid("file", "KSDSPOLY") for e in writes)
