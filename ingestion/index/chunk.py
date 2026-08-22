"""Chunk the corpus for semantic search.

One chunk per program / copybook, with a metadata header (name, kind,
copybooks used, tables, calls) BEFORE the source — this lifts retrieval by
name/concept, mirroring the header trick from mature RAG code indexers.
"""
from __future__ import annotations

import os


def _deps_header(graph: dict, node_id: str) -> str:
    idx = {n["id"]: n for n in graph["nodes"]}
    lines = []
    label_map = {
        "PGM_COPIES": "copybooks",
        "PGM_CALLS": "appelle",
        "PGM_SQL_READS": "lit tables",
        "PGM_SQL_WRITES": "ecrit tables",
    }
    grouped: dict[str, list[str]] = {}
    for e in graph["edges"]:
        if e["src"] == node_id and e["kind"] in label_map:
            grouped.setdefault(label_map[e["kind"]], []).append(idx.get(e["dst"], {}).get("label", e["dst"]))
    return "".join(f"{k}: {', '.join(sorted(set(v)))}\n" for k, v in grouped.items())


def chunk_corpus(graph: dict, corpus_root: str) -> list[dict]:
    chunks: list[dict] = []
    for n in graph["nodes"]:
        if n["kind"] not in ("PGM", "COPYBOOK"):
            continue
        path = (n.get("attrs") or {}).get("path")
        if not path:
            continue
        full = os.path.join(corpus_root, path)
        if not os.path.exists(full):
            continue
        with open(full, errors="replace") as fh:
            source = fh.read()
        header = f"{n['kind']} {n['label']}\nfile: {path}\n" + _deps_header(graph, n["id"])
        chunks.append(
            {
                "id": n["id"],
                "kind": n["kind"],
                "label": n["label"],
                "file": os.path.basename(path),
                "path": path,
                "text": header + "\n" + source[:6000],
                "snippet": header.strip(),
            }
        )
    return chunks
