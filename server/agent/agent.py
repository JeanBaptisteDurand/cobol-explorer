"""Grounded agentic RAG over the mainframe graph, on the IBM stack.

BeeAI ``RequirementAgent`` + IBM Granite (via Ollama) with four tools:
``graph_lookup``, ``read_source_lines``, ``web_search``, ``propose_change``.
Each tool is instrumented to record a trace step, so the answer always comes
with an auditable tool-call trace. If the LLM backend is unavailable, callers
fall back to the deterministic responder.
"""
from __future__ import annotations

import asyncio
import json
import os

from beeai_framework.agents.requirement import RequirementAgent
from beeai_framework.backend import ChatModel
from beeai_framework.tools import tool

from agent.tools import GraphTools
from agent.trace import Trace
from agent.web_search import web_search as _web_search
from versioning.changeset import VersionStore

MODEL = os.environ.get("COBOL_EXPLORER_MODEL", "ollama:granite3.3:8b")

INSTRUCTIONS = [
    "You are an expert analyst of COBOL/mainframe estates, serving both developers and business/risk/compliance teams.",
    "BEFORE every tool call, use 'think' to explain in ONE sentence your reasoning and WHY you pick the graph RAG (structure/impact/lineage, cites lines) or the vector RAG search_code (semantic, unknown name). This is what makes your reasoning path auditable.",
    "Use graph_lookup for impact, lineage and calls (op: summary|impact|lineage|callers|callees|neighbors).",
    "For 'what does program X do / what is it for', use op=summary: it returns the full profile (copybooks, DB2 tables read/written, VSAM files, CICS screens, sub-programs called, called by, transactions) AND the source header. Summarise the BUSINESS function from those elements and cite the lines. NEVER limit yourself to the calls (callees).",
    "For a copybook or a DB2 table ('who uses', 'impacted by', 'what a change breaks'), use op=impact (the programs that COPY/SQL it). Use callers/callees only for CALL relationships between programs.",
    "HYBRID search: when you do not know the exact name (a question by concept or intent, e.g. 'where is the premium computed', 'the logging'), use search_code FIRST (semantic, Granite) to find the right program, THEN graph_lookup (op=summary/impact) on it for the structure. Combine semantic and graph.",
    "Use read_source_lines to quote EXACT source lines.",
    "CITATION FORMAT — cite every fact as `file.ext:line` (for example `lgacdb01.cbl:88`), never as the entity name alone. The tool results give you the file for each entity; use it. An answer whose citations cannot be resolved is flagged as unsourced.",
    "Use web_search only for external context (regulation, definitions).",
    "Use propose_change when the user wants to modify something: it creates a new version and reports the impact.",
    "If the request is ambiguous (e.g. 'change the insurance value' without saying which product or field), ASK a clarifying question instead of guessing.",
    "Answer in English, concisely, listing your sources.",
]


def _summ(res: dict) -> str:
    """One line per tool call, as shown in the visible reasoning trace.

    In English like everything else the reader sees: this is the product's
    signature surface, the thing a sceptic reads to decide whether the answer
    was derived or invented.
    """
    if "copybooks" in res and "calls" in res:  # summary/profile
        return (
            f"profile {res.get('label')}: {len(res.get('copybooks', []))} copybooks, "
            f"{len(res.get('tables_read', [])) + len(res.get('tables_written', []))} tables, "
            f"{len(res.get('screens', []))} screens, {len(res.get('calls', []))} calls"
        )
    if "programs" in res:
        return f"{len(res['programs'])} programs, {len(res.get('chains', []))} batch chains"
    if "callers" in res:
        return f"{len(res['callers'])} callers"
    if "callees" in res:
        return f"{len(res['callees'])} callees"
    if "in" in res and "out" in res:  # neighbors
        return f"{len(res['in'])} inbound, {len(res['out'])} outbound"
    return "ok"


def _corpus_rel(gt: GraphTools, file: str) -> str:
    path = gt.find_file(os.path.basename(file))
    return os.path.relpath(path, gt.corpus_root) if path else file


def build_tools(gt: GraphTools, store: VersionStore, trace: Trace):
    def think(thoughts: str) -> str:
        """Think out loud BEFORE acting: state your reasoning, and above all WHY you pick
        this tool — the graph RAG (exact structure: impact, lineage, calls, cites lines) or
        the vector RAG search_code (semantic: find by concept when the name is unknown)."""
        # A tool description is part of the prompt: written in French it pulled the
        # model into answering in French, against the instruction two lines above
        # telling it to answer in English.
        trace.record("think", {}, thoughts[:500], sources=[])
        return "Reasoning recorded. Continue with the tool you chose."

    def graph_lookup(op: str, node: str) -> str:
        """Query the mainframe dependency graph. op in {summary, impact, lineage, callers, callees, neighbors}; node like LGIPOL01, LGPOLICY or copy:LGPOLICY. Use op=summary to describe what a program does."""
        res = gt.graph_lookup(op, node)
        trace.record("graph_lookup", {"op": op, "node": node}, _summ(res), sources=[res.get("node", node)])
        return json.dumps(res)[:4000]

    def read_source_lines(file: str, start: int, end: int) -> str:
        """Read exact source lines from a COBOL/JCL/copybook file, for citation."""
        res = gt.read_source_lines(file, start, end)
        cite = f'{res.get("file")}:{res.get("start")}' if "file" in res else file
        trace.record("read_source_lines", {"file": file, "start": start, "end": end}, "source lines", sources=[cite])
        return json.dumps(res)

    def search_code(query: str) -> str:
        """Semantic search over the COBOL code: find programs/copybooks by concept (IBM Granite embeddings)."""
        res = gt.search_code(query)
        hits = res.get("results", [])
        trace.record("search_code", {"query": query}, f"{len(hits)} results", sources=[h["file"] for h in hits[:3]])
        return json.dumps(res)[:3000]

    def web_search(query: str) -> str:
        """Search the web for external context such as an insurance regulation or definition."""
        res = _web_search(query)
        trace.record("web_search", {"query": query}, f"{len(res)} results", sources=[r.get("url", "") for r in res[:3]])
        return json.dumps(res)[:3000]

    def propose_change(title: str, file: str, note: str) -> str:
        """Create a new version (change-set) proposing an edit to a file (e.g. a copybook) and return the computed impact (programs, batch chains)."""
        rel = _corpus_rel(gt, file)
        cs = store.create(title, author="agent")
        store.add_edit(cs.id, rel, store.read_effective(cs.id, rel), note=note)
        imp = store.compute_impact(cs.id, gt)
        trace.record(
            "propose_change",
            {"title": title, "file": file},
            f"version {cs.id}: {len(imp['programs'])} programs impacted",
            sources=[f"changeset:{cs.id}"],
        )
        return json.dumps({"changeset": cs.id, "impact": imp})

    return [tool(think), tool(graph_lookup), tool(search_code), tool(read_source_lines), tool(web_search), tool(propose_change)]


def _extract_answer(out) -> str:
    for attr in ("answer", "result", "output", "last_message", "final_answer"):
        v = getattr(out, attr, None)
        if v is None:
            continue
        if isinstance(v, str):
            return v
        t = getattr(v, "text", None)
        if t:
            return t
    return str(out)


async def _arun(question: str, tools):
    agent = RequirementAgent(
        llm=ChatModel.from_name(MODEL),
        tools=tools,
        role="COBOL/mainframe analyst for development, risk and compliance teams",
        instructions=INSTRUCTIONS,
        name="CobolExplorer",
    )
    return await agent.run(question)


def _compose(question: str, history: list[dict] | None) -> str:
    """Prefix the recent conversation so follow-ups ('on which line?', 'and that
    program?') resolve their references. Only the LLM path sees this; the
    deterministic fallback keeps parsing the raw latest question."""
    if not history:
        return question
    lines = []
    for h in history[-4:]:
        if not isinstance(h, dict):
            continue
        who = "User" if h.get("role") == "user" else "Assistant"
        # Coerce defensively: history comes from a loosely-typed API field (list[dict]),
        # so a non-string 'text' must not raise (it would look like an LLM outage).
        txt = str(h.get("text") or "").strip().replace("\n", " ")
        if txt:
            lines.append(f"{who}: {txt[:400]}")
    if not lines:
        return question
    ctx = "\n".join(lines)
    return (
        "Recent conversation history (to resolve references such as "
        "'that program' or 'that line'):\n" + ctx +
        "\n\nThe user's new question: " + question
    )


def run_agent(
    question: str,
    graph_path: str = "graph.json",
    corpus_root: str = "corpora",
    versions_root: str = "versions",
    on_step=None,
    history: list[dict] | None = None,
    index_path: str = "index.json",
    vector_backend: str | None = None,
) -> dict:
    gt = GraphTools(graph_path, corpus_root, index_path, vector_backend=vector_backend)
    store = VersionStore(versions_root, corpus_root)
    trace = Trace(on_record=on_step)
    tools = build_tools(gt, store, trace)
    try:
        out = asyncio.run(_arun(_compose(question, history), tools))
        return {"answer": _extract_answer(out), "trace": trace}
    except Exception as exc:  # LLM unavailable -> deterministic fallback
        return _deterministic_fallback(question, gt, trace, exc)


def _format_profile(p: dict) -> str:
    if not p.get("found"):
        return f"Entity {p.get('node')} not found in the graph."
    out = [f"**{p['label']}** — "]
    tables = sorted(set(p.get("tables_read", []) + p.get("tables_written", [])))
    if p.get("copybooks"):
        out.append(f"copies {', '.join(p['copybooks'])}. ")
    if tables:
        out.append(f"DB2 tables: {', '.join(tables)}. ")
    if p.get("screens"):
        out.append(f"CICS screens: {', '.join(p['screens'])}. ")
    if p.get("calls"):
        out.append(f"Calls: {', '.join(p['calls'])}. ")
    if p.get("called_by"):
        out.append(f"Called by: {', '.join(p['called_by'])}. ")
    if p.get("transactions"):
        out.append(f"Transactions: {', '.join(p['transactions'])}. ")
    return "".join(out) or f"{p['label']}: no dependency detected."


def _deterministic_fallback(question: str, gt: GraphTools, trace: Trace, exc: Exception) -> dict:
    """When the LLM is down, still answer structural questions from the graph alone
    (no LLM): copybook/table -> impact ; program -> functional profile. Steps go through
    trace.record so the live trace still streams. Only pure semantic questions can't run."""
    import re

    from agent.responder import answer_copybook_impact

    import logging
    logging.getLogger("uvicorn.error").info("agent fallback: %s", type(exc).__name__)
    note = "\n\n> Deterministic answer — no language model is configured, so this was derived from the graph alone."
    # Allow underscores so table names like CUSTOMER_SECURE resolve as one token.
    for tok in re.findall(r"\b[A-Za-z][A-Za-z0-9_]{2,}\b", question):
        nid = gt.resolve(tok.upper())
        prefix = nid.split(":")[0] if ":" in nid else ""
        if prefix in ("copy", "table"):
            res = answer_copybook_impact(tok.upper(), gt.graph_path, gt.corpus_root)
            for s in res["trace"].steps:
                trace.record(s.tool, s.input, s.output_summary, s.sources)  # streams live
            return {"answer": res["answer"] + note, "trace": trace}
        if prefix == "pgm":
            prof = gt.graph_lookup("summary", tok.upper())
            trace.record("graph_lookup", {"op": "summary", "node": tok.upper()},
                         _summ(prof), sources=[prof.get("node", nid)])
            return {"answer": _format_profile(prof) + note, "trace": trace}
    return {"answer": "No language model is configured, and this question needs one. Name a program, a copybook or a table and the graph alone can answer — impact, callers, profile — with citations.", "trace": trace}
