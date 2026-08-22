"""CLI: answer the hero copybook-impact question, grounded and traced.

Run:  PYTHONPATH=packages/core:ingestion:server .venv/bin/python -m ask LGPOLICY
"""
from __future__ import annotations

import argparse

from agent.responder import answer_copybook_impact


def main() -> None:
    ap = argparse.ArgumentParser(description="Grounded copybook-impact answer")
    ap.add_argument("copybook", help="copybook name, e.g. LGPOLICY")
    ap.add_argument("--graph", default="graph.json")
    ap.add_argument("--corpus", default="corpora")
    args = ap.parse_args()

    res = answer_copybook_impact(args.copybook, args.graph, args.corpus)
    print("=" * 70)
    print("ANSWER")
    print("=" * 70)
    print(res["answer"])
    print()
    print("=" * 70)
    print("TOOL-CALL TRACE (auditable grounding)")
    print("=" * 70)
    print(res["trace"].render())


if __name__ == "__main__":
    main()
