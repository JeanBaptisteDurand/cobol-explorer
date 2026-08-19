"""Build the vector index with IBM Granite embeddings -> index.json.

Run: PYTHONPATH=packages/core:ingestion .venv/bin/python -m build_index \
        --graph graph.json --corpus corpora --out index.json
"""
from __future__ import annotations

import argparse
import json

from index.chunk import chunk_corpus
from index.embed import MODEL, embed_texts


def build(graph_path: str, corpus_root: str, out_path: str) -> int:
    with open(graph_path) as fh:
        graph = json.load(fh)
    chunks = chunk_corpus(graph, corpus_root)
    vectors = embed_texts([c["text"] for c in chunks])
    docs = [
        {"id": c["id"], "kind": c["kind"], "label": c["label"], "file": c["file"], "path": c["path"], "snippet": c["snippet"], "embedding": v}
        for c, v in zip(chunks, vectors)
    ]
    with open(out_path, "w") as fh:
        json.dump({"model": MODEL, "dim": len(vectors[0]) if vectors else 0, "docs": docs}, fh)
    return len(docs)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--graph", default="graph.json")
    ap.add_argument("--corpus", default="corpora")
    ap.add_argument("--out", default="index.json")
    args = ap.parse_args()
    n = build(args.graph, args.corpus, args.out)
    print(f"Indexé {n} documents (IBM Granite embeddings) -> {args.out}")


if __name__ == "__main__":
    main()
