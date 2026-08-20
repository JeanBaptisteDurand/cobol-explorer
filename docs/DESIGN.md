# DESIGN.md — COBOL Explorer design system

> A single file a coding agent reads before touching the interface. Everything here is
> prescriptive: exact tokens, exact rules, and an explicit list of what is forbidden.
> If a decision is not covered here, follow the closest analogous rule rather than
> inventing a new pattern.
>
> **Read this before writing any UI code. Re-read the “Forbidden” section before
> shipping.** The most common failure mode is not ugliness — it is *genericness*.

---

## 0. The one-sentence thesis

**This is an instrument, not a brochure.**

COBOL Explorer inspects the systems that move money and pay claims. Every pixel must
say: *this thing is measured, auditable, and does not guess.* When a choice is between
"impressive" and "precise", choose precise. Impressive is what a jury forgets; precise
is what a bank buys.

Three words to design against, in order: **precise · dense · calm.**

---

## 1. Audience and register

Two readers, one page, no compromise between them:

| Reader | Reads it as | What convinces them |
|---|---|---|
| Technical juror / staff engineer | a product they could `git clone` | real numbers, real traces, mono typography, no marketing fluff |
| Risk, compliance, banking IT lead | a control they could deploy | the words *audit*, *evidence*, *role*, *refused*; no toy aesthetics |

Register: the tone of a well-written incident report. Confident, specific, unhurried.
Never exclamatory. Never "revolutionary". Never emoji as decoration (emoji as a *label
glyph* in a dense list is acceptable; emoji as ornament is not).

**The reference points**, and why:

- **Linear** — the discipline of it. One sentence, then a real product clip. Tight copy,
  every section earns its place. Steal the restraint, not the purple.
- **Vercel** — dark surface as a credibility signal, and a hero that shows a *live
  system* rather than an illustration. Our equivalent of their globe is the estate graph
  lighting up while the agent reasons.
- **Resend** — code as hero content. A real snippet beside its real result. Our
  equivalent is the SSE trace beside the verified citations.
- **Stripe docs** — density without noise: how much information can sit on one screen
  when hierarchy is exact.

What we take from all four: **the product itself is the best visual**. No abstract
illustration will ever beat a real trace with real line numbers.

---

## 2. Forbidden — check this list before every commit

These are not preferences. Each one actively damages the positioning.

**Colour and surface**
- ❌ Purple→pink or blue→purple gradients. The signature of an AI template.
- ❌ Glassmorphism, frosted panels, blurred translucent cards.
- ❌ Neumorphism, soft-UI, embossed buttons.
- ❌ More than one accent colour used decoratively. Amber is the only accent; every
  other colour must carry *meaning* (see §3.2).
- ❌ Gradient text. Ever.
- ❌ Rainbow borders, animated gradient borders, "aurora" backgrounds.

**Shape and ornament**
- ❌ Floating 3D blobs, spheres, abstract meshes, liquid metal, shader backgrounds.
- ❌ Stock developer photography, illustrated mascots, isometric people.
- ❌ Emoji as section iconography (🚀 ✨ 💡 as headings).
- ❌ "Powered by AI" / "AI-first" badges. The product demonstrates it; the page does not
  announce it.
- ❌ Decorative dashed borders, sticker shapes, hand-drawn arrows.

**Typography**
- ❌ Inter, Roboto, Open Sans, Lato, Poppins, Montserrat. Overexposed; they read as
  "template" to exactly the audience we want.
- ❌ Weight 500 for headings. Use the extremes (§4.2).
- ❌ Letter-spacing on body text.
- ❌ Sentence-case headings that end in a full stop *and* run over two lines with no
  deliberate break.

**Motion**
- ❌ Parallax scrolling.
- ❌ Elements that fly in from off-screen.
- ❌ Anything that loops forever in the periphery.
- ❌ Scroll-jacking, scroll-driven full-page transitions.
- ❌ Counters that count up on scroll. Our numbers are measured, not animated.

**Copy**
- ❌ "Revolutionary", "game-changing", "seamlessly", "effortlessly", "unlock", "empower".
- ❌ Exclamation marks.
- ❌ Any number that is not literally true and reproducible from the repository.

---

## 3. Colour

### 3.1 Tokens

Declare every colour once, as a CSS custom property on `:root`. No hard-coded hex
anywhere else in the codebase.

```css
:root {
  /* surfaces — warm neutral, never blue-grey */
  --edit:   #191a1d;  /* page background, the deepest layer */
  --side:   #1c1e22;  /* alternating section band */
  --panel:  #1c1e22;  /* card on --edit */
  --soft:   #232529;  /* code blocks, inset wells */
  --el:     #26282d;  /* hover surface */
  --el2:    #2d2f35;  /* pressed surface, strong border */
  --line:   #2b2e34;  /* every 1px divider */

  /* text — four steps, never more */
  --bright: #edeff3;  /* h1/h2 only */
  --tx:     #cdd1d8;  /* body, primary */
  --dim:    #878d97;  /* secondary, descriptions */
  --faint:  #596069;  /* labels, metadata, disabled */

  /* the single accent */
  --amber:   #ffb020;
  --amber-d: #b57d18;  /* borders and hovers of amber elements */

  /* semantic — meaning only, never decoration */
  --blue:   #6cb2ff;  /* graph / structure / deterministic */
  --teal:   #43c9bd;  /* vector / semantic search */
  --purple: #c398ff;  /* reasoning, the think step */
  --green:  #5ec27a;  /* verified, granted, intact */
  --red:    #ff5b52;  /* impact radius, denied, broken chain */
}
```

### 3.2 The colour contract

This is the rule that keeps the interface readable at a glance, and it is absolute:

> **A colour is a claim about meaning.** If you cannot say what a colour *asserts*,
> use `--tx`, `--dim` or `--faint`.

| Colour | Asserts | Appears on |
|---|---|---|
| amber | *this is the focus / this is yours to act on* | primary CTA, selection, the active version, agent activity |
| blue | *this comes from the deterministic graph* | graph RAG, structural relationships, Bob-side surfaces |
| teal | *this comes from semantic search* | vector RAG, similarity scores |
| purple | *this is the model reasoning* | the `think` step, trace lines authored by the agent |
| green | *this was verified / granted* | verified-sources badge, audit chain intact, additions in a diff |
| red | *this breaks / was denied* | impact radius, RBAC refusal, deletions in a diff |

Consequences you must respect:
- Never use red for a decorative heading, nor green for a generic success toast that has
  nothing to do with verification.
- Never colour a nav item amber "to make it pop". Amber on a nav item means it is active.
- Two accents never touch. If blue and teal sit side by side, they are contrasting two
  retrieval paths — which is legitimate. If they sit side by side for variety, delete one.

### 3.3 Contrast floors

- Body text on any surface: **≥ 7:1** (`--tx` on `--edit` is 9.6:1).
- Secondary text: **≥ 4.5:1** (`--dim` on `--edit` is 5.1:1).
- `--faint` is for text that may be missed: labels, counters, metadata. Never for a
  sentence the reader must read.
- Amber on `--edit` is 9.2:1 — safe for text. **Amber text on an amber-tinted surface is
  not.** Amber fills always take `--edit` as their foreground, never white.

---

## 4. Typography

### 4.1 Families

```css
--s: "IBM Plex Sans", system-ui, -apple-system, sans-serif;   /* everything human */
--m: "IBM Plex Mono", ui-monospace, Menlo, monospace;         /* everything machine */
```

IBM Plex is not a neutral choice, it is *the* choice: the product runs on IBM Granite,
targets IBM mainframes, and is submitted to an IBM challenge. The typeface is an argument.

**The mono rule** — mono is not a style, it is a signal. Use `--m` if and only if the
string is *produced or consumed by a machine*:

- ✅ identifiers (`LGPOLICY`, `lgacdb01.cbl:88`), tool names (`graph_lookup()`),
  commands, env vars, HTTP status, counts inside a table, section kickers, badges.
- ❌ headings, body copy, button labels, card descriptions.

### 4.2 Scale

Eight sizes. Adding a ninth requires deleting one.

| Role | Size / line-height | Weight | Family | Notes |
|---|---|---|---|---|
| Hero | 44–56 / 1.05 | 600 | `--s` | `letter-spacing: -.02em`, max 2 lines, deliberate `<br />` |
| H2 | 21 / 1.25 | 600 | `--s` | section titles |
| H3 | 13.5 / 1.4 | 600 | `--s` | card titles |
| Lead | 15 / 1.72 | 400 | `--s` | one per section, max 700px |
| Body | 12.5 / 1.68 | 400 | `--s` | card copy |
| Label | 10 / 1 | 600 | `--m` | uppercase, `letter-spacing: .12em`, `--faint` |
| Code | 11.5–12 / 1.85 | 400 | `--m` | inside `--soft` wells |
| Metric | 28–44 / 1 | 600 | `--m` | `letter-spacing: -.03em` |

**Weight extremes only.** 400 for text, 600 for emphasis and headings, 700 reserved for
the hero. Never 500 — the middle reads as a default nobody chose.

### 4.3 Copy rules

- Headings: sentence case, no trailing period unless the heading is a full sentence
  making an argument (`Understanding ≠ changing.` keeps its period; `The problem` does not).
- One idea per sentence. If a sentence needs a semicolon to survive, split it.
- Numbers always with their unit and their source: *"11 programs"*, not *"11"*.
- Em dashes for asides, never parentheses stacked inside parentheses.
- French is allowed **nowhere** in user-visible strings. The jury is international.

---

## 5. Space, shape, elevation

### 5.1 Spacing scale

`4 · 6 · 8 · 11 · 14 · 18 · 22 · 26 · 34 · 44 · 62`

Odd-looking values are deliberate: they come from optical alignment against 1px borders,
not from a doubling sequence. Use them; do not round them to multiples of 8.

Section rhythm: `62px` vertical padding, `26px` horizontal gutter, content capped at
`1060px`. Hero is the exception: `74px` top.

### 5.2 Radius — the concentric rule

> **outer radius = inner radius + padding**

A card with `padding: 19px` and an inner code block at `radius: 7px` must itself be
`radius: 26px`… which is too round for this system, so instead we cap the inner element:

| Element | Radius |
|---|---|
| Section card | 9px |
| Inner code well | 7px |
| Button, input | 6px |
| Tag, badge | 4px |
| Pill | 99px |
| Colour swatch | 2px |

Never apply the same radius to a parent and its padded child — that is the single most
common visual tell of unconsidered UI.

### 5.3 Borders and elevation

- **1px `--line` is the default separator.** It does more work than any shadow.
- Shadows exist for exactly two things: floating panels (`0 6px 22px rgba(8,9,11,.5)`)
  and modals (`0 8px 30px rgba(0,0,0,.35)`). Cards in flow have **no shadow**.
- A highlighted card is `border-color: var(--amber-d)` plus
  `background: linear-gradient(180deg, rgba(255,176,32,.05), var(--panel))`. Nothing else.
- Never stack a border, a shadow and a gradient on the same element.

---

## 6. Motion

Motion exists to explain causality — *this happened because of that*. Motion that exists
to delight is noise here.

```css
--fast:  120ms;  /* hover, focus, toggles */
--base:  180ms;  /* panel open, tab switch */
--slow:  500ms;  /* viewport re-frame after a graph focus change */
--ease:  cubic-bezier(.2, 0, 0, 1);
```

Rules:
- Only `opacity`, `transform`, `border-color`, `background-color` animate. Never `height`,
  `width`, `top`, `left` — they jank and they read as cheap.
- Nothing animates on page load except a single content fade (`opacity 0→1, 180ms`).
- Nothing loops except: the agent spinner, and the pulse on nodes the agent is currently
  touching. Both stop the instant the work stops.
- **Honour `prefers-reduced-motion: reduce`**: drop every transition to `1ms` and remove
  the pulse. This is not optional; part of the audience uses it.

### 6.1 The signature moment

The estate graph greying out and lighting up entity by entity while the agent retrieves
is **the single most valuable frame in the product**. No competitor has it.

Design rules for it:
- Un-touched nodes go to `opacity: .05` — nearly gone, still spatially present, so the
  reader keeps the map in their head.
- Touched nodes return to full opacity with an amber halo:
  `box-shadow: 0 0 0 1px var(--amber), 0 0 22px rgba(255,176,32,.35)`.
- Edges between two lit nodes animate; everything else stays static.
- The viewport re-frames to the lit set over `--slow`, once, at the end — not per node.
- During the initial wait (no nodes lit yet) the graph stays **fully readable**. A greyed
  screen during a 6-second wait reads as a freeze, not as thinking.

---

## 7. Components

### 7.1 Buttons

```
btn-pri   background var(--amber) · color var(--edit) · weight 600 · radius 6 · padding 10/16
btn       background var(--panel) · color var(--tx) · border 1px var(--line) · radius 6
```
- Exactly **one** `btn-pri` per viewport. Two primaries means neither is primary.
- Hover: `btn` → `border-color: var(--el2)`; `btn-pri` → `filter: brightness(1.06)`.
- Focus-visible on every interactive element:
  `outline: 2px solid var(--amber); outline-offset: 2px`. Never `outline: none` without
  a replacement.
- Disabled: `opacity: .45`, cursor default, no colour change.

### 7.2 Cards

Base: `background --panel · border 1px --line · radius 9 · padding 19`.
Inside a card, in order: optional tag → title (H3) → body (Body) → optional code well.
Never more than one accent colour per card.

### 7.3 Code wells and traces

`background --soft · border 1px --line · radius 7 · padding 12/14 · font --m 11.5/1.85`

A trace line reads `event: <type> <tool> <summary>` where `event:` is `#667085`, the type
is `--faint` in a fixed-width column, the tool takes its semantic colour, and the summary
is `--dim`. Alignment between lines matters more than colour here.

### 7.4 Metric tiles

Number in `--m` at 28–44px, label underneath in Label style. The number is `--amber` when
it is the argument of the section, `--bright` otherwise. **Never animate a metric.**

### 7.5 Inputs

`background --soft · border 1px --line · radius 6 · padding 9/11 · color --tx`
Focus: `border-color: var(--amber-d)`. Placeholder in `--faint`, and the placeholder must
say something useful ("we send one confirmation link, nothing else"), never repeat the label.

### 7.6 Badges

```
badge-ok    green text, rgba(94,194,122,.1) fill, 1px rgba(94,194,122,.3), radius 99
badge-warn  red equivalent
tag         --dim text, 1px --line, radius 4, font --m 9/uppercase/.08em
```
A badge states a verified fact (`✓ 11 sources verified`). A tag classifies (`read-only`).
Never use a badge for decoration.

### 7.7 Tables

Header: Label style, `--faint`, bottom border `--line`. Rows: `--dim`, bottom border
`--soft`. Emphasised cell content in `--tx`. No zebra striping, no vertical rules.

### 7.8 Modal

Scrim `rgba(8,9,11,.62)`, panel `--panel`, radius 10, shadow `0 8px 30px rgba(0,0,0,.35)`,
width 400–470px. Closes on scrim click and on Escape. Focus moves to the first input on
open and returns to the trigger on close.

---

## 8. Page composition

### 8.1 Section rhythm

Alternate `--edit` and `--side` bands so the eye can count sections without scrolling
back. Every section carries, in order:

1. **Kicker** — `NN · Short topic`, Label style, amber.
2. **H2** — one line, an assertion not a noun phrase. *"Understanding ≠ changing."* beats
   *"Our approach"*.
3. **Lead** — one paragraph, ≤ 700px, that could stand alone as the section's summary.
4. **Evidence** — grid of cards, a code well, a trace, or a flow. Never two evidence
   blocks of the same type back to back.

### 8.2 Grids

`grid-template-columns: repeat(N, 1fr)` with `gap: 14–15px`. N ∈ {2, 3, 4}. Below 900px
every grid collapses to a single column — no intermediate 2-up breakpoint, it always
looks accidental.

### 8.3 The hero

- Kicker, then a two-line headline with a deliberate break, then one lead paragraph, then
  exactly two actions (one primary, one quiet), then a row of four measured numbers above
  the fold.
- The numbers are the hero's proof. They must be reproducible from the repository, and
  they must match the README to the digit.

---

## 9. Accessibility

Non-negotiable, and cheap:

- Every interactive element reachable by keyboard, in DOM order.
- `:focus-visible` styled everywhere (§7.1). Test by tabbing the whole page once.
- Colour is never the only carrier of meaning: the verified badge has a ✓ *and* text;
  a denied audit row says "denied" *and* is red.
- Icons that convey meaning get `aria-label`; purely decorative ones get `aria-hidden`.
- Respect `prefers-reduced-motion` (§6).
- Minimum hit target 32×32px, including the small icon buttons in the activity bar.
- The page must be usable at 200% browser zoom without horizontal scrolling.

---

## 10. Implementation constraints

- **React + Vite + TypeScript**, plain CSS custom properties. **No Tailwind**, no CSS-in-JS
  runtime, no component library. The existing system is small and hand-owned; keep it that way.
- **No external network at runtime.** No CDN fonts, no remote images, no analytics. The
  page must render identically behind a corporate proxy with no internet — that is the
  actual deployment environment of our users.
- Fonts: prefer a locally served IBM Plex. If loading remotely, the fallback chain must be
  tested with fonts blocked; the layout must not shift.
- Icons: inline SVG, `currentColor`, no icon font, no sprite sheet.
- One stylesheet, ordered: tokens → reset → primitives → components → page sections →
  responsive. New rules go in their section, never appended at the bottom.
- Every component that renders data a juror might verify (counts, node totals, test
  numbers) reads it from **one** constant, never a literal in JSX.

---

## 11. Working method for the agent

1. **Read the product first.** Open the running app before designing a page about it.
   Screenshots of the real workshop beat any illustration you could compose.
2. **Design the evidence, then the frame.** Decide which real artefact proves the section
   (a trace, a diff, a count), then build the layout around it.
3. **Write the copy before the CSS.** If the sentence is vague, no styling will save it.
4. **Every number is a claim.** Before shipping a number, run the command that produces it.
5. **Delete one thing per section.** If a section survives the deletion, it was noise.
6. **Check against §2 before committing.** Genericness creeps in through small additions.

---

## 12. Pre-ship checklist

- [ ] No forbidden pattern from §2 present anywhere.
- [ ] Exactly one `btn-pri` per viewport.
- [ ] Every colour on the page can be justified by §3.2.
- [ ] No parent and padded child share a border-radius.
- [ ] Tab through the entire page: focus is always visible, order is logical.
- [ ] `prefers-reduced-motion: reduce` removes every animation and the node pulse.
- [ ] 200% zoom: no horizontal scrollbar.
- [ ] Fonts blocked: layout stable, nothing overlaps.
- [ ] Every metric matches the README and the deck to the digit.
- [ ] No French, no emoji ornament, no exclamation mark in user-visible copy.
- [ ] Read the page aloud. If a sentence embarrasses you, rewrite it.
