"""Agent tools over the mainframe graph + source.

These are the deterministic, grounded capabilities the LLM agent calls:
- ``graph_lookup`` : impact / lineage / callers / callees / neighbors
- ``read_source_lines`` : exact source lines for citation

``search_code`` : semantic search over the IBM Granite vector index (index.json,
built by ``build_index``); returns a "no index" note if it hasn't been built.
"""
from __future__ import annotations

import glob
import json
import os

from core.schema import EdgeKind, split_id
from graph import queries
from graph.build import from_json

_PREFIXES = ("copy", "pgm", "table", "job", "ds", "sched", "domain", "step", "proc", "para")


class GraphTools:
    def __init__(self, graph_path: str = "graph.json", corpus_root: str = "corpora", index_path: str = "index.json", vector_backend: str | None = None):
        with open(graph_path) as fh:
            self.g = from_json(json.load(fh))
        self.graph_path = graph_path
        self.corpus_root = corpus_root
        self.index_path = index_path
        # Per-instance vector backend so a second system (e.g. CardDemo) can use its
        # own JSON index instead of the pgvector table (which holds only the primary
        # system's embeddings). Falls back to the global env default.
        self.vector_backend = vector_backend
        self._file_cache: dict[str, str | None] = {}
        self._index = None
        self._gb = self._make_graph_backend()

    def _make_graph_backend(self):
        # Graph-RAG backend: 'neo4j' (self-hosted graph DB, scale path) or 'networkx'
        # (in-process, default). Falls back to NetworkX if Neo4j is unreachable.
        if os.environ.get("COBOL_EXPLORER_GRAPH_BACKEND", "networkx").lower() == "neo4j":
            try:
                from agent.neo4j_store import Neo4jGraph

                gb = Neo4jGraph()
                if gb.ready():
                    return gb
            except Exception:
                pass
        from graph.backend import NetworkxBackend

        return NetworkxBackend(self.g)

    # --- node resolution -------------------------------------------------
    def resolve(self, node: str) -> str:
        if ":" in node and node in self.g:
            return node
        up = node.upper()
        for pfx in _PREFIXES:
            cand = f"{pfx}:{up}"
            if cand in self.g:
                return cand
        for n, d in self.g.nodes(data=True):
            if str(d.get("label", "")).upper() == up:
                return n
        return node

    # --- graph_lookup (routes through the selected backend) --------------
    def graph_lookup(self, op: str, node: str) -> dict:
        nid_ = self.resolve(node)
        try:
            return self._lookup(op, nid_, self._gb)
        except Exception:
            # Backend (e.g. Neo4j) failed mid-session -> degrade to in-process NetworkX,
            # mirroring search_code's "degrade, don't crash" contract.
            from graph.backend import NetworkxBackend

            if not isinstance(self._gb, NetworkxBackend):
                self._gb = NetworkxBackend(self.g)
                return self._lookup(op, nid_, self._gb)
            raise

    def _lookup(self, op: str, nid_: str, gb) -> dict:
        if op == "impact":
            r = gb.impact(nid_)
            r["programs"] = [gb.copy_evidence(nid_, p) for p in r["programs"]]
            return r
        if op == "lineage":
            return gb.lineage(nid_)
        if op == "callers":
            # A copybook or DB2 table has no CALL callers — the intent of "who calls
            # / uses this" is the impact set (programs that COPY it, or SQL on it).
            prefix, _ = split_id(nid_)
            if prefix in ("copy", "table"):
                callers_ = gb.impact(nid_)["programs"]
            else:
                callers_ = gb.callers(nid_)
            return {"node": nid_, "callers": callers_}
        if op == "callees":
            return {"node": nid_, "callees": gb.callees(nid_)}
        if op == "neighbors":
            return gb.neighbors(nid_)
        if op in ("summary", "profile"):
            r = gb.summary(nid_)
            # Attach the program header so the agent can describe its business purpose.
            attrs = self.g.nodes[nid_].get("attrs", {}) if nid_ in self.g else {}
            path = attrs.get("path") or attrs.get("file")
            if path:
                head = self.read_source_lines(os.path.basename(str(path)), 1, 40)
                if "text" in head:
                    r["source_head"] = head["text"]
                    r["source_file"] = head["file"]
            return r
        raise ValueError(f"unknown graph_lookup op: {op}")

    def _copy_evidence(self, copy_id: str, pgm_id: str) -> dict:
        line = None
        for _u, v, _k, d in self.g.out_edges(pgm_id, keys=True, data=True):
            if v == copy_id and d.get("kind") == EdgeKind.PGM_COPIES:
                line = d.get("evidence", {}).get("line")
                break
        attrs = self.g.nodes[pgm_id].get("attrs", {}) if pgm_id in self.g else {}
        return {
            "id": pgm_id,
            "label": self.g.nodes[pgm_id].get("label") if pgm_id in self.g else pgm_id,
            "copy_line": line,
            "file": attrs.get("file"),
        }

    # --- dead code / orphans --------------------------------------------
    def dead_code(self) -> dict:
        """Quality signal: orphan programs (nothing runs them) + copybook files
        present in the corpus but never COPY'd by any program."""
        orphans = queries.orphans(self.g)
        used = {
            str(d.get("label", "")).upper()
            for _n, d in self.g.nodes(data=True)
            if d.get("kind") == "COPYBOOK"
        }
        unused: set[str] = set()
        for pat in ("*.cpy", "*.CPY"):
            for p in glob.glob(os.path.join(self.corpus_root, "**", pat), recursive=True):
                name = os.path.splitext(os.path.basename(p))[0].upper()
                if name not in used:
                    unused.add(os.path.basename(p))
        return {"orphan_programs": orphans, "unused_copybooks": sorted(unused)}

    # --- field-level copybook impact ------------------------------------
    def copybook_fields(self, node: str) -> dict:
        """Parse a copybook's data items and, for each field, which COPY'ing
        programs reference it — field-level change impact."""
        import re

        from safe import safe_corpus_path

        nid_ = self.resolve(node)
        node_d = self.g.nodes.get(nid_, {}) if nid_ in self.g else {}
        label = node_d.get("label", node)

        def _resolve(rel):
            return safe_corpus_path(self.corpus_root, rel) or self.find_file(os.path.basename(str(rel))) if rel else None

        fields: list[dict] = []
        cb_path = (node_d.get("attrs") or {}).get("path")
        full = _resolve(cb_path)
        if full and os.path.exists(full):
            fre = re.compile(r"^\s*(\d{2})\s+([A-Z0-9][A-Z0-9-]*)", re.I)
            with open(full, errors="replace") as fh:
                for line in fh:
                    if line.lstrip().startswith("*"):
                        continue
                    m = fre.match(line)
                    if not m:
                        continue
                    lvl, name = int(m.group(1)), m.group(2).upper()
                    if lvl == 88 or name == "FILLER":
                        continue
                    fields.append({"level": lvl, "name": name})

        # Programs that COPY this copybook, and their source (loaded once).
        users: list[dict] = []
        for p in queries._in_of(self.g, nid_, EdgeKind.PGM_COPIES):
            d = self.g.nodes.get(p, {})
            users.append({"label": d.get("label"), "path": (d.get("attrs") or {}).get("path")})
        srcs: dict[str, str] = {}
        for u in users:
            fp = _resolve(u["path"])
            if fp and os.path.exists(fp):
                with open(fp, errors="replace") as fh:
                    srcs[u["label"]] = fh.read().upper()

        for f in fields:
            pat = re.compile(r"(?<![A-Z0-9-])" + re.escape(f["name"]) + r"(?![A-Z0-9-])")
            f["used_by"] = sorted(lbl for lbl, txt in srcs.items() if pat.search(txt))
        return {"copybook": label, "node": nid_, "fields": fields, "programs": [u["label"] for u in users]}

    # --- read_source_lines ----------------------------------------------
    def find_file(self, basename: str) -> str | None:
        if basename in self._file_cache:
            return self._file_cache[basename]
        hits = glob.glob(os.path.join(self.corpus_root, "**", basename), recursive=True)
        path = hits[0] if hits else None
        self._file_cache[basename] = path
        return path

    def read_source_lines(self, file: str, start: int, end: int) -> dict:
        from safe import safe_corpus_path

        path = safe_corpus_path(self.corpus_root, file)
        if not (path and os.path.exists(path)):
            # basename lookup stays inside the corpus (find_file globs corpus_root)
            path = self.find_file(os.path.basename(file))
        if not path:
            return {"file": file, "error": "not found"}
        with open(path, errors="replace") as fh:
            lines = fh.readlines()
        start = max(1, int(start))
        end = min(len(lines), int(end))
        text = "".join(lines[start - 1 : end]).rstrip("\n")
        return {"file": os.path.basename(path), "start": start, "end": end, "text": text}

    # --- search_code (semantic, IBM Granite embeddings) -----------------
    def _vector_index(self):
        if self._index is None:
            # Backend selectable: 'pgvector' (PostgreSQL, scale path) or 'json' (in-process cosine, POC).
            # A per-instance backend (self.vector_backend) overrides the global env default.
            backend = (self.vector_backend or os.environ.get("COBOL_EXPLORER_VECTOR", "json")).lower()
            if backend == "pgvector":
                from agent.pgvector_index import PgVectorIndex

                self._index = PgVectorIndex()
            else:
                from agent.search import VectorIndex

                self._index = VectorIndex(self.index_path)
        return self._index

    def search_code(self, query: str, domain: str | None = None) -> dict:
        idx = self._vector_index()
        engine = getattr(idx, "model", "") or "IBM Granite embeddings"
        try:
            if not idx.ready():
                return {"query": query, "results": [], "note": "index vectoriel absent (lancer: make index)"}
            results = idx.search(query, k=5)
        except Exception as exc:  # DB / embeddings engine down -> degrade, don't crash the agent
            return {"query": query, "results": [], "note": f"moteur de recherche indisponible ({type(exc).__name__})"}
        return {"query": query, "results": results, "engine": f"IBM Granite embeddings · {engine}"}
