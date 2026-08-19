"""Test the COBOL source extraction against the REAL lgipol01.cbl from GenApp.

Ground truth (see fixtures/cobolrekt/SHAPE.md):
  PROGRAM-ID LGIPOL01; COPY LGPOLICY + LGCMAREA (data); CICS LINK to LGIPDB01
  and LGSTSQ; PERFORM WRITE-ERROR-MESSAGE; no EXEC SQL / SELECT.
"""
from core.schema import nid
from parsers.cobol import CobolParser

SRC = "corpora/genapp-src/base/src/lgipol01.cbl"


def _parse():
    return CobolParser().parse(SRC)


def test_program_id():
    pu = _parse()
    assert pu.program == "LGIPOL01"
    assert any(n.id == nid("pgm", "LGIPOL01") for n in pu.nodes)


def test_copybooks_detected_as_data_usage():
    pu = _parse()
    copies = {
        e.dst: e for e in pu.edges if e.kind == "PGM_COPIES" and e.src == nid("pgm", "LGIPOL01")
    }
    assert nid("copy", "LGPOLICY") in copies
    assert nid("copy", "LGCMAREA") in copies
    assert copies[nid("copy", "LGPOLICY")].evidence["usage"] == "data"
    assert copies[nid("copy", "LGPOLICY")].evidence["line"] > 0


def test_cics_link_calls():
    pu = _parse()
    called = {e.dst for e in pu.edges if e.kind == "PGM_CALLS" and e.src == nid("pgm", "LGIPOL01")}
    assert nid("pgm", "LGIPDB01") in called  # LINK PROGRAM(LGIPDB01)
    assert nid("pgm", "LGSTSQ") in called  # LINK PROGRAM('LGSTSQ')


def test_perform_paragraph():
    pu = _parse()
    performs = [
        e.dst for e in pu.edges if e.kind == "PGM_PERFORMS" and e.src == nid("pgm", "LGIPOL01")
    ]
    assert nid("para", "LGIPOL01.WRITE-ERROR-MESSAGE") in performs
