"""Graph queries powering the agent's ``graph_lookup`` tool.

These are the *structural* answers a vector search cannot give:
- ``impact``  : change a copybook / table -> which programs, jobs, batch chains break
- ``lineage`` : who reads / writes a dataset
- ``callers`` / ``callees`` / ``neighbors`` : call graph navigation

All traversals are deterministic — the graph comes from parsing, not an LLM.
"""
from __future__ import annotations

import networkx as nx

from core.schema import EdgeKind, NodeKind, split_id


def _in_of(g: nx.MultiDiGraph, node: str, kind: str) -> list[str]:
    if node not in g:
        return []
    return [u for u, v, k, d in g.in_edges(node, keys=True, data=True) if d.get("kind") == kind]


def _out_of(g: nx.MultiDiGraph, node: str, kind: str) -> list[str]:
    if node not in g:
        return []
    return [v for u, v, k, d in g.out_edges(node, keys=True, data=True) if d.get("kind") == kind]


def callers(g: nx.MultiDiGraph, pgm_id: str) -> list[str]:
    return sorted(set(_in_of(g, pgm_id, EdgeKind.PGM_CALLS)))


def callees(g: nx.MultiDiGraph, pgm_id: str) -> list[str]:
    return sorted(set(_out_of(g, pgm_id, EdgeKind.PGM_CALLS)))


def neighbors(g: nx.MultiDiGraph, node_id: str) -> dict:
    if node_id not in g:
        return {"in": [], "out": []}
    ins = [
        {"src": u, "kind": d.get("kind"), "evidence": d.get("evidence", {})}
        for u, v, k, d in g.in_edges(node_id, keys=True, data=True)
    ]
    outs = [
        {"dst": v, "kind": d.get("kind"), "evidence": d.get("evidence", {})}
        for u, v, k, d in g.out_edges(node_id, keys=True, data=True)
    ]
    return {"in": ins, "out": outs}


def _jobs_running(g: nx.MultiDiGraph, pgm_id: str) -> set[str]:
    jobs: set[str] = set()
    for step in _in_of(g, pgm_id, EdgeKind.STEP_EXECUTES):
        jobs.update(_in_of(g, step, EdgeKind.JOB_CONTAINS))
    return jobs


def _chains_for(g: nx.MultiDiGraph, jobs: set[str]) -> set[str]:
    chains: set[str] = set()
    for job in jobs:
        chains.update(_in_of(g, job, EdgeKind.SCHED_RUNS))
    return chains


def impact(g: nx.MultiDiGraph, node_id: str) -> dict:
    """Reverse-traverse to find everything affected by a change to ``node_id``.

    - copybook -> programs that COPY it
    - db2 table -> programs with EXEC SQL on it
    - program  -> programs that CALL it
    Then roll up: programs -> jobs that run them -> scheduler chains.
    """
    prefix, _ = split_id(node_id)
    if prefix == "copy":
        programs = set(_in_of(g, node_id, EdgeKind.PGM_COPIES))
    elif prefix == "table":
        programs = set(_in_of(g, node_id, EdgeKind.PGM_SQL_READS)) | set(
            _in_of(g, node_id, EdgeKind.PGM_SQL_WRITES)
        )
    elif prefix == "pgm":
        programs = set(callers(g, node_id))
    else:
        programs = set()

    jobs: set[str] = set()
    for p in programs:
        jobs |= _jobs_running(g, p)
    chains = _chains_for(g, jobs)

    return {
        "node": node_id,
        "programs": sorted(programs),
        "jobs": sorted(jobs),
        "chains": sorted(chains),
    }


def summary(g: nx.MultiDiGraph, pgm_id: str) -> dict:
    """Functional profile of a program: what it uses, touches and who drives it.

    Answers "what does program X do?" structurally — copybooks, DB2 tables read/
    written, VSAM files, CICS screens, sub-programs called, callers and the
    transactions that enter it. The agent pairs this with the source header to
    describe the business function.
    """
    if pgm_id not in g:
        return {"node": pgm_id, "found": False}

    def _labels(ids: list[str]) -> list[str]:
        return sorted({str(g.nodes[i].get("label", i)) if i in g else i for i in ids})

    return {
        "node": pgm_id,
        "label": g.nodes[pgm_id].get("label"),
        "kind": g.nodes[pgm_id].get("kind"),
        "found": True,
        "copybooks": _labels(_out_of(g, pgm_id, EdgeKind.PGM_COPIES)),
        "tables_read": _labels(_out_of(g, pgm_id, EdgeKind.PGM_SQL_READS)),
        "tables_written": _labels(_out_of(g, pgm_id, EdgeKind.PGM_SQL_WRITES)),
        "files_read": _labels(_out_of(g, pgm_id, EdgeKind.PGM_READS_FILE)),
        "files_written": _labels(_out_of(g, pgm_id, EdgeKind.PGM_WRITES_FILE)),
        "datasets_read": _labels(_out_of(g, pgm_id, EdgeKind.PGM_READS)),
        "datasets_written": _labels(_out_of(g, pgm_id, EdgeKind.PGM_WRITES)),
        "screens": _labels(_out_of(g, pgm_id, EdgeKind.PGM_USES_MAP)),
        "calls": _labels(_out_of(g, pgm_id, EdgeKind.PGM_CALLS)),
        "called_by": _labels(_in_of(g, pgm_id, EdgeKind.PGM_CALLS)),
        "transactions": _labels(_in_of(g, pgm_id, EdgeKind.TXN_INVOKES)),
    }


def lineage(g: nx.MultiDiGraph, ds_id: str) -> dict:
    return {
        "dataset": ds_id,
        "written_by": sorted(set(_in_of(g, ds_id, EdgeKind.PGM_WRITES))),
        "read_by": sorted(set(_in_of(g, ds_id, EdgeKind.PGM_READS))),
    }


def orphans(g: nx.MultiDiGraph) -> list[dict]:
    """Programs we have source for that nothing runs — no CALL, no CICS transaction,
    no batch STEP points at them. Candidate dead code / lost entry points."""
    out = []
    for n, d in g.nodes(data=True):
        if d.get("kind") != NodeKind.PGM:
            continue
        attrs = d.get("attrs", {}) or {}
        if not (attrs.get("path") or attrs.get("file")):
            continue  # external/no-source stubs are not "our" dead code
        inbound = (
            _in_of(g, n, EdgeKind.PGM_CALLS)
            + _in_of(g, n, EdgeKind.TXN_INVOKES)
            + _in_of(g, n, EdgeKind.STEP_EXECUTES)
        )
        if not inbound:
            out.append({"id": n, "label": d.get("label")})
    return sorted(out, key=lambda x: x["label"])
