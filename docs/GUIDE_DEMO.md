# Usage and demo guide — COBOL Explorer

## 0. Starting it

**Prerequisites**: Docker (Neo4j + pgvector), and Ollama with `granite3.3:8b` (the agent) and
`granite-embedding:278m` (the embeddings).

```bash
make serve-scale     # Neo4j (graph) + pgvector (vectors), self-hosted -> http://127.0.0.1:8000
# variants:
make demo            # zero infrastructure: no Docker, no API key, nothing to configure
make serve           # everything in-process (NetworkX + JSON index)
make serve-pg        # pgvector for the vectors, NetworkX for the graph
make ingest          # re-parse the corpus -> graph.json
make index           # rebuild the Granite semantic index -> index.json
```

On the **first launch** a welcome screen asks for **your name and your role** (see §3).

---

## 1. A map of the interface

- **Title bar**: the logo, the **search** field (Enter goes to the entity), **⌘P** for the palette,
  the **Tour** button, and the **user badge** at the top right (identity and role, click to change).
- **Activity bar** (icons down the left, one lit at a time): Source code · Search · **Graph** ·
  **Versions** (the badge is the count) · **Agent** · **Connect your Bob** · Settings at the bottom.
- **Sidebar**:
  - **Source code** — the COBOL programs by business domain (click opens the code).
  - **Mainframe resources** — copybooks, CICS transactions, VSAM files, BMS screens, DB2 tables
    (click shows their context in the graph).
  - **Versions** — your change branches.
- **Centre**: the **Overview** and **Graph** tabs, plus whatever code or diff tabs you open. The
  **split** button (top right of a pane) puts two files side by side.
- **Right panel**: **Agent · Inspector · Changes · Audit**.
- **Status bar** (bottom): the **active branch** (click "✕ main" to return to main, read-only) and a
  LED reading **Read-only** or **Editing**.
- Small **"?"** markers everywhere explain the concepts on hover: fan-in, batch chains, dead code,
  conflicts, the audit chain.

---

## 2. Every feature, step by step

### Overview (the default centre tab)

The estate on one screen: the statistics (47 programs, copybooks, DB2 tables, domains), the **most
critical copybooks** (fan-in — how many programs depend on each), the **batch chains** from the
scheduler, **estate quality** (dead code: orphan programs and unreferenced copybooks), and three
suggested **questions** that go straight to the agent.

### Search and the ⌘P palette

- **Search** (title bar): type a name (`LGPOLICY`, `POLICY`, a transaction) and press Enter to open
  the entity. When nothing matches, the field says so.
- **⌘P**: a fuzzy palette **plus Granite semantic search** — type an *intent* ("logging", "where the
  premium is calculated") and it finds the programs by meaning, without knowing the name.

### Source code versus Mainframe resources

- **Source code** = things that have a file (programs, copybooks); a click opens the **code**.
- **Mainframe resources** = entities that often have no file (tables, transactions, VSAM files); a
  click opens their **neighbourhood in the graph**.

### Inspector (right panel)

Select an entity and it shows its **computed context**: calls (CALL and CICS), copybooks, DB2 tables
**read and written**, VSAM files, screens, "used by", "called by" — each line with its **source
line** (L.xxx).

- For a **copybook**: **field-level impact** — for each field, how many programs reference it.
- For a **DB2 table**: a note ("columns defined in the DDL, outside the corpus") plus the **programs
  that read and write it**.
- Buttons: **See impact** · **Edit…** · and links into the code and the graph.

### Graph (centre tab)

- **Click** a node to select it (the inspector fills in). The **split icon** on the node, or the
  inspector, opens its code in the centre.
- **Focus** keeps only the node and its direct neighbours.
- **Filter by type**: show or hide domains, programs, copybooks, DB2 tables, transactions.
- **See impact**: select a copybook or a table and the whole impact radius lights up in **red**,
  along with the batch chains it reaches.

### Agent (right panel → Agent)

Ask a question in plain language. You watch, live:

1. the **graph greys out** then **re-lights** as the reasoning proceeds, entity by entity;
2. the **trace** unrolls: `think` (why this tool) → `graph_lookup` / `search_code` /
   `read_source_lines`, with its input and its sources;
3. the **answer** in Markdown with **clickable `file:line` citations** (a click opens the code at
   that line);
4. a **"✓ N sources verified"** badge — the anti-hallucination guardrail.

The **conversation keeps its context**: you can follow up with "and who calls it?" without repeating
the name.

### Changing things (git versions)

1. On a file, click **"Edit in a version"**, name the version, and the editor becomes editable.
2. Edit, then **Cmd/Ctrl+S** or **"Save into version"**.
3. The **impact is recomputed** — the Changes panel reports "N programs impacted".
4. **"See diff with main"** compares against main; reverting a file cancels your change on it and
   returns it to main, which is what you want after deleting something by mistake.
5. **"✕ main"** (status bar or Changes panel) returns you to main, read-only.

### Audit (right panel → Audit)

The **tamper-evident log**: every action — a question, a read, a change, a merge, and every refusal —
is chained with **HMAC**. The **"✓ chain verified"** badge detects alteration, insertion **and
truncation**. The **↓ CSV** button exports it for a compliance file.

### Split view

The **split** icon (top right of a pane) puts two files side by side — a program and the copybook it
copies, for instance.

### Connect your Bob

The left-hand **plug** icon opens everything needed to point your own IBM Bob at this estate over
MCP: the three tool signatures, where the server runs, and the configuration, ready to copy. See
§7.2 of the README.

---

## 3. Accounts and roles (RBAC)

**Switching account**: click the **user badge** (top right) *or* the **Settings** icon (bottom of the
activity bar), change **name and role**, then enter the workshop. The identity is remembered in the
browser; each person's name gives them their own branch.

| Role (UI) | Read / Ask | Comment | New version / Edit | Merge | Read the audit |
|---|:---:|:---:|:---:|:---:|:---:|
| **Developer** | ✓ | ✓ | ✓ | ✓ | — |
| **Architect** | ✓ | ✓ | ✓ | ✓ | — |
| **Risk** | ✓ | ✓ | ✓ | *propose only* | — |
| **Compliance** | ✓ | ✓ | — | — | ✓ |
| **Auditor** | ✓ | — | — | — | ✓ |

> ⚠️ **In "open" mode** (the default, for demos) nobody is blocked — but **the audit records the role**
> behind every action. The grid above is *enforced* in **jwt** mode (`make serve-auth`, the role
> travels inside a signed token) and in **enforce** mode (behind an authenticating proxy). For a demo
> in open mode, say it out loud: "under enforcement the Risk role could not merge, only propose — and
> all of it is traced."

---

## 4. Collaboration (the multi-user heart)

Everyone works in **their own version** — a git branch `cs/<id>` — while **main** is the team's. It
behaves like pull requests.

- **↓ Import main** brings the others' merged work into your branch (`git merge`).
- **A conflict** (you touched the same lines) surfaces two buttons: **"Keep my changes"** or take the
  main version. Nothing merges silently.
- **Propose** submits for review. **Merge** applies onto main — **only if your branch is up to date**,
  otherwise it says to import main first, so you never overwrite a colleague. Merging asks for an
  **impact confirmation** (the merge gate: "this touches N programs").
- You can only propose or merge **your own** active version, just as you only push your own branch.
- A **merged** version becomes closed and read-only.

**A collaboration demo with two accounts:**

1. **Alice** (Developer) edits `lgpolicy.cpy` (+65 → +72) and merges.
2. Switch account to **Bob** (Developer), who edits **the same file** (+65 → +80). He tries to merge
   and is refused ("behind main"). He clicks **↓ Import main** → **conflict** → **"Keep my changes"** →
   then **Merge**. Main ends up holding Bob's explicit decision, and nothing was overwritten.

---

## 5. A concrete example — the graph

**Goal: show the impact of changing a copybook.**

1. Open the **Graph** tab.
2. **⌘P** → type `LGPOLICY` → Enter. The node is selected and the inspector shows what uses it.
3. In the graph, click **"See impact"** → **11 programs** light up red, along with the
   **SDAILYPOL · SPOLRPT** chains. *"That is everything that breaks if I touch this copybook."*
4. **Focus** → keep only LGPOLICY and its direct neighbours, so it stays readable.
5. Click the **split** icon on a program (LGACDB01, say) to open its code in the centre, at the
   **COPY line**.
6. A DB2 bonus: open the **CUSTOMER** table and the inspector shows "read by LGICDB01 (L.169)",
   "written by LGACDB01 (L.222), LGUCDB01 (L.155)".

---

## 6. A concrete example — the agent

**Goal: show a traced, sourced answer and the conversation memory.**

1. Right panel → **Agent**.
2. Type: **"What does program LGIPOL01 do?"**
   The graph greys out and **re-lights** as it goes; the **trace** shows
   `think → graph_lookup(summary) → read_source_lines`; the answer arrives with **clickable
   `file:line` citations** and the **"✓ sources verified"** badge.
3. Follow up, to show memory: **"And which programs are impacted if I change it?"** — it keeps the
   LGIPOL01 context.
4. Other good demo questions:
   - **"Who writes to the POLICY table?"** (shows the EXEC SQL and the DB2 lineage)
   - **"Which programs are impacted if I change copybook LGPOLICY?"** (deterministic impact, 11
     programs plus the chains)
   - **"Where is the premium calculated?"** (semantic search, without knowing the name)
5. Click a citation such as `lgipol01.cbl:55` to open the code at that exact line.

---

## 7. Demo script (about 5 minutes)

| Time | Screen | The message |
|---|---|---|
| 0:00 | **Overview** | "The estate on one screen: 47 programs, the critical copybooks, the dead code found. The risk is visible immediately." |
| 0:45 | **Agent** — "What does LGIPOL01 do?" | "The graph lights up as the reasoning proceeds, and every sentence is tied to a source line that was verified." |
| 1:45 | **Graph** — LGPOLICY impact | "Here are the 11 programs and the 2 batch chains that break if I touch this copybook." |
| 2:30 | **Edit** — a version, +65→+72 | "The change lives in an isolated branch, the impact is recomputed, and nothing is applied until it is merged." |
| 3:30 | **Collaboration** — Bob, a conflict | "Two people on the same program: the conflict is detected, I choose, I merge — without overwriting anyone." |
| 4:30 | **Audit** — the HMAC log and CSV | "Every action is traced, cryptographically chained, and exportable for compliance." |

**The thread to repeat**: *understanding* (read-only, everything sourced) **is not** *changing*
(an isolated branch, reviewed, traced). And: MCP hands IBM Bob this estate **already computed**.

---

## 8. Click-by-click script (the EXACT order of actions)

**Before you start**: `bash scripts/demo-reset.sh`, then open http://127.0.0.1:8000 and press
**Cmd+Shift+R** once to clear an old cache. Enter your **name** and the **Developer** role.

> **"Do I create a version and then edit, or propose from the right-hand panel?"** You create the
> version **FROM THE FILE** (the "Edit in a version" button), you edit, you save. The **Changes
> panel on the right** is not for creating: it is where you **see the impact** and then click
> **Propose** or **Merge**.

**① Overview** *(you are already there)* → show the statistics, the critical copybooks, the dead
code. *"The estate and its risk on one screen."*

**② Graph → impact**

1. Click the **Graph** tab.
2. **⌘P** → type `LGPOLICY` → **Enter**.
3. In the card at the top left of the graph, click **"See impact"**.
4. → 11 red nodes plus the SDAILYPOL·SPOLRPT chains. *"That is what breaks."*
5. Click **clear**.

**③ Agent**

1. Right panel → **Agent**.
2. Type `What does program LGIPOL01 do?` → **Enter**.
3. The graph stays readable under "the agent is thinking", then lights up; the answer arrives with a
   clickable citation and "✓ source verified". *(Allow about 30 s on a local model — narrate over it.)*

**④ Edit** *(create the version FROM the file)*

1. **⌘P** → `LGPOLICY` → **Enter**; the copybook opens **read-only**.
2. Top right of the editor → click **"Edit in a version"**.
3. In the dialog, title it `Raise motor cap` and create the version.
4. The editor becomes editable. On the line `WS-MOTOR-LEN … VALUE +65`, replace `+65` with `+72`.
5. **Cmd+S**, or the **"Save into version"** button.
6. The **Changes** panel opens, showing "N programs impacted" and the **diff**.
7. *(setting up step ⑤)* Click **Merge** → the button becomes **"Confirm merge"** (the merge gate) →
   click it. Main is updated.

**⑤ Collaboration and conflict**

1. Click your **badge at the top right**, set the name to `Bob` and the role to **Developer**.
2. In the sidebar, under **Versions**, click **"Ajustement tarif (Bob)"**.
3. Changes reports **"1 commit behind main"** → click **↓ Import main**.
4. → a **conflict**, in red. Click **"Keep my changes"** → it reports being up to date with main.
5. Click **Merge** → **Confirm**. *"Two people, one program, nothing overwritten."*

**⑥ Audit** → right panel → **Audit** → "✓ chain verified", the list, and the **↓ CSV** button.

**To run it again**: `bash scripts/demo-reset.sh` restores the corpus and stages Bob's version.
