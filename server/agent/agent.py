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
    "Tu es un analyste expert du patrimoine COBOL/mainframe, au service des equipes dev ET metier/risque/conformite.",
    "AVANT chaque appel d'outil, utilise 'think' pour expliquer en UNE phrase ton raisonnement et POURQUOI tu choisis le RAG graphe (structure/impact/lignee, cite les lignes) ou le RAG vectoriel search_code (semantique, nom inconnu). Cela rend ton chemin de raisonnement tracable.",
    "Utilise graph_lookup pour l'impact, la lignee et les appels (op: summary|impact|lineage|callers|callees|neighbors).",
    "Pour 'que fait / a quoi sert / role du programme X', utilise op=summary : il renvoie le profil complet (copybooks, tables DB2 lues/ecrites, fichiers VSAM, ecrans CICS, sous-programmes appeles, appele par, transactions) ET l'en-tete du source. Resume la FONCTION metier a partir de ces elements et cite les lignes. Ne te limite JAMAIS aux seuls appels (callees).",
    "Pour un copybook ou une table DB2 ('qui utilise', 'impacte par', 'que casse une modif'), utilise op=impact (les programmes qui COPY/SQL). N'utilise callers/callees que pour les appels CALL entre programmes.",
    "Recherche HYBRIDE : quand tu ne connais pas le nom exact (question par concept/intention, ex: 'ou est calculee la prime', 'le logging'), utilise D'ABORD search_code (semantique, Granite) pour trouver le bon programme, PUIS graph_lookup (op=summary/impact) sur ce programme pour la structure. Combine semantique + graphe.",
    "Utilise read_source_lines pour citer les lignes source EXACTES. Chaque fait doit etre cite (fichier:ligne).",
    "Utilise web_search uniquement pour du contexte externe (reglementation, definitions).",
    "Utilise propose_change quand l'utilisateur veut modifier quelque chose: cree une nouvelle version et rapporte l'impact.",
    "Si la demande est ambigue (ex: 'change la valeur d'assurance' sans preciser le produit ou le champ), POSE UNE QUESTION de clarification au lieu de deviner.",
    "Reponds en francais, de facon concise, en listant les sources.",
]


def _summ(res: dict) -> str:
    if "copybooks" in res and "calls" in res:  # summary/profile
        return (
            f"profil {res.get('label')}: {len(res.get('copybooks', []))} copybooks, "
            f"{len(res.get('tables_read', [])) + len(res.get('tables_written', []))} tables, "
            f"{len(res.get('screens', []))} ecrans, {len(res.get('calls', []))} appels"
        )
    if "programs" in res:
        return f"{len(res['programs'])} programmes, {len(res.get('chains', []))} chaines"
    if "callers" in res:
        return f"{len(res['callers'])} appelants"
    if "callees" in res:
        return f"{len(res['callees'])} appeles"
    if "in" in res and "out" in res:  # neighbors
        return f"{len(res['in'])} entrants, {len(res['out'])} sortants"
    return "ok"


def _corpus_rel(gt: GraphTools, file: str) -> str:
    path = gt.find_file(os.path.basename(file))
    return os.path.relpath(path, gt.corpus_root) if path else file


def build_tools(gt: GraphTools, store: VersionStore, trace: Trace):
    def think(thoughts: str) -> str:
        """Réfléchis à voix haute AVANT d'agir : décris ton raisonnement, et surtout POURQUOI
        tu choisis tel outil — RAG graphe (structure exacte : impact, lignée, appels, cite les
        lignes) vs RAG vectoriel search_code (sémantique : trouver par concept quand le nom est inconnu)."""
        trace.record("think", {}, thoughts[:500], sources=[])
        return "Raisonnement enregistré. Poursuis avec l'outil choisi."

    def graph_lookup(op: str, node: str) -> str:
        """Query the mainframe dependency graph. op in {summary, impact, lineage, callers, callees, neighbors}; node like LGIPOL01, LGPOLICY or copy:LGPOLICY. Use op=summary to describe what a program does."""
        res = gt.graph_lookup(op, node)
        trace.record("graph_lookup", {"op": op, "node": node}, _summ(res), sources=[res.get("node", node)])
        return json.dumps(res)[:4000]

    def read_source_lines(file: str, start: int, end: int) -> str:
        """Read exact source lines from a COBOL/JCL/copybook file, for citation."""
        res = gt.read_source_lines(file, start, end)
        cite = f'{res.get("file")}:{res.get("start")}' if "file" in res else file
        trace.record("read_source_lines", {"file": file, "start": start, "end": end}, "lignes source", sources=[cite])
        return json.dumps(res)

    def search_code(query: str) -> str:
        """Semantic search over the COBOL code: find programs/copybooks by concept (IBM Granite embeddings)."""
        res = gt.search_code(query)
        hits = res.get("results", [])
        trace.record("search_code", {"query": query}, f"{len(hits)} resultats", sources=[h["file"] for h in hits[:3]])
        return json.dumps(res)[:3000]

    def web_search(query: str) -> str:
        """Search the web for external context such as an insurance regulation or definition."""
        res = _web_search(query)
        trace.record("web_search", {"query": query}, f"{len(res)} resultats", sources=[r.get("url", "") for r in res[:3]])
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
            f"version {cs.id}: {len(imp['programs'])} programmes impactes",
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
        role="analyste COBOL/mainframe pour les equipes risque & conformite",
        instructions=INSTRUCTIONS,
        name="CobolExplorer",
    )
    return await agent.run(question)


def _compose(question: str, history: list[dict] | None) -> str:
    """Prefix the recent conversation so follow-ups ('sur quelle ligne ?', 'et ce
    programme ?') resolve their references. Only the LLM path sees this; the
    deterministic fallback keeps parsing the raw latest question."""
    if not history:
        return question
    lines = []
    for h in history[-4:]:
        if not isinstance(h, dict):
            continue
        who = "Utilisateur" if h.get("role") == "user" else "Assistant"
        # Coerce defensively: history comes from a loosely-typed API field (list[dict]),
        # so a non-string 'text' must not raise (it would look like an LLM outage).
        txt = str(h.get("text") or "").strip().replace("\n", " ")
        if txt:
            lines.append(f"{who}: {txt[:400]}")
    if not lines:
        return question
    ctx = "\n".join(lines)
    return (
        "Historique récent de la conversation (pour résoudre les références comme "
        "« ce programme » ou « cette ligne ») :\n" + ctx +
        "\n\nNouvelle question de l'utilisateur : " + question
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
        return f"Entité {p.get('node')} introuvable dans le graphe."
    out = [f"**{p['label']}** — "]
    tables = sorted(set(p.get("tables_read", []) + p.get("tables_written", [])))
    if p.get("copybooks"):
        out.append(f"copie {', '.join(p['copybooks'])}. ")
    if tables:
        out.append(f"Tables DB2 : {', '.join(tables)}. ")
    if p.get("screens"):
        out.append(f"Écrans CICS : {', '.join(p['screens'])}. ")
    if p.get("calls"):
        out.append(f"Appelle : {', '.join(p['calls'])}. ")
    if p.get("called_by"):
        out.append(f"Appelé par : {', '.join(p['called_by'])}. ")
    if p.get("transactions"):
        out.append(f"Transactions : {', '.join(p['transactions'])}. ")
    return "".join(out) or f"{p['label']} : aucune dépendance détectée."


def _deterministic_fallback(question: str, gt: GraphTools, trace: Trace, exc: Exception) -> dict:
    """When the LLM is down, still answer structural questions from the graph alone
    (no LLM): copybook/table -> impact ; program -> functional profile. Steps go through
    trace.record so the live trace still streams. Only pure semantic questions can't run."""
    import re

    from agent.responder import answer_copybook_impact

    note = f"\n\n_(réponse déterministe — agent LLM indisponible : {type(exc).__name__})_"
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
    return {"answer": f"[Agent LLM indisponible ({type(exc).__name__}). Nomme un programme, un copybook ou une table pour une analyse structurelle sans LLM.]", "trace": trace}
