# Video script — 3 minutes, word for word

> Judges' guidance: show, fast — **the problem · who it is for · how the AI works · a running demo · the impact**.
> Rule for this script: **open on the human stake, not on the word “COBOL”.** Mainframe loses a general audience in
> 60 seconds; a production incident does not.
>
> Everything below is recorded against **https://cobol-explorer.fr** (live), signed in as `amine / demo`.
> Total: **2 min 55 s**. Narration in English.

---

## 0:00 — 0:22 · The stake (screen: the landing page hero)

> "Your bank moved money last night. Your insurer paid a claim. The code that did it was written before most of us
> were born — and it still runs, untouched, because nobody dares.
>
> Here is what 'nobody dares' actually means. A developer needs to widen one field, in one shared file. They search,
> they ask around, they find eight programs. There were eleven. The other three fail at 3 a.m., in batch, in
> production."

*Action: scroll the landing slowly, stop on the four proof numbers.*

## 0:22 — 0:40 · Who it is for (screen: the workshop, right panel visible)

> "COBOL Explorer is an AI co-worker for the people who keep those systems alive — and not only the developers.
> Risk, compliance and audit carry the consequences of a change without being able to read a line of the code.
> They get the same answers, grounded the same way."

*Action: sign in, land on the Overview. Point at the left tree (business domains), then the right tabs
(Agent · Inspector · Changes · Audit).*

## 0:40 — 1:10 · How the AI works (screen: Overview → Graph)

> "The whole estate is parsed first — COBOL, JCL, CICS, DB2, screens, the scheduler — into a dependency graph where
> every link carries its evidence: the exact line of the COPY, the CALL, the SQL.
>
> On top of that graph sits an agent built on IBM Granite with the BeeAI framework. It picks its own tools and, before
> each one, it writes down *why*. Two retrieval paths: the graph, when the answer must be exact and exhaustive; a
> Granite vector index, when you don't know the name of what you're looking for."

*Action: open the Graph tab, show the layers, hover one edge to reveal the evidence line.*

## 1:10 — 2:00 · The demo that matters (screen: Agent panel, live)

> "So let's ask the question that caused the incident."

*Action: type — `Which programs break if I change copybook LGPOLICY?` — and let it run. Do not cut the wait.*

> "Watch the graph. It greys out, then lights up entity by entity as the agent retrieves — this is the reasoning,
> made visible.
>
> Eleven programs. Two batch chains. Every one of them cited to the file and the line. And this badge is the part I
> care about most: after the answer is written, the server re-reads every citation against the source. Eleven sources
> verified. A plausible answer that isn't grounded never passes silently."

*Action: click one citation → the code opens and the line highlights. Point at the ✓ badge.*

## 2:00 — 2:35 · From answer to governed change (screen: Changes + Audit)

> "Understanding is half of it. Changing is the other half — and it is where estates get damaged.
>
> Every change lives in its own git branch. The impact is recomputed at each edit. Risk can propose; only a developer
> or an architect can merge, and merging asks for confirmation: *this touches eleven programs*. Every action —
> including every refusal — is appended to a hash-chained audit log that detects tampering."

*Action: show a version with its diff and impact count, click Merge to reveal the gate, then open the Audit tab and
point at the "chain intact" badge.*

## 2:35 — 2:55 · Close (screen: closing slide)

> "Built on IBM Granite and Granite embeddings, orchestrated with BeeAI, running on watsonx.ai — and the same three
> tools are exposed back to IBM Bob over MCP, so Bob itself can query the estate.
>
> Days of manual impact hunting, down to thirty seconds — with line-level proof.
>
> COBOL Explorer. It's live at cobol-explorer.fr."

*Action: end on the closing slide with the URL and the GitHub link readable on screen.*

---

## Shot checklist before recording

- [ ] Sign out first — the landing page must be the opening frame.
- [ ] Pre-warm the agent once (first watsonx call is slower than the rest).
- [ ] Zoom the browser to ~110 % so `file:line` citations are legible on a phone.
- [ ] Hide bookmarks, notifications, and any other tab.
- [ ] Record at 1920×1080; keep the cursor slow — jurors follow the pointer.
- [ ] Do **not** speed up the agent's answer. The honest latency is part of the credibility.
- [ ] Upload public (YouTube unlisted is fine), then test the link in a private window, logged out.
- [ ] Put the link at the very top of the README.
