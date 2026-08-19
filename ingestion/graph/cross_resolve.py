"""Batch data-lineage: join COBOL SELECT/ASSIGN to JCL DD to physical DSN.

This is the edge a plain code RAG cannot produce: it links a program to the
physical datasets it reads/writes, by matching the program's logical file
names (``SELECT ... ASSIGN TO ddname``) against the ``DD`` cards of the step
that executes it.
"""
from __future__ import annotations

from collections.abc import Iterable

from core.schema import Edge, EdgeKind, split_id


def resolve_file_lineage(
    edges: Iterable[Edge],
    selects_by_pgm: dict[str, dict[str, str]],
) -> list[Edge]:
    """Return PGM_READS / PGM_WRITES edges.

    Args:
        edges: assembled edges, must include STEP_EXECUTES (step->pgm) and
            STEP_USES_DD (step->ds, evidence ddname/disp).
        selects_by_pgm: ``{pgm_id: {logical_file: ddname}}`` from COBOL parsing.
    """
    edges = list(edges)
    step_to_pgm: dict[str, str] = {}
    for e in edges:
        if e.kind == EdgeKind.STEP_EXECUTES and split_id(e.dst)[0] == "pgm":
            step_to_pgm[e.src] = e.dst

    out: list[Edge] = []
    for e in edges:
        if e.kind != EdgeKind.STEP_USES_DD:
            continue
        pgm = step_to_pgm.get(e.src)
        if not pgm:
            continue
        ddname = e.evidence.get("ddname")
        disp = e.evidence.get("disp", "read")
        for logical, dd in selects_by_pgm.get(pgm, {}).items():
            if dd == ddname:
                kind = EdgeKind.PGM_WRITES if disp == "write" else EdgeKind.PGM_READS
                out.append(
                    Edge(
                        pgm,
                        e.dst,
                        kind,
                        {"ddname": ddname, "via_step": e.src, "logical_file": logical, "disp": disp},
                    )
                )
    return out
