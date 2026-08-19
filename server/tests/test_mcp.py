"""MCP server (for IBM Bob) exposes the graph tools."""
import asyncio
import importlib
import json
import os

import pytest

pytestmark = pytest.mark.skipif(not os.path.exists("graph.json"), reason="graph.json not built")


def test_mcp_tools_registered():
    m = importlib.import_module("mcp_server.server")
    tools = asyncio.run(m.mcp.list_tools())
    names = {t.name for t in tools}
    assert {"graph_lookup", "read_source_lines", "search_code"} <= names


def test_mcp_graph_lookup_returns_impact():
    m = importlib.import_module("mcp_server.server")
    data = json.loads(m.graph_lookup("impact", "LGPOLICY"))
    assert data["node"] == "copy:LGPOLICY"
    assert len(data["programs"]) >= 3
