"""Ingestion CLI: corpus directory -> graph.json.

Pipeline: parse COBOL (source extraction; cobol-rekt enrichment optional via
--rekt) + parse JCL -> cross-resolve file lineage -> load scheduler chain ->
apply business domains -> assemble NetworkX graph -> write graph.json.

Run:  PYTHONPATH=packages/core:ingestion .venv/bin/python -m run_ingest \
        --corpus corpora --out graph.json
"""
from __future__ import annotations

import argparse
import glob
import json
import os
from collections import Counter

from core.schema import Edge, Node, NodeKind, nid, split_id
from graph.build import build_graph, to_json
from graph.cross_resolve import resolve_file_lineage
from graph.domains import apply_domains, load_mapping
from graph.scheduler import load_scheduler
from parsers.bms import BmsParser
from parsers.cobol import CobolParser, run_cobol_rekt
from parsers.csd import CsdParser
from parsers.jcl import JclParser


def _find(corpus: str, patterns: list[str]) -> list[str]:
    out: list[str] = []
    for pat in patterns:
        out += glob.glob(os.path.join(corpus, "**", pat), recursive=True)
    return sorted(set(out))


def ingest(corpus_dir: str, out_path: str, rekt: bool = False, rekt_out: str = "/tmp/rekt-out") -> dict:
    nodes: list[Node] = []
    edges: list[Edge] = []
    selects_by_pgm: dict[str, dict[str, str]] = {}

    # --- COBOL ---
    cbl_files = _find(corpus_dir, ["*.cbl", "*.CBL", "*.cob"])
    parsed = failed = 0
    for f in cbl_files:
        try:
            pu = CobolParser().parse(f)
        except Exception as exc:  # degrade gracefully, keep going
            failed += 1
            print(f"[warn] COBOL parse failed for {f}: {exc}")
            continue
        parsed += 1
        nodes += pu.nodes
        edges += pu.edges
        if pu.selects:
            selects_by_pgm[nid("pgm", pu.program)] = pu.selects
        if rekt:
            try:
                reports = run_cobol_rekt(f, os.path.dirname(f), os.path.dirname(f), rekt_out)
                for n in pu.nodes:
                    if n.id == nid("pgm", pu.program):
                        n.attrs["rekt"] = {k: os.path.basename(v) for k, v in reports.items()}
            except Exception as exc:
                print(f"[warn] cobol-rekt enrichment failed for {f}: {exc}")

    # --- JCL ---
    jcl_files = _find(corpus_dir, ["*.jcl", "*.JCL"])
    for f in jcl_files:
        try:
            pu = JclParser().parse(f)
        except Exception as exc:
            print(f"[warn] JCL parse failed for {f}: {exc}")
            continue
        # The parser knows which file it read, so the JOB gets its source path here -
        # matching by name would miss every job whose JCL member is named differently.
        rel = os.path.relpath(f, corpus_dir)
        for n in pu.nodes:
            if n.kind == NodeKind.JOB:
                n.attrs.setdefault("path", rel)
                n.attrs.setdefault("file", os.path.basename(rel))
        nodes += pu.nodes
        edges += pu.edges

    # --- BMS maps (screens) ---
    for f in _find(corpus_dir, ["*.bms", "*.BMS"]):
        try:
            pu = BmsParser().parse(f)
            nodes += pu.nodes
            edges += pu.edges
        except Exception as exc:
            print(f"[warn] BMS parse failed for {f}: {exc}")

    # --- CICS transactions (DFHCSDUP 'Define', often inside cdef*.jcl SYSIN) ---
    for f in _find(corpus_dir, ["*.jcl", "*.JCL", "*.csd", "*.CSD"]):
        try:
            pu = CsdParser().parse(f)
            nodes += pu.nodes
            edges += pu.edges
        except Exception as exc:
            print(f"[warn] CSD parse failed for {f}: {exc}")

    # --- cross-resolution: batch data lineage ---
    edges += resolve_file_lineage(edges, selects_by_pgm)

    # --- scheduler chain ---
    sched_path = os.path.join(corpus_dir, "scheduler.json")
    if os.path.exists(sched_path):
        sn, se = load_scheduler(sched_path)
        nodes += sn
        edges += se

    # --- business domains ---
    dom_path = os.path.join(corpus_dir, "domains.yaml")
    if os.path.exists(dom_path):
        dn, de = apply_domains(nodes, load_mapping(dom_path))
        nodes += dn
        edges += de

    # enrich PGM/COPYBOOK nodes with a corpus-relative path (source view + editing);
    # JOB nodes get theirs straight from the JCL parser loop above.
    index = {
        os.path.basename(f).split(".")[0].upper(): os.path.relpath(f, corpus_dir)
        for f in _find(corpus_dir, ["*.cbl", "*.CBL", "*.cob", "*.cpy", "*.CPY"])
    }
    for n in nodes:
        if n.kind in ("PGM", "COPYBOOK"):
            rel = index.get(split_id(n.id)[1].upper())
            if rel:
                n.attrs.setdefault("path", rel)
                n.attrs.setdefault("file", os.path.basename(rel))

    g = build_graph(nodes, edges)
    data = to_json(g)
    # Atomic write: a concurrent reader (e.g. /api/graph during a post-merge rebuild)
    # must never observe a truncated/half-written file - write a temp then rename.
    tmp = f"{out_path}.tmp.{os.getpid()}"
    with open(tmp, "w") as fh:
        json.dump(data, fh, indent=2)
    os.replace(tmp, out_path)

    data["_ingest"] = {
        "cobol_parsed": parsed,
        "cobol_failed": failed,
        "jcl_files": len(jcl_files),
        "node_kinds": dict(Counter(n["kind"] for n in data["nodes"])),
        "edge_kinds": dict(Counter(e["kind"] for e in data["edges"])),
    }
    return data


def main() -> None:
    ap = argparse.ArgumentParser(description="Ingest a mainframe corpus into graph.json")
    ap.add_argument("--corpus", default="corpora")
    ap.add_argument("--out", default="graph.json")
    ap.add_argument("--rekt", action="store_true", help="also run cobol-rekt for enrichment")
    args = ap.parse_args()

    data = ingest(args.corpus, args.out, rekt=args.rekt)
    info = data["_ingest"]
    print(f"Wrote {args.out}: {data['stats']['nodes']} nodes, {data['stats']['edges']} edges")
    print(f"  COBOL parsed: {info['cobol_parsed']} (failed {info['cobol_failed']}), JCL: {info['jcl_files']}")
    print(f"  node kinds: {info['node_kinds']}")
    print(f"  edge kinds: {info['edge_kinds']}")


if __name__ == "__main__":
    main()
