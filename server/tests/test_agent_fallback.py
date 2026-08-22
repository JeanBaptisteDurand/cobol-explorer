"""When the LLM is unavailable, run_agent falls back to the grounded responder."""
from run_ingest import ingest


def test_deterministic_fallback_on_llm_error(tmp_path, monkeypatch):
    import agent.agent as ag

    graph = tmp_path / "g.json"
    ingest("corpora", str(graph))

    def boom(*_a, **_k):
        raise RuntimeError("ollama down")

    monkeypatch.setattr(ag, "_arun", boom)
    res = ag.run_agent(
        "What is the impact of copybook LGPOLICY?",
        str(graph),
        "corpora",
        str(tmp_path / "versions"),
    )
    assert "LGPOLICY" in res["answer"].upper()
    assert any(s.tool == "graph_lookup" for s in res["trace"].steps)


def test_fallback_answers_program_questions_too(tmp_path, monkeypatch):
    """Without the LLM, 'what does program X do' still gets a structural answer."""
    import agent.agent as ag

    graph = tmp_path / "g.json"
    ingest("corpora", str(graph))
    monkeypatch.setattr(ag, "_arun", lambda *_a, **_k: (_ for _ in ()).throw(RuntimeError("ollama down")))
    res = ag.run_agent("What does program LGIPOL01 do?", str(graph), "corpora", str(tmp_path / "versions"))
    assert "LGIPOL01" in res["answer"].upper()
    # the fallback recorded a graph_lookup step (so the live trace still streams)
    assert any(s.tool == "graph_lookup" for s in res["trace"].steps)
