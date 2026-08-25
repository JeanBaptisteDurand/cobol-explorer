# IBM Bob, connected to COBOL Explorer - the evidence

Screenshots of a real IBM Bob session (VS Code) using the three COBOL Explorer
tools over MCP. Every tool call shown here also lands in the estate's
HMAC-chained audit trail, under the account whose key the connector carries -
see the paired audit capture.

| # | File | What it shows |
|---|------|---------------|
| 1 | `01-bob-mcp-connected.png` | Bob's MCP settings: the cobol-explorer server Connected (workspace scope), and Bob listing the three tools with their descriptions |
| 2 | `02-bob-calls-graph-lookup.png` | The question "what breaks if I change LGPOLICY?" and Bob invoking `mcp__cobol-explorer__graph_lookup` - the tool call itself, visible |
| 3 | `03-bob-answer-11-programs.png` | The grounded answer: 11 programs, the SDAILYPOL and SPOLRPT batch chains |
| 4 | `04-audit-attribution.png` | The same call, seconds later, in the workshop's Audit panel: `mcp:graph_lookup · impact:LGPOLICY` under the caller's name |
| 5 | `05-bob-cites-source-lines.png` | Bob chaining `graph_lookup` and `read_source_lines` to cite an exact `file:line` |
