import glob

from core.schema import nid
from parsers.jcl import JclParser

FIX = "ingestion/tests/fixtures/jcl/DAILYPOL.jcl"


def test_jcl_job_steps_and_dd():
    pu = JclParser().parse(FIX)
    ids = {n.id for n in pu.nodes}
    assert nid("job", "DAILYPOL") in ids
    assert nid("step", "DAILYPOL.STEP01") in ids
    assert nid("pgm", "LGAPOL01") in ids

    execs = [e for e in pu.edges if e.kind == "STEP_EXECUTES" and e.dst == nid("pgm", "LGAPOL01")]
    assert execs and execs[0].src == nid("step", "DAILYPOL.STEP01")

    dds = [e for e in pu.edges if e.kind == "STEP_USES_DD"]
    assert any(e.evidence["ddname"] == "POLFILE" and "INS.POLICY.MASTER" in e.dst for e in dds)


def test_jcl_gdg_generation_stripped_and_write_disp():
    pu = JclParser().parse(FIX)
    outrep = [e for e in pu.edges if e.kind == "STEP_USES_DD" and e.evidence["ddname"] == "OUTREP"]
    assert outrep, "OUTREP DD not found"
    e = outrep[0]
    assert e.dst == nid("ds", "INS.POLICY.REPORT")  # (+1) stripped to base
    assert e.evidence["gen"] == "+1"
    assert e.evidence["disp"] == "write"  # DISP=(NEW,...)


def test_jcl_does_not_crash_on_real_genapp():
    # Robustness: real GenApp JCL has procs, JCLLIB, in-stream data.
    matches = glob.glob("corpora/genapp-src/base/cntl/*.jcl")
    assert matches, "GenApp corpus not present"
    for path in matches:
        pu = JclParser().parse(path)  # must not raise
    # at least one file yields a JOB node
    any_job = any(
        any(n.kind == "JOB" for n in JclParser().parse(p).nodes) for p in matches[:5]
    )
    assert any_job
