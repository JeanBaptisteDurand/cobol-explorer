"""The remote MCP endpoint: the same three tools, over HTTP, under a per-account key.

The stdio server (mcp_server/) stays what it is: local, keyless, beside YOUR
estate - that is the "your code never leaves the box" story. This module is the
other half: a juror or a teammate points IBM Bob at https://<host>/mcp with the
key minted from their account, and queries the DEMO estate in two minutes with
nothing installed.

What the key buys is not access - the tools are read-only over a public demo
corpus - it is ATTRIBUTION: every tool call Bob makes lands in the same
HMAC-chained audit trail as the human actions, under the account's name. An AI
co-worker that is audited like a person is the governance argument, extended.

Wired by app.py through :func:`configure` (dependency injection, because this
module must not import the app that mounts it).
"""
from __future__ import annotations

import contextvars
import json
from typing import Callable

from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings

from security import users

# Who is calling, for the duration of one request. Set by the auth wrapper,
# read by the tool bodies when they write their audit line.
_actor: contextvars.ContextVar[dict] = contextvars.ContextVar("mcp_actor", default={"name": "?", "role": "guest"})

_get_tools: Callable = lambda: None          # app.tools() - the active estate's GraphTools
_audit = None                                 # app.AUDIT
_require_key: Callable[[], bool] = lambda: False  # True in jwt mode


def configure(get_tools: Callable, audit, require_key: Callable[[], bool]) -> None:
    global _get_tools, _audit, _require_key
    _get_tools, _audit, _require_key = get_tools, audit, require_key


def _record(tool: str, target: str) -> None:
    a = _actor.get()
    if _audit is not None:
        _audit.record(a["name"], a["role"], f"mcp:{tool}", target=target)


class RemoteMcp:
    """One transport per application instance.

    A FastMCP session manager can only be run() once, and the test suite builds
    a fresh app per test (importlib.reload): a module-level singleton therefore
    exploded on the second lifespan. The factory hands each app its own.
    """

    def __init__(self):
        # The transport ships DNS-rebinding protection keyed on the Host header.
        # It exists to protect KEYLESS localhost servers from hostile web pages;
        # this endpoint sits behind a bearer key on a public host, so the list
        # simply names the hosts we actually serve (overridable for another
        # deployment). Without it, production itself would be a 421.
        import os
        hosts = os.environ.get(
            "COBOL_EXPLORER_MCP_HOSTS",
            "cobol-explorer.fr,www.cobol-explorer.fr,127.0.0.1:*,localhost:*,testserver",
        ).split(",")
        self.mcp = FastMCP(
            "cobol-explorer",
            stateless_http=True,       # every call self-contained: no session to manage
            streamable_http_path="/",  # mounted under /mcp by the app, so the URL is /mcp
            transport_security=TransportSecuritySettings(
                allowed_hosts=hosts, allowed_origins=["https://" + h for h in hosts] + ["http://" + h for h in hosts]),
        )
        self._register()
        self.asgi = self._guarded(self.mcp.streamable_http_app())

    def _register(self) -> None:
        @self.mcp.tool()
        def graph_lookup(op: str, node: str) -> str:
            """Query the mainframe dependency graph.

            op: one of summary | impact | lineage | callers | callees | neighbors.
            node: a name (e.g. LGPOLICY) or a prefixed id (e.g. copy:LGPOLICY, pgm:LGIPOL01).
            Returns JSON. 'impact' on a copybook lists the programs and batch chains a
            change would reach, exhaustively.
            """
            _record("graph_lookup", f"{op}:{node}")
            return json.dumps(_get_tools().graph_lookup(op, node), ensure_ascii=False)

        @self.mcp.tool()
        def read_source_lines(file: str, start: int, end: int) -> str:
            """Read exact source lines from a COBOL/JCL/copybook file (for citation)."""
            _record("read_source_lines", f"{file}:{start}-{end}")
            return json.dumps(_get_tools().read_source_lines(file, start, end), ensure_ascii=False)

        @self.mcp.tool()
        def search_code(query: str) -> str:
            """Semantic search over the ingested COBOL code (IBM Granite vector index)."""
            _record("search_code", query[:80])
            return json.dumps(_get_tools().search_code(query), ensure_ascii=False)

    @staticmethod
    def _guarded(inner):
        """Key authentication in front of the transport.

        In jwt mode a valid per-account key is required and resolves the actor; a
        missing or unknown key is a clean 401 before MCP even parses the request.
        In open mode (local demo) the endpoint is open and the actor is 'guest',
        consistent with how the rest of the API behaves there.
        """
        async def guarded(scope, receive, send):
            if scope["type"] != "http":
                return await inner(scope, receive, send)
            headers = {k.decode().lower(): v.decode() for k, v in scope.get("headers", [])}
            auth = headers.get("authorization", "")
            key = auth[7:].strip() if auth.lower().startswith("bearer ") else ""
            actor = users.actor_for_mcp_key(key)
            if _require_key():
                if actor is None:
                    if _audit is not None:
                        _audit.record("?", "guest", "mcp:connect", target="bad or missing key", result="rejected")
                    body = json.dumps({"error": "a valid MCP key is required: mint one from your account in the workshop"}).encode()
                    await send({"type": "http.response.start", "status": 401,
                                "headers": [(b"content-type", b"application/json")]})
                    await send({"type": "http.response.body", "body": body})
                    return
            token = _actor.set(actor or {"name": "guest", "role": "guest"})
            try:
                await inner(scope, receive, send)
            finally:
                _actor.reset(token)

        return guarded


def create() -> RemoteMcp:
    return RemoteMcp()
