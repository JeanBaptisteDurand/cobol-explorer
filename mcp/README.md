# Connect IBM Bob to COBOL Explorer - 2 minutes, nothing to install

One file, standard-library Python. It speaks MCP over stdio to your client and
relays the three analysis tools to the hosted estate, under your personal key.
Every call Bob makes lands in the estate's audit trail under your account.

## Steps

1. **Get your key.** Sign in at [cobol-explorer.fr](https://cobol-explorer.fr)
   (demo account: `amine` / `demo`), open the sidebar's plug icon
   ("Connect your Bob"), generate your key. It is shown once.

2. **Save the connector.** Download
   [`cobol-explorer-mcp.py`](./cobol-explorer-mcp.py) anywhere, e.g. `~/cobol-explorer-mcp.py`.

3. **Register it** in your client's MCP configuration (for Bob: `.bob/mcp.json`
   in a workspace, or the global MCP settings):

   ```json
   {
     "mcpServers": {
       "cobol-explorer": {
         "command": "python3",
         "args": ["/absolute/path/to/cobol-explorer-mcp.py"],
         "env": { "COBOL_EXPLORER_MCP_KEY": "ce_..." }
       }
     }
   }
   ```

3bis. **Verify first (optional).** Nothing to start by hand - Bob launches the file itself
   through the config. To prove key and connection from a terminal before touching Bob:

   ```bash
   COBOL_EXPLORER_MCP_KEY=ce_... python3 cobol-explorer-mcp.py --check
   ```

   Expected: the three tools, and `impact of LGPOLICY = 11 programs, 2 batch chains`.

4. **Ask the first question:** *"What breaks if I change LGPOLICY?"*
   If the answer names **11 programs and 2 batch chains**, the tools are live -
   and the call is already in the audit panel, under your name.

If your client supports remote MCP servers natively, you can skip the file:

```json
{
  "mcpServers": {
    "cobol-explorer": {
      "url": "https://cobol-explorer.fr/mcp",
      "headers": { "Authorization": "Bearer ce_..." }
    }
  }
}
```

## Analyse your own estate instead

The hosted endpoint serves the public demo estates (IBM GenApp, AWS CardDemo).
To point the same tools at **your own COBOL** - which never leaves your machine -
clone the repository, drop your sources under `corpora/`, run `make ingest`,
and use the local stdio server shipped in `.bob/mcp.json`. See the main README,
section 7.2.
