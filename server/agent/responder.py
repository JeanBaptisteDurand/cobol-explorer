"""Grounded responder for the hero question (copybook impact).

This is the deterministic core the LLM agent wraps: it calls the tools, records
a trace, and composes an answer that always cites source lines. It works today
without an LLM, proving the grounding+trace contract end-to-end.
"""
from __future__ import annotations

from core.schema import split_id

from agent.tools import GraphTools
from agent.trace import Trace


def answer_copybook_impact(
    copybook: str, graph_path: str = "graph.json", corpus_root: str = "corpora"
) -> dict:
    tools = GraphTools(graph_path, corpus_root)
    trace = Trace()

    r = tools.graph_lookup("impact", copybook)
    programs = r["programs"]
    trace.record(
        "graph_lookup",
        {"op": "impact", "node": copybook},
        f"{len(programs)} programme(s), {len(r['chains'])} chaine(s) batch",
        sources=[r["node"]],
    )

    citations: list[tuple[str, str]] = []
    for p in programs[:3]:
        if p.get("file") and p.get("copy_line"):
            src = tools.read_source_lines(p["file"], p["copy_line"], p["copy_line"])
            if "text" in src:
                cite = f'{src["file"]}:{src["start"]}'
                citations.append((cite, src["text"].strip()))
                trace.record(
                    "read_source_lines",
                    {"file": p["file"], "start": p["copy_line"], "end": p["copy_line"]},
                    "1 source line",
                    sources=[cite],
                )

    labels = ", ".join(p["label"] for p in programs)
    kind_word = {"copy": "copybook", "table": "DB2 table", "pgm": "program"}.get(
        split_id(r["node"])[0], "entity"
    )
    lines = [
        f"Changing {kind_word} {copybook.upper()} impacts {len(programs)} program(s): {labels}."
    ]
    if r["chains"]:
        chain_names = ", ".join(split_id(c)[1] for c in r["chains"])
        job_names = ", ".join(split_id(j)[1] for j in r["jobs"])
        lines.append(f"Batch chain(s) affected: {chain_names} (via jobs {job_names}).")
    if citations:
        lines.append("Evidence (source line):")
        for cite, text in citations:
            lines.append(f"  - {cite}: {text}")

    return {"answer": "\n".join(lines), "trace": trace, "impact": r}
