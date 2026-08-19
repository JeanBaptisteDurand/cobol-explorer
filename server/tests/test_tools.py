from agent.responder import answer_copybook_impact
from agent.tools import GraphTools
from run_ingest import ingest


def _graph(tmp_path):
    gp = tmp_path / "g.json"
    ingest("corpora", str(gp))
    return str(gp)


def test_graph_lookup_impact(tmp_path):
    tools = GraphTools(_graph(tmp_path), "corpora")
    r = tools.graph_lookup("impact", "LGPOLICY")  # resolves bare name -> copy:LGPOLICY
    assert len(r["programs"]) >= 3
    assert all("id" in p and "label" in p for p in r["programs"])
    assert r["chains"]


def test_callers_on_copybook_falls_back_to_impact(tmp_path):
    # A copybook has no CALL callers; op=callers must still surface the programs
    # that COPY it (so a wrong-op LLM choice stays grounded and correct).
    tools = GraphTools(_graph(tmp_path), "corpora")
    callers = tools.graph_lookup("callers", "LGPOLICY")["callers"]
    impact = tools.graph_lookup("impact", "LGPOLICY")["programs"]
    assert callers, "copybook used by programs must not report 0 callers"
    assert set(callers) == {p["id"] for p in impact}


def test_summary_profiles_a_program(tmp_path):
    # "Que fait le programme X ?" -> a full functional profile, not just calls.
    tools = GraphTools(_graph(tmp_path), "corpora")
    r = tools.graph_lookup("summary", "LGIPOL01")
    assert r["found"] is True
    for key in ("copybooks", "tables_read", "tables_written", "calls", "called_by", "screens", "transactions"):
        assert key in r and isinstance(r[key], list)
    assert "LGCMAREA" in r["copybooks"]  # LGIPOL01 copies the shared comm area
    assert r.get("source_head")  # header attached so the agent can summarize the purpose


def test_dead_code_finds_unused_copybooks(tmp_path):
    tools = GraphTools(_graph(tmp_path), "corpora")
    dc = tools.dead_code()
    assert "orphan_programs" in dc and isinstance(dc["orphan_programs"], list)
    # the corpus has many .cpy files; only a few are actually COPY'd -> some unused.
    assert dc["unused_copybooks"], "expected some unreferenced copybook files"


def test_copybook_fields_maps_fields_to_programs(tmp_path):
    tools = GraphTools(_graph(tmp_path), "corpora")
    r = tools.copybook_fields("LGPOLICY")
    assert r["fields"], "LGPOLICY should expose data items"
    assert r["programs"], "LGPOLICY is copied by programs"
    # at least one field is actually referenced by a COPY'ing program.
    assert any(f["used_by"] for f in r["fields"])


def test_read_source_lines_cites_copy(tmp_path):
    tools = GraphTools(_graph(tmp_path), "corpora")
    src = tools.read_source_lines("lgipol01.cbl", 55, 55)
    assert "COPY LGPOLICY" in src["text"].upper()
    assert src["start"] == 55


def test_answer_is_grounded_and_traced(tmp_path):
    res = answer_copybook_impact("LGPOLICY", _graph(tmp_path), "corpora")
    assert "LGPOLICY" in res["answer"].upper()
    tools_used = {s.tool for s in res["trace"].steps}
    assert "graph_lookup" in tools_used
    assert "read_source_lines" in tools_used
    # at least one citation of the form file:line
    assert any(":" in src for s in res["trace"].steps for src in s.sources)
