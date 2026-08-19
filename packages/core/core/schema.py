"""Typed graph schema for the COBOL Explorer (Python source of truth).

Node IDs are prefixed by a short kind tag, e.g. ``pgm:LGIPOL01``,
``copy:LGPOLICY``, ``job:DAILYPOL``. The same convention keys the graph,
the API and the RAG layer. Mirror this in ``packages/core/schema.ts`` for
the frontend.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


class NodeKind:
    """Kinds of nodes in the mainframe-native dependency graph."""

    DOMAIN = "DOMAIN"
    SCHED_JOB = "SCHED_JOB"
    JOB = "JOB"
    STEP = "STEP"
    PROC = "PROC"
    PGM = "PGM"
    PARAGRAPH = "PARAGRAPH"
    COPYBOOK = "COPYBOOK"
    DATASET = "DATASET"
    DB2_TABLE = "DB2_TABLE"
    CICS_PROG = "CICS_PROG"  # reserved: CICS programs currently classified as PGM (not emitted)
    CICS_TXN = "CICS_TXN"
    BMS_MAP = "BMS_MAP"
    CICS_FILE = "CICS_FILE"  # VSAM file accessed via CICS (FCT entry)


class EdgeKind:
    """Kinds of edges. Each edge instance also carries ``evidence``."""

    DOMAIN_GROUPS = "DOMAIN_GROUPS"
    SCHED_TRIGGERS = "SCHED_TRIGGERS"
    SCHED_RUNS = "SCHED_RUNS"
    JOB_CONTAINS = "JOB_CONTAINS"
    STEP_EXECUTES = "STEP_EXECUTES"
    PROC_CONTAINS = "PROC_CONTAINS"  # reserved: emitted once JCL PROC members are resolved
    STEP_USES_DD = "STEP_USES_DD"
    PGM_PERFORMS = "PGM_PERFORMS"
    PGM_CALLS = "PGM_CALLS"
    PGM_COPIES = "PGM_COPIES"
    PGM_READS = "PGM_READS"
    PGM_WRITES = "PGM_WRITES"
    PGM_SQL_READS = "PGM_SQL_READS"
    PGM_SQL_WRITES = "PGM_SQL_WRITES"
    TXN_INVOKES = "TXN_INVOKES"
    PGM_USES_MAP = "PGM_USES_MAP"  # screen I/O (evidence.verb = send|receive)
    PGM_READS_FILE = "PGM_READS_FILE"  # EXEC CICS READ/STARTBR FILE
    PGM_WRITES_FILE = "PGM_WRITES_FILE"  # EXEC CICS WRITE/REWRITE/DELETE FILE


# Canonical prefix -> NodeKind, so ids are self-describing.
PREFIX_TO_KIND: dict[str, str] = {
    "domain": NodeKind.DOMAIN,
    "sched": NodeKind.SCHED_JOB,
    "job": NodeKind.JOB,
    "step": NodeKind.STEP,
    "proc": NodeKind.PROC,
    "pgm": NodeKind.PGM,
    "para": NodeKind.PARAGRAPH,
    "copy": NodeKind.COPYBOOK,
    "ds": NodeKind.DATASET,
    "table": NodeKind.DB2_TABLE,
    "cics": NodeKind.CICS_PROG,
    "txn": NodeKind.CICS_TXN,
    "map": NodeKind.BMS_MAP,
    "file": NodeKind.CICS_FILE,
}


def nid(prefix: str, name: str) -> str:
    """Build a prefixed node id, e.g. ``nid('pgm', 'LGIPOL01')``."""
    return f"{prefix}:{name}"


def split_id(node_id: str) -> tuple[str, str]:
    """Split a node id into ``(prefix, name)`` on the first colon."""
    prefix, _, name = node_id.partition(":")
    return prefix, name


@dataclass
class Node:
    id: str
    kind: str
    label: str
    attrs: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class Edge:
    src: str
    dst: str
    kind: str
    evidence: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
