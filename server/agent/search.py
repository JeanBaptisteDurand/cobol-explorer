"""Semantic code search over the IBM-Granite vector index (cosine, in-process).

The index (index.json) is built by ``build_index`` using Granite embeddings.
This JSON+cosine backend is the zero-dependency default (POC / demo). The scale
path is implemented in ``agent.pgvector_index`` (PostgreSQL + pgvector, HNSW),
selected with ``COBOL_EXPLORER_VECTOR=pgvector`` - same ``ready()``/``search()`` API.
"""
from __future__ import annotations

import json
import math
import os
from collections.abc import Callable


def cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0


class VectorIndex:
    def __init__(self, path: str = "index.json"):
        self.docs: list[dict] = []
        self.model = ""
        if os.path.exists(path):
            with open(path) as fh:
                data = json.load(fh)
            self.docs = data.get("docs", [])
            self.model = data.get("model", "")

    def ready(self) -> bool:
        return bool(self.docs)

    def search(self, query: str, k: int = 5, embed_fn: Callable[[str], list[float]] | None = None) -> list[dict]:
        if not self.docs:
            return []
        if embed_fn is None:
            from index.embed import embed_text as embed_fn  # lazy: needs Ollama
        qv = embed_fn(query)
        scored = [(cosine(qv, d["embedding"]), d) for d in self.docs]
        scored.sort(key=lambda x: x[0], reverse=True)
        return [
            {"id": d["id"], "label": d["label"], "file": d["file"], "path": d["path"], "score": round(s, 3), "snippet": d["snippet"]}
            for s, d in scored[:k]
        ]
