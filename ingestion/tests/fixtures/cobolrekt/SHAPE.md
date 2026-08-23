# cobol-rekt fixtures - shape & extraction decision

Captured by running (Phase 0.5):

```
java -jar smojol-cli.jar run lgipol01.cbl \
  --commands="BUILD_BASE_ANALYSIS WRITE_RAW_AST WRITE_CFG WRITE_DATA_STRUCTURES BUILD_PROGRAM_DEPENDENCIES" \
  --srcDir <genapp>/base/src --copyBooksDir <genapp>/base/src --dialect COBOL --reportDir OUT
```

**De-risk result: PASS.** cobol-rekt parses GenApp's CICS + DB2 COBOL. It even
surfaces `EXEC CICS LINK PROGRAM('LGSTSQ')` as dialect nodes in the AST.

Note: the CLI file search is **STRICT by default** - pass the exact filename
(`lgipol01.cbl`, lowercase), or add `-p/--permissiveSearch`.

## Files
- `lgipol01.ast.json`  - full parse tree, nested `{nodeType, text, children[]}` (~1.6 MB).
- `lgipol01.cfg.json`  - control-flow graph (~34 KB).
- `lgipol01.data.json` - DATA DIVISION item hierarchy / copybook layouts (~112 KB).

## Extraction decision (hybrid)
cobol-rekt **expands** copybooks and folds EXEC blocks into dialect nodes, so
the graph edges we need are recovered by **construct-specific extraction from
source** (unambiguous COBOL/CICS syntax, not free-form regex):

| Graph fact | Source of truth |
|---|---|
| PGM identity, paragraphs, PERFORM | source scan (cheap, exact) - cobol-rekt AST/CFG available for enrichment |
| PGM_COPIES (copybook, data/proc, REPLACING) | `COPY name` in source (cobol-rekt expands these away) |
| PGM_CALLS (CICS LINK/XCTL) | `EXEC CICS LINK/XCTL PROGRAM(x)` block scan |
| PGM_SQL_READS/WRITES (DB2 tables) | `EXEC SQL` block scan |
| SELECT/ASSIGN (for lineage) | `SELECT .. ASSIGN TO dd` in source |
| copybook field layout (node attrs, richness) | cobol-rekt `*.data.json` |

Ground truth for `lgipol01.cbl`: COPY LGPOLICY + LGCMAREA (data); CICS LINK to
LGIPDB01 + LGSTSQ; PERFORM WRITE-ERROR-MESSAGE; no EXEC SQL / SELECT.
