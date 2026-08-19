"""CSD parser: CICS transaction -> program, from DFHCSDUP ``Define`` statements.

In GenApp these live inside the SYSIN of the ``cdef*.jcl`` jobs (which the JCL
parser deliberately skips as in-stream data), so we scan the raw file. Each
``Define Transaction(T) ... Program(P)`` gives a transaction entry point.
"""
from __future__ import annotations

import re

from core.schema import Edge, EdgeKind, Node, NodeKind, nid
from parsers.base import Parser, ParsedUnit

_DEF_TXN = re.compile(r"\bDefine\s+Transaction\(([A-Z0-9#@$]+)\)", re.I)
_PROG = re.compile(r"\bProgram\(([A-Z0-9#@$]+)\)", re.I)
_GROUP = re.compile(r"\bGroup\(([A-Z0-9#@$]+)\)", re.I)
_NEXT_DEF = re.compile(r"\bDefine\b", re.I)


class CsdParser(Parser):
    def parse(self, path: str) -> ParsedUnit:
        with open(path, errors="replace") as fh:
            text = fh.read()
        pu = ParsedUnit()
        seen: set[str] = set()
        for m in _DEF_TXN.finditer(text):
            txn = m.group(1).upper()
            after = text[m.end():]
            nxt = _NEXT_DEF.search(after)
            window = after[: nxt.start()] if nxt else after[:200]
            pm = _PROG.search(window)
            if not pm:
                continue
            prog = pm.group(1).upper()
            gm = _GROUP.search(m.group(0) + window)
            tid = nid("txn", txn)
            if tid not in seen:
                seen.add(tid)
                pu.nodes.append(Node(tid, NodeKind.CICS_TXN, txn, {"group": gm.group(1) if gm else None}))
            pu.edges.append(Edge(tid, nid("pgm", prog), EdgeKind.TXN_INVOKES, {}))
        return pu
