"""The golden answer-quality set must pass on the deterministic path (regression gate)."""
from agent.eval import GOLDEN, evaluate
from run_ingest import ingest


def test_golden_quality_set_passes(tmp_path):
    graph = tmp_path / "g.json"
    ingest("corpora", str(graph))
    report = evaluate(str(graph), "corpora")
    assert report["all_pass"], f"quality regression: {[it for it in report['items'] if not it['pass']]}"
    assert report["total"] == len(GOLDEN)
    # every graded answer is grounded (citations resolve)
    assert all(it["grounded"] for it in report["items"])
