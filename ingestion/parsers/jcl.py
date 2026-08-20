"""Minimal but robust JCL parser: JOB / STEP / PROC / DD relationships.

JCL is a line-oriented, regular grammar, so this is appropriate parsing (not
a fragile hack). We join continuation cards and skip in-stream data blocks
(``DD *`` ... ``/*``). Output is normalised straight into the shared schema.
"""
from __future__ import annotations

import re

from core.schema import Edge, EdgeKind, Node, NodeKind, nid
from parsers.base import Parser, ParsedUnit

_NAME = r"[A-Z0-9#@$]+"
_JOB = re.compile(rf"^//({_NAME})\s+JOB\b", re.I)
_EXEC = re.compile(rf"^//({_NAME})\s+EXEC\s+(.*)$", re.I)
_DD = re.compile(rf"^//({_NAME})\s+DD\s+(.*)$", re.I)
_PGM = re.compile(rf"\bPGM=({_NAME})", re.I)
_PROC_KW = re.compile(rf"\bPROC=({_NAME})", re.I)
_PROC_BARE = re.compile(rf"^\s*({_NAME})", re.I)
_DSN = re.compile(r"\bDSN=([A-Z0-9#@$.\-]+(?:\([+-]?\d+\))?)", re.I)
_DISP = re.compile(r"\bDISP=\(?\s*([A-Z]+)", re.I)
_DD_DATA = re.compile(r"\bDD\s+(\*|DATA)\b", re.I)


def _dataset_base(dsn: str) -> tuple[str, str | None]:
    """Strip a GDG relative generation: ``FOO.BAR(+1)`` -> ``('FOO.BAR', '+1')``."""
    m = re.match(r"^(?P<base>[^(]+)\((?P<gen>[+-]?\d+)\)$", dsn)
    if m:
        return m.group("base"), m.group("gen")
    return dsn, None


def _disp_mode(params: str) -> str:
    m = _DISP.search(params)
    disp = m.group(1).upper() if m else "SHR"
    return "write" if disp in {"NEW", "MOD"} else "read"


def _cards(lines: list[str]):
    """Yield logical JCL cards, joining continuations, skipping in-stream data."""
    buf: str | None = None
    in_data = False
    for raw in lines:
        line = raw.rstrip("\n").rstrip()
        if in_data:
            if line.startswith("//") or line.strip() == "/*":
                in_data = False
                if line.strip() == "/*":
                    continue
            else:
                continue
        if not line.startswith("//") or line.startswith("//*"):
            continue
        # Continuation card: '//' + spaces + params (no name/verb).
        if buf is not None and re.match(r"^//\s+\S", line):
            buf = buf.rstrip().rstrip(",") + "," + line[2:].strip().lstrip(",")
            if not buf.rstrip().endswith(","):
                yield buf
                in_data = bool(_DD_DATA.search(buf))
                buf = None
            continue
        if buf is not None:
            # The card we just closed can't open in-stream data: the line we are
            # holding starts with '//', so the data (if any) begins after it.
            yield buf
            buf = None
        if line.rstrip().endswith(","):
            buf = line
        else:
            yield line
            in_data = bool(_DD_DATA.search(line))
    if buf is not None:
        yield buf


class JclParser(Parser):
    def parse(self, path: str) -> ParsedUnit:
        with open(path, "r", errors="replace") as fh:
            lines = fh.readlines()

        pu = ParsedUnit()
        seen: set[str] = set()
        job: str | None = None
        step: str | None = None

        def add_node(node: Node) -> None:
            if node.id not in seen:
                seen.add(node.id)
                pu.nodes.append(node)

        for card in _cards(lines):
            m = _JOB.match(card)
            if m:
                job = m.group(1).upper()
                add_node(Node(nid("job", job), NodeKind.JOB, job))
                step = None
                continue

            m = _EXEC.match(card)
            if m and job:
                step = m.group(1).upper()
                rest = m.group(2)
                step_id = nid("step", f"{job}.{step}")
                add_node(Node(step_id, NodeKind.STEP, step))
                pu.edges.append(Edge(nid("job", job), step_id, EdgeKind.JOB_CONTAINS, {}))

                mpgm = _PGM.search(rest)
                if mpgm:
                    name = mpgm.group(1).upper()
                    add_node(Node(nid("pgm", name), NodeKind.PGM, name))
                    pu.edges.append(
                        Edge(step_id, nid("pgm", name), EdgeKind.STEP_EXECUTES, {"kind": "PGM"})
                    )
                else:
                    mproc = _PROC_KW.search(rest) or _PROC_BARE.match(rest)
                    if mproc:
                        name = mproc.group(1).upper()
                        add_node(Node(nid("proc", name), NodeKind.PROC, name))
                        pu.edges.append(
                            Edge(step_id, nid("proc", name), EdgeKind.STEP_EXECUTES, {"kind": "PROC"})
                        )
                continue

            m = _DD.match(card)
            if m and job and step:
                ddname = m.group(1).upper()
                params = m.group(2)
                mdsn = _DSN.search(params)
                if mdsn:
                    base, gen = _dataset_base(mdsn.group(1).upper())
                    ds_id = nid("ds", base)
                    add_node(Node(ds_id, NodeKind.DATASET, base, {"gdg": gen is not None}))
                    step_id = nid("step", f"{job}.{step}")
                    pu.edges.append(
                        Edge(
                            step_id,
                            ds_id,
                            EdgeKind.STEP_USES_DD,
                            {"ddname": ddname, "disp": _disp_mode(params), "gen": gen},
                        )
                    )
        return pu
