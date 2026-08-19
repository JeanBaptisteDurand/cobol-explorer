"""Live agent test — skipped automatically if Ollama/Granite is unavailable."""
import os

import pytest

from run_ingest import ingest


def _ollama_up() -> bool:
    if os.environ.get("COBOL_EXPLORER_SKIP_LLM"):
        return False
    try:
        import ollama

        ollama.list()
        return True
    except Exception:
        return False


@pytest.mark.skipif(not _ollama_up(), reason="Ollama/Granite not available")
def test_agent_answers_impact_grounded(tmp_path):
    from agent.agent import run_agent

    graph = tmp_path / "g.json"
    ingest("corpora", str(graph))
    res = run_agent(
        "Quels programmes sont impactes si je modifie le copybook LGPOLICY ?",
        graph_path=str(graph),
        corpus_root="corpora",
        versions_root=str(tmp_path / "versions"),
    )
    assert not res["answer"].startswith("[Agent LLM indisponible")
    # the agent used at least one graph tool
    assert any(s.tool == "graph_lookup" for s in res["trace"].steps)
    # grounded: mentions at least one impacted program
    assert "LG" in res["answer"].upper()
