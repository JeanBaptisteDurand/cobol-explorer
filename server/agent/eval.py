"""Answer-quality evaluation harness — a golden Q/A regression set the answers are
scored against, so quality is measured, not assumed.

Each item scores three axes:
- **entity recall**: are the programs/entities the answer MUST name actually present?
- **groundedness**: does every cited file:line resolve (citation guardrail)?
- **coverage**: does impact reach at least the expected number of programs?

Runs offline against the deterministic responder (no LLM) so it can gate CI; the
same items can be replayed through the live agent (``make eval``).
"""
from __future__ import annotations

from agent.responder import answer_copybook_impact
from agent.verify import verify_answer

# Golden set — expected structural facts about the GenApp patrimony.
GOLDEN = [
    {"node": "LGPOLICY", "min_programs": 8, "must_mention": ["LGACDB01", "LGIPOL01", "LGUPDB01"]},
    {"node": "LGCMAREA", "min_programs": 15, "must_mention": ["LGACDB01", "LGIPOL01"]},
    {"node": "SSMAP", "min_programs": 3, "must_mention": []},
]


def evaluate(graph_path: str = "graph.json", corpus_root: str = "corpora", golden: list[dict] | None = None) -> dict:
    items = []
    for g in golden or GOLDEN:
        res = answer_copybook_impact(g["node"], graph_path, corpus_root)
        answer = res["answer"]
        programs = res["impact"]["programs"]
        up = answer.upper()
        recall_hits = [m for m in g["must_mention"] if m.upper() in up]
        recall = len(recall_hits) / len(g["must_mention"]) if g["must_mention"] else 1.0
        sources = [s for step in res["trace"].steps for s in step.sources]
        # STRICT groundedness: an answer with zero citations must NOT pass — it has
        # to actually cite a resolving source line, not merely avoid a bad one.
        grounded = verify_answer(answer, sources, corpus_root)["grounded"]
        coverage_ok = len(programs) >= g["min_programs"]
        ok = coverage_ok and recall == 1.0 and grounded
        items.append({
            "node": g["node"], "programs": len(programs), "min_programs": g["min_programs"],
            "recall": round(recall, 2), "grounded": grounded, "coverage_ok": coverage_ok, "pass": ok,
        })
    passed = sum(1 for it in items if it["pass"])
    return {"items": items, "passed": passed, "total": len(items), "all_pass": passed == len(items)}


if __name__ == "__main__":  # make eval
    import json

    report = evaluate()
    print(json.dumps(report, indent=2, ensure_ascii=False))
    print(f"\nQuality: {report['passed']}/{report['total']} golden Q/A OK")
