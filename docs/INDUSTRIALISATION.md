# Industrialisation — from proof of concept to a sellable product

> Where this stands: an honest proof of concept over ~47 programs (regex parsing, an in-memory
> NetworkX graph, git-backed versioning, and a vector RAG that can run in-process or on pgvector).
> This document traces a realistic path to an enterprise product, with **real tools** and a
> **phasing**. Nothing here is invented: every brick recommended exists and is proven.
>
> Throughout, "the enterprise buyer" means a large insurer or bank — the kind of organisation whose
> estate this product is aimed at.

---

## 1. Industrial-grade parsing

### The problem

The current parsing (`ingestion/parsers/*.py`) is **regex-based**. It holds on GenApp but breaks on
real COBOL: `COPY ... REPLACING`, nested programs, `PERFORM THRU`, `GO TO`, dynamic calls
(`CALL identifier`), the `EXEC CICS/SQL/DLI/MQ` preprocessors, columns 72/80, `CONTINUATION`, and
dialects (IBM Enterprise COBOL versus GnuCOBOL versus Micro Focus).

### Recommendation: a real AST, not regular expressions

**COBOL → [ProLeap COBOL Parser](https://github.com/uwol/proleap-cobol-parser) (ANTLR4, open
source)** or **[Koopa](https://github.com/krisds/koopa)**. ProLeap gives an AST plus an ASG
(semantic graph) layer, and handles the COPY/REPLACE preprocessor as well as EXEC CICS/SQL. A JVM is
already in the picture (cobol-rekt with JDK 21 is an optional prerequisite of this repository).

The target architecture, already begun — the parsers sit behind an interface:

```
ingestion/parsers/
  base.py            # interface Parser: parse(path) -> list[Node], list[Edge]
  cobol_antlr.py     # NEW: a bridge to ProLeap (JVM through py4j/subprocess) -> AST -> extraction
  cobol.py           # today's regex = the fast FALLBACK, the degraded mode with no JVM
```

The regex parser stays as a **fallback** (the demo mode with no JVM) and the AST takes over when a
JVM is available — selected by environment variable, exactly as the vector index already is.

### A copybook resolver across libraries

Today a copybook becomes a node **only if something references it** — the 11 `.cpy` files in the
corpus that nobody COPYs are invisible, which is precisely why the dead-code detection lists them.
The target:

- **SYSLIB concatenation**: an ordered list of copy libraries, resolved first-match.
- **`COPY ... REPLACING`**: apply the substitutions before extraction, or the fields are wrong.
- **Nested COPY**: recursive expansion, for a copybook that COPYs another.
- **Copybooks at every level**: DATA, PROCEDURE, `EXEC SQL INCLUDE`.

### Beyond COBOL

| Language | Approach | Priority |
|---|---|---|
| **JCL** | **PROC expansion**. `JclParser` creates four PROC nodes but **never opens their body**, so it emits no `PROC_CONTAINS`. Add: PROC member resolution, **symbolic substitution** (`&VAR`), `INCLUDE`, `DD *`/GDG. | High — batch is the heart of insurance |
| **PL/I** | A dedicated parser (an ANTLR PL/I grammar) — `%INCLUDE`, procedures. | Medium |
| **Assembler** | Macros/CSECT/CALL — a coarser analysis (calls plus DSECT). | Low |
| **REXX / CLIST** | Extract the `CALL`/`ADDRESS`/EXEC statements. | Low |

### Parsing phases

1. **P1**: the ProLeap COBOL bridge (AST) plus the SYSLIB/REPLACING/nested copybook resolver, switched by environment.
2. **P2**: JCL PROC expansion, symbolics and INCLUDE — emit `PROC_CONTAINS` and kill the dead end.
3. **P3**: PL/I. **P4**: Assembler and REXX.
4. Across all of them: **incremental ingestion**, by changed member rather than a full reparse.

---

## 2. Versioning: real git rather than a home-made system

### Done

`server/versioning/git_store.py` ships a **`GitVersionStore`** and it is **the default**
(`COBOL_EXPLORER_VCS=git`). A change-set is a **branch**, an edit is a **commit**, the diff is a real
`git diff`, and merging is a real merge — with history and blame for free. The JSON implementation in
`changeset.py` remains as the fallback (`COBOL_EXPLORER_VCS=json`) for a demo with no git binary.

That closes what used to be the honest objection here: "you rewrote git, only worse."

### What comes next

- **Collaborative / enterprise**: self-hosted **[Gitea](https://about.gitea.com/)** (or GitLab).
  Real **pull requests**, code review, RBAC permissions, webhooks, an API — the UI plugs into that
  instead of re-building a review workshop.
- **Integration with the real change process**: bridge to Endevor or ChangeMan on the z/OS side.

Selected by `COBOL_EXPLORER_VCS=git|gitea|json`. The frontend (`ChangesPanel`) does not change; in
Gitea mode it simply gains an "open the PR" link.

### Versioning phases

1. ~~**P1**: a local `GitVersionStore` behind the existing API.~~ ✅ done, and it is the default.
2. **P2**: a **side-by-side** diff (MergeView) in the UI.
3. **P3**: **Gitea** integration (PRs, review, permissions). **P4**: the bridge to the mainframe SCM.

---

## 3. Productionising the LLM and the RAG

### Already done

- ✅ **Real streaming**: the tool trace is emitted **live** (a thread-safe queue in `/api/ask`,
  `Trace.on_record`), so there is no final burst and the graph animation is faithful to what happened.
- ✅ **SSE error-key fix** (`message`), with an explicit deterministic fallback.
- ✅ **pgvector** (`agent/pgvector_index.py`): PostgreSQL with an HNSW cosine index, the same API as
  the JSON backend, selected by `COBOL_EXPLORER_VECTOR=pgvector`. `docker compose up -d` plus
  `make pgvector-load`. Verified to return results **identical** to the in-process cosine, and
  exposed through the agent, `/api/search` and MCP. What remains: an **incremental** index (upsert by
  changed member) and the climb to 100k documents (batch load, HNSW `ef_search` tuning).
- ✅ **Neo4j** (`agent/neo4j_store.py`): the graph RAG runs on a **real self-hosted graph database**
  (Cypher), selected by `COBOL_EXPLORER_GRAPH_BACKEND=neo4j`, with impact, lineage, callers and
  summary re-expressed in Cypher and **verified identical** to NetworkX. `docker compose up -d` plus
  `make neo4j-load`. **`make serve-scale`** brings up the pair — **Neo4j for the graph, pgvector for
  the vectors** — both self-hosted, both wired into the agent.

### Still to do

| Work | Target | Why an enterprise buyer cares |
|---|---|---|
| **Incremental graph** | MERGE by changed member rather than a full reload; Neo4j indexes | Continuous ingestion |
| **Managed vector store** | A **watsonx**/Milvus option, self-hosted or managed | Latency, operability |
| **Hybrid retrieval** | ✅ semantic search is **wired into the UI** (the ⌘P palette) and the agent is instructed to run search_code→graph_lookup; what remains is **reranking** and fusing the graph and vector scores | Answer quality |
| **On-premise / sovereign LLM** | **Private watsonx.ai** or on-premise Ollama; the code, which is the business IP, **never leaves** | Compliance, GDPR/DORA, IP |
| **Governance** | **watsonx.governance**: model traceability, versions, bias | Insurer-grade audit |
| **Guardrails** | Verify that **every citation genuinely exists** (file:line re-checked), a confidence score, refusal when ungrounded | Anti-hallucination on critical systems |
| **Evaluation** | A **golden Q/A** set on real COBOL, plus non-regression and red-teaming | Evidence of reliability |
| **Feedback** | 👍/👎 and human corrections fed back in (human in the loop) | Continuous improvement |
| **LLM ops** | Caching, rate limiting, cost and latency, per-team quotas | Cost under control |

### RAG phases

1. ~~**P1**: wire semantic search into the UI and guard the embeddings so a downed Ollama cannot crash the app.~~ ✅ done.
2. ~~**P2**: persistent **pgvector** and hybrid graph+vector retrieval.~~ ✅ pgvector done; hybrid fusion still to come.
3. **P3**: on-premise/watsonx LLM, governance, citation guardrails, golden evaluation.

---

## Summary — in order of value for an enterprise pitch

1. **A real mainframe connection and industrial parsing** (ProLeap, SYSLIB, JCL PROC) — the actual moat.
2. **Enterprise security and governance** (server-side auth and RBAC, on-premise LLM, audit, GDPR/DORA).
3. **Scale** (graph database, pgvector, incremental ingestion).
4. **Gitea** for change management, bridged to the z/OS SCM.
5. Everything else is features — and those are already well advanced: field-level impact, dead code, lineage, the live graph.
