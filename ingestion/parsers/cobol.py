"""COBOL parsing.

The graph is built by CONSTRUCT-SPECIFIC EXTRACTION from source: COPY (data vs
procedure, REPLACING), EXEC CICS LINK/XCTL, EXEC SQL (tables + INCLUDE),
SELECT/ASSIGN, EXEC CICS SEND/RECEIVE MAP, and paragraphs/PERFORM. These are
unambiguous COBOL/CICS constructs, not free-form parsing of the whole language.

cobol-rekt (ProLeap-based) is an OPTIONAL, OFF-GRAPH validator/enricher: it can
parse GenApp's CICS/DB2 COBOL and emit AST/CFG/data-structure JSON (see
fixtures/SHAPE.md), but it adds no nodes/edges, is not required to build the
graph, and only runs under ``--rekt`` (needs a JDK). ``run_cobol_rekt`` shells
out to the jar; ``CobolParser.parse`` does the extraction the graph relies on.
"""
from __future__ import annotations

import os
import re
import subprocess

from core.schema import Edge, EdgeKind, Node, NodeKind, nid
from parsers.base import Parser, ParsedUnit

_PROG_ID = re.compile(r"\bPROGRAM-ID\.\s+([A-Z0-9][A-Z0-9-]*)", re.I)
_COPY = re.compile(r"\bCOPY\s+([A-Z0-9][A-Z0-9-]*)", re.I)
_HAS_REPLACING = re.compile(r"\bREPLACING\b", re.I)
_PERFORM = re.compile(r"\bPERFORM\s+([A-Z0-9][A-Z0-9-]*)", re.I)
_SELECT = re.compile(
    r"\bSELECT\s+([A-Z0-9][A-Z0-9-]*)\s+ASSIGN\s+TO\s+(?:[A-Z0-9]+-)*([A-Z0-9]+)", re.I
)
_CICS_VERB = re.compile(r"\bEXEC\s+CICS\s+(LINK|XCTL)\b", re.I)
_CICS_PROG = re.compile(r"\bPROG(?:RAM)?\s*\(\s*'?([A-Z0-9][A-Z0-9-]*)'?", re.I)
_CICS_MAP_VERB = re.compile(r"\b(SEND|RECEIVE)\s+MAP\b", re.I)
_MAP_NAME = re.compile(r"\bMAP\s*\(\s*'?([A-Z0-9]+)'?", re.I)  # tolerate 'MAP (' with space
_CICS_FILE_READ = re.compile(r"\b(READNEXT|READPREV|STARTBR|READ)\s+FILE\s*\(\s*'?([A-Z0-9]+)'?", re.I)
_CICS_FILE_WRITE = re.compile(r"\b(REWRITE|WRITE|DELETE)\s+FILE\s*\(\s*'?([A-Z0-9]+)'?", re.I)
_PROG_TOKEN = re.compile(r"^LG[A-Z0-9]{3,}$", re.I)  # GenApp program naming
_SQL_FROM = re.compile(r"\b(?:FROM|JOIN)\s+([A-Z0-9_][A-Z0-9_.]*)", re.I)
_SQL_INSERT = re.compile(r"\bINSERT\s+INTO\s+([A-Z0-9_][A-Z0-9_.]*)", re.I)
_SQL_UPDATE = re.compile(r"\bUPDATE\s+([A-Z0-9_][A-Z0-9_.]*)", re.I)
_SQL_DELETE = re.compile(r"\bDELETE\s+FROM\s+([A-Z0-9_][A-Z0-9_.]*)", re.I)
_SQL_INCLUDE = re.compile(r"\bEXEC\s+SQL\s+INCLUDE\s+([A-Z0-9][A-Z0-9-]*)", re.I)
_SQL_SELECT = re.compile(r"\bSELECT\b", re.I)
_SQL_NOISE = {"OF", "WHERE", "SET", "VALUES", "INTO", "TABLE"}  # not table names
_SQL_SYS_INCLUDE = {"SQLCA", "SQLDA"}  # SQL system areas, not copybooks
_PERFORM_STOP = {"UNTIL", "VARYING", "TIMES", "THRU", "THROUGH", "WITH", "TEST"}
# COBOL scope terminators / verbs that must never be treated as paragraph labels
_PARA_BLOCK = {
    "EXIT", "END-EXEC", "GOBACK", "CONTINUE", "STOP", "END", "ELSE", "THEN",
    "END-IF", "END-EVALUATE", "END-PERFORM", "END-READ", "END-WRITE", "END-CALL",
    "END-SEARCH", "END-STRING", "END-UNSTRING", "END-ADD", "END-COMPUTE",
    "END-SUBTRACT", "END-MULTIPLY", "END-DIVIDE", "END-START", "END-DELETE",
    "END-REWRITE", "END-RETURN", "END-INVOKE", "END-ACCEPT", "END-DISPLAY",
}


def _code_lines(path: str) -> list[tuple[int, str]]:
    """Yield (1-based lineno, code text) skipping full-line comments.

    Fixed-format COBOL: column 7 (index 6) '*' or '/' marks a comment; code
    lives in cols 8-72. We tolerate free-ish format by only trimming col 73+.
    """
    out: list[tuple[int, str]] = []
    with open(path, errors="replace") as fh:
        for i, raw in enumerate(fh.readlines(), start=1):
            line = raw.rstrip("\n")
            if len(line) > 6 and line[6] in {"*", "/"}:
                continue
            code = line[:72] if len(line) > 72 else line
            out.append((i, code))
    return out


class CobolParser(Parser):
    def parse(self, path: str) -> ParsedUnit:
        lines = _code_lines(path)
        joined_upper = "\n".join(t for _, t in lines).upper()

        pid_match = _PROG_ID.search("\n".join(t for _, t in lines))
        prog = (pid_match.group(1) if pid_match else os.path.basename(path).split(".")[0]).upper()
        pgm_id = nid("pgm", prog)

        pu = ParsedUnit(program=prog, selects={})
        pu.nodes.append(Node(pgm_id, NodeKind.PGM, prog, {"file": os.path.basename(path)}))
        seen_nodes = {pgm_id}

        def add_node(node: Node) -> None:
            if node.id not in seen_nodes:
                seen_nodes.add(node.id)
                pu.nodes.append(node)

        proc_div_line = self._procedure_division_line(lines)

        # --- COPY (copybooks) ---
        for lineno, text in lines:
            for m in _COPY.finditer(text):
                cb = m.group(1).upper()
                copy_id = nid("copy", cb)
                add_node(Node(copy_id, NodeKind.COPYBOOK, cb))
                usage = "procedure" if proc_div_line and lineno >= proc_div_line else "data"
                pu.edges.append(
                    Edge(
                        pgm_id,
                        copy_id,
                        EdgeKind.PGM_COPIES,
                        {"line": lineno, "usage": usage, "replacing": bool(_HAS_REPLACING.search(text))},
                    )
                )

        # --- Paragraphs + PERFORM (procedure division) ---
        paragraphs = self._paragraphs(lines, proc_div_line)
        for para_name, lineno in paragraphs.items():
            pid = nid("para", f"{prog}.{para_name}")
            add_node(Node(pid, NodeKind.PARAGRAPH, para_name, {"program": prog}))
        for lineno, text in lines:
            if proc_div_line and lineno < proc_div_line:
                continue
            for m in _PERFORM.finditer(text):
                target = m.group(1).upper()
                if target in _PERFORM_STOP:
                    continue
                if target in paragraphs:
                    pu.edges.append(
                        Edge(
                            pgm_id,
                            nid("para", f"{prog}.{target}"),
                            EdgeKind.PGM_PERFORMS,
                            {"line": lineno},
                        )
                    )

        # --- EXEC CICS LINK/XCTL -> PGM_CALLS ; EXEC SQL -> tables ---
        for kind, start, body in self._exec_blocks(lines):
            if kind == "CICS":
                if _CICS_VERB.search(body):
                    mp = _CICS_PROG.search(body)
                    if mp:
                        token = mp.group(1).upper()
                        quoted = "'" in body[mp.start() : mp.end()]
                        if quoted or _PROG_TOKEN.match(token):
                            tid = nid("pgm", token)
                            add_node(Node(tid, NodeKind.PGM, token))
                            pu.edges.append(
                                Edge(pgm_id, tid, EdgeKind.PGM_CALLS, {"line": start, "via": "CICS-LINK", "literal": quoted})
                            )
                mv = _CICS_MAP_VERB.search(body)
                if mv:
                    mm = _MAP_NAME.search(body)
                    if mm:
                        mapname = mm.group(1).upper()
                        add_node(Node(nid("map", mapname), NodeKind.BMS_MAP, mapname))
                        pu.edges.append(
                            Edge(pgm_id, nid("map", mapname), EdgeKind.PGM_USES_MAP, {"line": start, "verb": mv.group(1).lower()})
                        )
                for m in _CICS_FILE_READ.finditer(body):
                    fname = m.group(2).upper()
                    add_node(Node(nid("file", fname), NodeKind.CICS_FILE, fname))
                    pu.edges.append(Edge(pgm_id, nid("file", fname), EdgeKind.PGM_READS_FILE, {"line": start, "op": m.group(1).upper()}))
                for m in _CICS_FILE_WRITE.finditer(body):
                    fname = m.group(2).upper()
                    add_node(Node(nid("file", fname), NodeKind.CICS_FILE, fname))
                    pu.edges.append(Edge(pgm_id, nid("file", fname), EdgeKind.PGM_WRITES_FILE, {"line": start, "op": m.group(1).upper()}))
            elif kind == "SQL":
                self._sql_tables(body, start, pgm_id, pu, add_node)

        # --- SELECT / ASSIGN (file lineage inputs) ---
        for _, text in lines:
            for m in _SELECT.finditer(text):
                logical, ddname = m.group(1).upper(), m.group(2).upper()
                pu.selects[logical] = ddname

        return pu

    # --- helpers ---

    @staticmethod
    def _procedure_division_line(lines: list[tuple[int, str]]) -> int | None:
        for lineno, text in lines:
            if re.search(r"\bPROCEDURE\s+DIVISION\b", text, re.I):
                return lineno
        return None

    @staticmethod
    def _paragraphs(lines: list[tuple[int, str]], proc_div_line: int | None) -> dict[str, int]:
        paras: dict[str, int] = {}
        if not proc_div_line:
            return paras
        for lineno, text in lines:
            if lineno <= proc_div_line:
                continue
            # Paragraph labels sit in Area A (cols 8-11 -> indent 7-11) as a
            # lone name ending with a period. Area B statements are deeper.
            indent = len(text) - len(text.lstrip())
            if not (7 <= indent <= 11):
                continue
            m = re.match(r"^([A-Z0-9][A-Z0-9-]*)\.$", text.strip())
            if m:
                name = m.group(1).upper()
                if name in _PARA_BLOCK or name.isdigit() or len(name) < 2:
                    continue
                paras.setdefault(name, lineno)
        return paras

    @staticmethod
    def _exec_blocks(lines: list[tuple[int, str]]):
        """Yield (kind, start_lineno, body_text) for EXEC CICS/SQL .. END-EXEC."""
        buf: list[str] = []
        start = None
        kind = None
        for lineno, text in lines:
            up = text.upper()
            if start is None:
                m = re.search(r"\bEXEC\s+(CICS|SQL)\b", up)
                if m:
                    kind = m.group(1)
                    start = lineno
                    buf = [text]
                    if "END-EXEC" in up:
                        yield kind, start, " ".join(buf)
                        start = None
                        buf = []
            else:
                buf.append(text)
                if "END-EXEC" in up:
                    yield kind, start, " ".join(buf)
                    start = None
                    buf = []
        if start is not None:
            yield kind, start, " ".join(buf)

    @staticmethod
    def _sql_tables(body: str, start: int, pgm_id: str, pu: ParsedUnit, add_node) -> None:
        bu = body.upper()
        # EXEC SQL INCLUDE <copybook> -> a data copybook dependency
        for m in _SQL_INCLUDE.finditer(bu):
            cb = m.group(1).upper()
            if cb in _SQL_SYS_INCLUDE:
                continue
            add_node(Node(nid("copy", cb), NodeKind.COPYBOOK, cb))
            pu.edges.append(
                Edge(pgm_id, nid("copy", cb), EdgeKind.PGM_COPIES, {"line": start, "usage": "data", "via": "EXEC SQL INCLUDE", "replacing": False})
            )
        # tables: FROM/JOIN count as reads ONLY inside a SELECT (not DELETE FROM);
        # INSERT INTO / UPDATE (not 'FOR UPDATE OF') / DELETE FROM count as writes
        reads: set[str] = set()
        writes: set[str] = set()
        if _SQL_SELECT.search(bu):
            for m in _SQL_FROM.finditer(bu):
                t = m.group(1).strip(".")
                if t not in _SQL_NOISE:
                    reads.add(t)
        for m in _SQL_INSERT.finditer(bu):
            writes.add(m.group(1).strip("."))
        for m in _SQL_UPDATE.finditer(bu):
            t = m.group(1).strip(".")
            if t not in _SQL_NOISE:
                writes.add(t)
        for m in _SQL_DELETE.finditer(bu):
            writes.add(m.group(1).strip("."))
        for t in sorted(reads):
            add_node(Node(nid("table", t), NodeKind.DB2_TABLE, t))
            pu.edges.append(Edge(pgm_id, nid("table", t), EdgeKind.PGM_SQL_READS, {"line": start}))
        for t in sorted(writes):
            add_node(Node(nid("table", t), NodeKind.DB2_TABLE, t))
            pu.edges.append(Edge(pgm_id, nid("table", t), EdgeKind.PGM_SQL_WRITES, {"line": start}))


def run_cobol_rekt(program_file: str, src_dir: str, copy_dir: str, out_dir: str) -> dict[str, str]:
    """Run cobol-rekt on one program; return produced JSON report paths.

    Best-effort enrichment/validation (used by the CLI, not unit tests). The
    jar path and JAVA_HOME are read from env with sensible defaults.
    """
    jar = os.environ.get(
        "COBOL_REKT_JAR",
        os.path.join(
            os.path.dirname(__file__),
            "..",
            "vendor",
            "cobol-rekt",
            "smojol-cli",
            "target",
            "smojol-cli.jar",
        ),
    )
    java = os.path.join(
        os.environ.get("JAVA_HOME", "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"),
        "bin",
        "java",
    )
    name = os.path.basename(program_file)  # STRICT search wants exact filename
    cmd = [
        java, "-jar", jar, "run", name,
        "--commands", "BUILD_BASE_ANALYSIS WRITE_CFG WRITE_DATA_STRUCTURES",
        "--srcDir", src_dir, "--copyBooksDir", copy_dir,
        "--dialect", "COBOL", "--reportDir", out_dir,
    ]
    subprocess.run(cmd, capture_output=True, text=True, check=False)
    report = os.path.join(out_dir, f"{name}.report")
    found: dict[str, str] = {}
    for sub, key in (("data_structures", "data"), ("cfg", "cfg"), ("ast", "ast")):
        d = os.path.join(report, sub)
        if os.path.isdir(d):
            js = [f for f in os.listdir(d) if f.endswith(".json")]
            if js:
                found[key] = os.path.join(d, js[0])
    return found
