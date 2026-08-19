"""Production vector store: PostgreSQL + pgvector (the scale path for search_code).

Same interface as ``agent.search.VectorIndex`` (``ready()`` + ``search()``), so it
drops in behind ``GraphTools.search_code`` selected by ``COBOL_EXPLORER_VECTOR=pgvector``.
Embeddings stay IBM Granite (``granite-embedding:278m``, 768-dim); pgvector does the
ANN search (HNSW, cosine) instead of an in-process JSON scan.
"""
from __future__ import annotations

import os
from collections.abc import Callable

DEFAULT_DSN = "postgresql://cobol:cobol@127.0.0.1:55432/cobol"


class PgVectorIndex:
    def __init__(self, dsn: str | None = None, dim: int = 768, table: str = "code_docs"):
        self.dsn = dsn or os.environ.get("COBOL_EXPLORER_PGDSN", DEFAULT_DSN)
        self.dim = dim
        self.table = table
        self.model = "granite-embedding:278m (pgvector)"

    def _conn(self):
        # No DDL here (CREATE EXTENSION belongs in ensure_schema) so plain connections
        # work on a least-privilege read role; vectors are passed as ::vector literals.
        import psycopg

        return psycopg.connect(self.dsn, autocommit=True)

    @staticmethod
    def _vec(embedding) -> str:
        return "[" + ",".join(repr(float(x)) for x in embedding) + "]"

    def ensure_schema(self) -> None:
        with self._conn() as c:
            c.execute("CREATE EXTENSION IF NOT EXISTS vector")
            c.execute(
                f"CREATE TABLE IF NOT EXISTS {self.table} ("
                "id text PRIMARY KEY, kind text, label text, file text, path text, "
                f"snippet text, embedding vector({self.dim}))"
            )
            c.execute(
                f"CREATE INDEX IF NOT EXISTS {self.table}_emb ON {self.table} "
                "USING hnsw (embedding vector_cosine_ops)"
            )

    def load(self, docs: list[dict]) -> int:
        """Upsert docs (with their Granite embeddings) from a built index.json payload."""
        self.ensure_schema()
        with self._conn() as c, c.cursor() as cur:
            cur.execute(f"TRUNCATE {self.table}")
            for d in docs:
                cur.execute(
                    f"INSERT INTO {self.table} (id,kind,label,file,path,snippet,embedding) "
                    "VALUES (%s,%s,%s,%s,%s,%s,%s::vector)",
                    (d["id"], d.get("kind"), d.get("label"), d.get("file"), d.get("path"), d.get("snippet"), self._vec(d["embedding"])),
                )
            n = cur.execute(f"SELECT count(*) FROM {self.table}").fetchone()[0]
        return n

    def count(self) -> int:
        try:
            with self._conn() as c:
                return c.execute(f"SELECT count(*) FROM {self.table}").fetchone()[0]
        except Exception:
            return 0

    def ready(self) -> bool:
        return self.count() > 0

    def search(self, query: str, k: int = 5, embed_fn: Callable[[str], list[float]] | None = None) -> list[dict]:
        if embed_fn is None:
            from index.embed import embed_text as embed_fn  # lazy: needs Ollama
        qv = embed_fn(query)
        vec = self._vec(qv)  # passed as a ::vector literal
        with self._conn() as c:
            rows = c.execute(
                f"SELECT id, label, file, path, snippet, 1 - (embedding <=> %s::vector) AS score "
                f"FROM {self.table} ORDER BY embedding <=> %s::vector LIMIT %s",
                (vec, vec, k),
            ).fetchall()
        # columns: id, label, file, path, snippet, score
        return [
            {"id": r[0], "label": r[1], "file": r[2], "path": r[3], "snippet": r[4], "score": round(float(r[5]), 3)}
            for r in rows
        ]
