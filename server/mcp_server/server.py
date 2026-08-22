"""MCP server exposing the mainframe graph tools to IBM Bob (and any MCP client).

Bob supports the Model Context Protocol, so these tools plug straight into it:
a compliance officer or developer can, from inside Bob, ask about impact,
lineage or the call graph of the ingested COBOL patrimony — grounded on the
same deterministic graph the web console uses.

Run (stdio):  PYTHONPATH=packages/core:ingestion:server .venv/bin/python -m mcp_server.server
Register in Bob: point an MCP stdio server at that command.
"""
from __future__ import annotations

import json
import os

from mcp.server.fastmcp import FastMCP

from agent.tools import GraphTools

GRAPH = os.environ.get("COBOL_EXPLORER_GRAPH", "graph.json")
CORPUS = os.environ.get("COBOL_EXPLORER_CORPUS", "corpora")

mcp = FastMCP("cobol-explorer")
_tools = GraphTools(GRAPH, CORPUS)


@mcp.tool()
def graph_lookup(op: str, node: str) -> str:
    """Query the mainframe dependency graph.

    op: one of summary | impact | lineage | callers | callees | neighbors.
    node: a name (e.g. LGPOLICY) or a prefixed id (e.g. copy:LGPOLICY, pgm:LGIPOL01).
    Returns JSON. 'summary' on a program profiles what it does (copybooks, DB2
    tables, VSAM files, CICS screens, calls, callers, transactions) + source head.
    'impact' on a copybook lists the programs and batch chains affected by a change.
    """
    return json.dumps(_tools.graph_lookup(op, node), ensure_ascii=False)


@mcp.tool()
def read_source_lines(file: str, start: int, end: int) -> str:
    """Read exact source lines from a COBOL/JCL/copybook file (for citation)."""
    return json.dumps(_tools.read_source_lines(file, start, end), ensure_ascii=False)


@mcp.tool()
def search_code(query: str) -> str:
    """Semantic search over the ingested COBOL code (IBM Granite vector index)."""
    return json.dumps(_tools.search_code(query), ensure_ascii=False)


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
