# Video script - 3:00, word for word

> Judges' guidance: show, fast - **the problem · who it is for · how the AI works · a running demo · the impact**.
> Four mandatory scenes: the graph, a question in COBOL Explorer, IBM Bob over MCP, and the
> three-role team workflow with a conflict. One take per scene; assemble after.

## Before recording - stage the state (5 minutes)

1. `bash scripts/demo-reset.sh` style clean state, or on the prod demo: make sure the sidebar
   shows exactly three versions: one MERGED (Lea), one PROPOSED by Sofia ("asks for review"),
   one DRAFT behind main for the conflict beat (Claire's).
2. Stage the conflict: create Claire's version FIRST, then merge another version touching the
   same line, so Claire's "Import main" hits the conflict on camera.
3. Bob (VS Code) open on the second monitor / other desktop, cobol-explorer MCP server Connected,
   a fresh task ready.
4. Sign in as **Amine (dev)**. The role switcher (badge, top right) does the account changes
   on camera - it is one click and it is a feature.
5. Browser at 1440px, 125% zoom if the recording is 1080p. English narration. No em dashes in
   any on-screen text you type.

---

## 0:00 - 0:20 · The problem (voice over a black slide, then the landing hero)

> A developer changes one COBOL copybook. They ask around: which programs does this touch?
> They find eight. There were eleven. The other three fail at three a.m., in batch, in
> production. Two hundred billion lines of COBOL still run banks and insurers - and the
> blast radius of a change is still guesswork.

*Action: landing page scrolls slowly under the last sentence: "Ask the estate. Get the proof."*

## 0:20 - 0:40 · Scene 1 - the graph (the deterministic truth)

> This is COBOL Explorer. The whole estate - programs, copybooks, DB2 tables, CICS, the JCL
> and the scheduler - parsed into one dependency graph. Watch: the impact of one copybook.

*Action: workshop, Graph tab. ⌘P → LGPOLICY → Enter. Click "See impact". The 11 nodes light
up red with the two batch chains. Hold 3 seconds. Click a node's code icon: the COPY line.*

> Eleven programs, two batch chains - not an estimate, a traversal. Every edge proven to a
> source line.

## 0:40 - 1:05 · Scene 2 - ask in plain language (the agent)

*Action: right panel, Agent. Type: "Which programs break if I change copybook LGPOLICY?" Send.
DO NOT cut the wait - the trace IS the demo: think → graph_lookup → the graph lighting up.*

> An agent on IBM Granite, running on watsonx dot ai. It picks its own tools and says why.
> The answer cites file and line - and the server re-verifies every citation against the
> source before you see it. Eleven sources, verified.

*Action: click one citation → the code opens at the exact line, flashed.*

## 1:05 - 1:35 · Scene 3 - IBM Bob, extended over MCP

*Action: cut to VS Code. One second on Bob Settings → MCP → cobol-explorer · Connected.
Then the chat: "what breaks if I change LGPOLICY?" → the approval gate shows
Graph Lookup {"op":"impact","node":"copy:LGPOLICY"} → Approve → the 11-program table.*

> The same tools are exposed to IBM Bob over MCP. Bob does not guess from open files: it
> calls the graph, and gets the same eleven programs, with the same line-level proof.

*Action: flash (2 s) the workshop's Audit panel line: mcp:graph_lookup · impact:copy:LGPOLICY
under the caller's name.*

> And every call Bob makes is written to the audit trail, under the person who owns the key.
> The AI is audited like a colleague.

## 1:35 - 2:40 · Scene 4 - a team of three roles, one governed change

*Action: badge → switch to Sofia (risk) - one click, it is a real signed login.*

> Sofia works in risk. She opens a version - a real git branch - widens a premium field,
> saves. The impact recomputes as she types: eleven programs. She proposes.

*Action: in her draft: edit the value, Cmd+S, Changes panel shows the impact, click Propose.
Then click Merge: the 403 toast - "that right belongs to: dev, architect". Hold 2 seconds.*

> She cannot merge. Not a grey button - the server refuses, names who can, and writes the
> refusal to the audit trail.

*Action: badge → back / switch to Amine (dev). The sidebar shows Sofia's version first:
"Sofia asks for review · touches 11". Open it, glance at the diff, click Merge →
the gate: "touches 11 programs. Confirm?" → confirm.*

> Amine is a developer. Sofia's proposal is waiting for him, blast radius announced. He
> reads the diff, and the merge gate makes him say it out loud: eleven programs. Confirmed.

*Action: switch to Claire (architect), open her draft: "2 commits behind main" → Import main
→ the conflict card: same lines changed - two self-explaining choices → "Keep my changes"
→ up to date → Merge → confirm.*

> Claire was working in parallel on the same lines. No silent overwrite: the conflict names
> the file, she decides, and only then may she merge. Plan, coordinate, decide, execute -
> that is the whole Wildcard theme, running.

*(lower-third during this scene: PLAN · COORDINATE · DECIDE · EXECUTE)*

## 2:40 - 3:00 · Scene 5 - the audit, and the close

*Action: switch to Marc (auditor). Audit panel: the chain - logins, edits, merges, Sofia's
refusal, and the mcp:graph_lookup calls, "✓ chain verified". Hold 3 seconds.*

> Marc audits. Every action you just watched - human or AI - is in one tamper-evident
> chain. Days of manual impact hunting, down to thirty seconds, with line-level proof.
> It is live today on watsonx dot ai, and one command installs it anywhere.

*Action: cut to the landing hero with the URL visible.*

> Bob helped build this tool. Now the tool extends Bob. COBOL Explorer - live at
> cobol-explorer dot fr.

---

## Assembly checklist

- [ ] ≤ 3:00 total; scene 4 is the longest (65 s) - trim narration, never the gate shot
- [ ] The numbers said out loud match the screen: eleven programs, two chains, everywhere
- [ ] English UI throughout; no personal key visible in any frame (careful in VS Code)
- [ ] Upload unlisted (YouTube) · test the link in a private window · put it at the top of the README
