"""Self-hosted graph-RAG backend: Neo4j (Cypher), the scale path for the graph.

Same interface as ``graph.backend.NetworkxBackend`` (impact / lineage / callers /
callees / neighbors / summary / copy_evidence), reimplemented in Cypher, so the
agent's ``graph_lookup`` is identical whether it runs on NetworkX or Neo4j.
Selected with ``COBOL_EXPLORER_GRAPH_BACKEND=neo4j``. Nodes are ``(:Entity {id})``;
edges are ``[:REL {kind, line}]`` (generic type + kind property — no APOC needed).
"""
from __future__ import annotations

import json
import os

from core.schema import split_id

DEFAULT_URI = "bolt://127.0.0.1:7687"

# One driver per (uri,user) shared across all Neo4jGraph instances — the Neo4j driver
# is thread-safe and pools connections. GraphTools is recreated per API request, so a
# per-instance driver would leak a connection pool on every call.
_DRIVERS: dict = {}


class Neo4jGraph:
    def __init__(self, uri: str | None = None, user: str | None = None, password: str | None = None):
        self.uri = uri or os.environ.get("COBOL_EXPLORER_NEO4J_URI", DEFAULT_URI)
        self.user = user or os.environ.get("COBOL_EXPLORER_NEO4J_USER", "neo4j")
        self.password = password or os.environ.get("COBOL_EXPLORER_NEO4J_PASSWORD", "cobolcobol")

    def _drv(self):
        key = (self.uri, self.user)
        if key not in _DRIVERS:
            from neo4j import GraphDatabase

            _DRIVERS[key] = GraphDatabase.driver(self.uri, auth=(self.user, self.password))
        return _DRIVERS[key]

    def _run(self, cypher: str, **params):
        with self._drv().session() as s:
            return list(s.run(cypher, **params))

    # --- load ------------------------------------------------------------
    def load(self, graph_dict: dict) -> int:
        nodes = [
            {"id": n["id"], "kind": n.get("kind"), "label": n.get("label"),
             "path": (n.get("attrs") or {}).get("path"), "file": (n.get("attrs") or {}).get("file")}
            for n in graph_dict["nodes"]
        ]
        edges = [
            {"src": e["src"], "dst": e["dst"], "kind": e.get("kind"),
             "line": (e.get("evidence") or {}).get("line"), "ev": json.dumps(e.get("evidence") or {})}
            for e in graph_dict["edges"]
        ]
        with self._drv().session() as s:
            # Only wipe the nodes THIS backend owns (:Entity) — never `MATCH (n)`,
            # which would delete every node in a shared/target database.
            s.run("MATCH (n:Entity) DETACH DELETE n")
            s.run("CREATE CONSTRAINT entity_id IF NOT EXISTS FOR (n:Entity) REQUIRE n.id IS UNIQUE")
            s.run(
                "UNWIND $nodes AS n MERGE (x:Entity {id:n.id}) "
                "SET x.kind=n.kind, x.label=n.label, x.path=n.path, x.file=n.file",
                nodes=nodes,
            )
            s.run(
                "UNWIND $edges AS e MATCH (a:Entity {id:e.src}), (b:Entity {id:e.dst}) "
                "CREATE (a)-[:REL {kind:e.kind, line:e.line, ev:e.ev}]->(b)",
                edges=edges,
            )
            return s.run("MATCH (n:Entity) RETURN count(n) AS c").single()["c"]

    def ready(self) -> bool:
        try:
            return self._run("MATCH (n:Entity) RETURN count(n) AS c")[0]["c"] > 0
        except Exception:
            return False

    # --- traversal helpers ----------------------------------------------
    def _in(self, nid: str, kinds: list[str]) -> list[str]:
        r = self._run("MATCH (a:Entity)-[r:REL]->(:Entity {id:$id}) WHERE r.kind IN $k RETURN collect(DISTINCT a.id) AS ids", id=nid, k=kinds)
        return sorted(r[0]["ids"]) if r else []

    def _out(self, nid: str, kinds: list[str]) -> list[str]:
        r = self._run("MATCH (:Entity {id:$id})-[r:REL]->(b:Entity) WHERE r.kind IN $k RETURN collect(DISTINCT b.id) AS ids", id=nid, k=kinds)
        return sorted(r[0]["ids"]) if r else []

    def _out_labels(self, nid: str, kinds: list[str]) -> list[str]:
        # COALESCE(label, id) matches NetworkX, which substitutes the id when a label is null.
        r = self._run("MATCH (:Entity {id:$id})-[r:REL]->(b:Entity) WHERE r.kind IN $k RETURN collect(DISTINCT coalesce(b.label, b.id)) AS l", id=nid, k=kinds)
        return sorted(x for x in (r[0]["l"] if r else []) if x is not None)

    def _in_labels(self, nid: str, kinds: list[str]) -> list[str]:
        r = self._run("MATCH (a:Entity)-[r:REL]->(:Entity {id:$id}) WHERE r.kind IN $k RETURN collect(DISTINCT coalesce(a.label, a.id)) AS l", id=nid, k=kinds)
        return sorted(x for x in (r[0]["l"] if r else []) if x is not None)

    def _node(self, nid: str) -> dict | None:
        r = self._run("MATCH (n:Entity {id:$id}) RETURN n.label AS label, n.kind AS kind, n.file AS file", id=nid)
        return dict(r[0]) if r else None

    # --- backend interface (mirrors graph.backend.NetworkxBackend) -------
    def impact(self, nid: str) -> dict:
        prefix, _ = split_id(nid)
        pk = {"copy": ["PGM_COPIES"], "table": ["PGM_SQL_READS", "PGM_SQL_WRITES"], "pgm": ["PGM_CALLS"]}.get(prefix, [])
        programs = self._in(nid, pk) if pk else []
        jobs = self._in_via_steps(programs)
        chains = sorted({c for j in jobs for c in self._in(j, ["SCHED_RUNS"])}) if jobs else []
        return {"node": nid, "programs": programs, "jobs": jobs, "chains": chains}

    def _in_via_steps(self, programs: list[str]) -> list[str]:
        if not programs:
            return []
        r = self._run(
            "MATCH (job:Entity)-[:REL {kind:'JOB_CONTAINS'}]->(:Entity)-[:REL {kind:'STEP_EXECUTES'}]->(p:Entity) "
            "WHERE p.id IN $progs RETURN collect(DISTINCT job.id) AS ids",
            progs=programs,
        )
        return sorted(r[0]["ids"]) if r else []

    def copy_evidence(self, copy_id: str, pgm_id: str) -> dict:
        r = self._run(
            "MATCH (p:Entity {id:$pgm})-[r:REL {kind:'PGM_COPIES'}]->(:Entity {id:$copy}) "
            "RETURN p.label AS label, p.file AS file, r.line AS line LIMIT 1",
            pgm=pgm_id, copy=copy_id,
        )
        if r:
            row = r[0]
            return {"id": pgm_id, "label": row["label"], "copy_line": row["line"], "file": row["file"]}
        node = self._node(pgm_id) or {}
        return {"id": pgm_id, "label": node.get("label", pgm_id), "copy_line": None, "file": node.get("file")}

    def callers(self, nid: str) -> list[str]:
        return self._in(nid, ["PGM_CALLS"])

    def callees(self, nid: str) -> list[str]:
        return self._out(nid, ["PGM_CALLS"])

    def lineage(self, nid: str) -> dict:
        return {"dataset": nid, "written_by": self._in(nid, ["PGM_WRITES"]), "read_by": self._in(nid, ["PGM_READS"])}

    def neighbors(self, nid: str) -> dict:
        ins = self._run("MATCH (a:Entity)-[r:REL]->(:Entity {id:$id}) RETURN collect({src:a.id, kind:r.kind, ev:r.ev}) AS x", id=nid)
        outs = self._run("MATCH (:Entity {id:$id})-[r:REL]->(b:Entity) RETURN collect({dst:b.id, kind:r.kind, ev:r.ev}) AS x", id=nid)

        def _shape(items, key):
            return [{key: it[key], "kind": it["kind"], "evidence": json.loads(it["ev"]) if it.get("ev") else {}} for it in items]

        return {"in": _shape(ins[0]["x"] if ins else [], "src"), "out": _shape(outs[0]["x"] if outs else [], "dst")}

    def summary(self, nid: str) -> dict:
        node = self._node(nid)
        if not node:
            return {"node": nid, "found": False}
        return {
            "node": nid, "label": node["label"], "kind": node["kind"], "found": True,
            "copybooks": self._out_labels(nid, ["PGM_COPIES"]),
            "tables_read": self._out_labels(nid, ["PGM_SQL_READS"]),
            "tables_written": self._out_labels(nid, ["PGM_SQL_WRITES"]),
            "files_read": self._out_labels(nid, ["PGM_READS_FILE"]),
            "files_written": self._out_labels(nid, ["PGM_WRITES_FILE"]),
            "datasets_read": self._out_labels(nid, ["PGM_READS"]),
            "datasets_written": self._out_labels(nid, ["PGM_WRITES"]),
            "screens": self._out_labels(nid, ["PGM_USES_MAP"]),
            "calls": self._out_labels(nid, ["PGM_CALLS"]),
            "called_by": self._in_labels(nid, ["PGM_CALLS"]),
            "transactions": self._in_labels(nid, ["TXN_INVOKES"]),
        }
