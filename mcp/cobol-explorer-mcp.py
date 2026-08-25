#!/usr/bin/env python3
"""COBOL Explorer MCP connector - one file, standard library only.

Gives IBM Bob (or any MCP client that launches stdio servers) the three
COBOL Explorer analysis tools - graph_lookup, search_code, read_source_lines -
without installing anything: this script speaks MCP over stdio on your machine
and relays each tool call to the hosted estate, authenticated by your personal
key. Every call is written to the estate's audit trail under your account.

Setup (2 minutes):
  1. Sign in at https://cobol-explorer.fr and generate your key
     (sidebar, plug icon, "Connect your Bob").
  2. Save this file anywhere, e.g. ~/cobol-explorer-mcp.py
  3. Register it in your client's MCP configuration:

     {
       "mcpServers": {
         "cobol-explorer": {
           "command": "python3",
           "args": ["/absolute/path/to/cobol-explorer-mcp.py"],
           "env": { "COBOL_EXPLORER_MCP_KEY": "ce_..." }
         }
       }
     }

  4. Ask: "What breaks if I change LGPOLICY?"
     If the answer names 11 programs and 2 batch chains, the tools are live.

No dependency, no virtualenv: python3 (3.9+) is the only requirement.
"""
import json
import os
import sys
import urllib.error
import urllib.request

URL = os.environ.get("COBOL_EXPLORER_MCP_URL", "https://cobol-explorer.fr/mcp")
KEY = os.environ.get("COBOL_EXPLORER_MCP_KEY", "")

PROTOCOL = "2025-03-26"


def remote(payload: dict) -> dict:
    """One stateless JSON-RPC round trip to the hosted endpoint."""
    req = urllib.request.Request(
        URL,
        data=json.dumps(payload).encode(),
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "Authorization": f"Bearer {KEY}",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        body = r.read().decode()
    if "text/event-stream" in (r.headers.get("content-type") or ""):
        data = [ln[6:] for ln in body.splitlines() if ln.startswith("data: ")]
        body = data[-1] if data else "{}"
    return json.loads(body)


def reply(id_, result=None, error=None) -> None:
    msg = {"jsonrpc": "2.0", "id": id_}
    if error is not None:
        msg["error"] = error
    else:
        msg["result"] = result
    sys.stdout.write(json.dumps(msg) + "\n")
    sys.stdout.flush()


def main() -> None:
    if not KEY:
        sys.stderr.write(
            "cobol-explorer-mcp: COBOL_EXPLORER_MCP_KEY is not set.\n"
            "Generate your key at https://cobol-explorer.fr (sidebar, plug icon)\n"
            "and put it in the env block of your MCP configuration.\n"
        )
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            continue
        method, id_ = msg.get("method", ""), msg.get("id")

        if method == "initialize":
            reply(id_, {
                "protocolVersion": msg.get("params", {}).get("protocolVersion", PROTOCOL),
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "cobol-explorer", "version": "1.0.0"},
            })
        elif method.startswith("notifications/"):
            continue  # notifications take no response
        elif method == "ping":
            reply(id_, {})
        elif method in ("tools/list", "tools/call"):
            try:
                out = remote(msg)
            except urllib.error.HTTPError as e:
                detail = e.read().decode(errors="replace")[:300]
                if e.code == 401:
                    detail = "the estate refused the key: generate a fresh one at https://cobol-explorer.fr (sidebar, plug icon)"
                reply(id_, error={"code": -32000, "message": f"remote estate said HTTP {e.code}: {detail}"})
                continue
            except Exception as e:  # network down, DNS, timeout
                reply(id_, error={"code": -32000, "message": f"could not reach the estate: {e}"})
                continue
            if "error" in out:
                reply(id_, error=out["error"])
            else:
                reply(id_, out.get("result", {}))
        else:
            reply(id_, error={"code": -32601, "message": f"method not supported by this connector: {method}"})


if __name__ == "__main__":
    main()
