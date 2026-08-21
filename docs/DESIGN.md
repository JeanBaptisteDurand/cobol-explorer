# DESIGN.md — COBOL Explorer design system

> A single file a coding agent reads before touching the interface. Everything here is
> prescriptive: exact tokens, exact rules, and an explicit list of what is forbidden.
> If a decision is not covered here, follow the closest analogous rule rather than
> inventing a new pattern.
>
> **Read this before writing any UI code. Re-read the “Forbidden” section before
> shipping.** The most common failure mode is not ugliness — it is *genericness*, and
> genericness arrives at least as often through repetition as through decoration.

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

- **IBM Carbon** — the grammar. The product runs on Granite, targets IBM mainframes and
  is submitted to an IBM challenge; the interface speaks the same language as the stack
  underneath it. Square corners, a hairline grid, one interactive blue.
- **Resend** — the restraint, and only at the fold. A badge, a headline, one line, two
  actions, and a single very quiet object. Nothing else competes.
- **Linear** — the discipline. One sentence, then a real product surface. Every section
  earns its place.
- **Stripe docs** — density without noise: how much information can sit on one screen
  when the hierarchy is exact.

What we take from all four: **the product itself is the best visual**. No abstract
illustration will ever beat a real trace with real line numbers.

---

## 2. Forbidden — check this list before every commit

These are not preferences. Each one actively damages the positioning.

**Colour and surface**
- ❌ Purple→pink or blue→purple gradients. The signature of an AI template.
- ❌ Glassmorphism, frosted panels, blurred translucent cards.
- ❌ Neumorphism, soft-UI, embossed buttons.
- ❌ **The interactive blue (`--interactive`) used as a data colour.** It means "this is
  interactive, or this is selected". A kind of entity is never blue for that reason;
  that is what the categorical hues are for.
- ❌ A semantic colour used decoratively. If you cannot say what a colour *asserts*,
  use `--text-primary`, `--text-secondary` or `--text-helper` (see §3.2).
- ❌ Gradient text. Ever.
- ❌ Colour on a headline. Display type is monochrome — colour on a headline is the
  single loudest template tell.
- ❌ Rainbow borders, animated gradient borders, "aurora" backgrounds.

**Shape and ornament**
- ❌ **Any non-zero border-radius**, except a genuinely circular indicator: a status dot,
  an avatar, a spinner, a count badge. Everything else is square (§5.2).
- ❌ **Any elevation shadow.** Carbon separates by layer and by a 1px rule (§5.3).
- ❌ Floating 3D blobs, spheres, abstract meshes, liquid metal, shader backgrounds.
- ❌ Stock developer photography, illustrated mascots, isometric people.
- ❌ Emoji as section iconography (🚀 ✨ 💡 as headings).
- ❌ "Powered by AI" / "AI-first" badges. The product demonstrates it; the page does not
  announce it.

**Repetition**
- ❌ The same layout component three times in a row. Four consecutive sections built from
  the same row table is how this page became unreadable the first time, without a single
  ugly pixel in it. Two uses of a shape is a rhythm; four is wallpaper.
- ❌ Two product screenshots side by side. At half width the line numbers they exist to
  prove are illegible; ship one at full width instead.
- ❌ A figure that restates what the block above it already showed.

**Typography**
- ❌ Inter, Roboto, Open Sans, Lato, Poppins, Montserrat. Overexposed; they read as
  "template" to exactly the audience we want.
- ❌ Serif anywhere except display type — H1 and H2. Never body, never labels, never UI.
- ❌ Letter-spacing on body text.
- ❌ A reading column wider than 72ch. The grid is full-width; the text is not.

**Motion**
- ❌ Parallax scrolling.
- ❌ Elements that fly in from off-screen.
- ❌ Anything that loops forever in the periphery.
- ❌ Scroll-jacking, scroll-driven full-page transitions, and **scroll captured in a div**:
  the public page is a document and must scroll natively.
- ❌ Counters that count up on scroll. Our numbers are measured, not animated.
- ❌ Glow. Carbon has none. A lit element gets a 1px ring, not a halo.

**Copy**
- ❌ "Revolutionary", "game-changing", "seamlessly", "effortlessly", "unlock", "empower".
- ❌ Exclamation marks.
- ❌ Any number that is not literally true and reproducible from the repository.
- ❌ A figure caption that claims more than its image shows.

---

## 3. Colour

### 3.1 Tokens

Declare every colour once, as a CSS custom property on `:root` in `web/src/styles.css`.
No hard-coded hex anywhere else in the codebase. **This block is shared by the public
page and the workshop** — retinting here retints both, which is the point.

```css
:root {
  /* surfaces — Carbon Gray 100 */
  --bg:        #161616;
  --layer-01:  #262626;
  --layer-02:  #393939;
  --layer-03:  #525252;
  --border-subtle: #393939;
  --border-strong: #6f6f6f;

  /* text — four steps, never more */
  --text-primary:   #f4f4f4;
  --text-secondary: #c6c6c6;
  --text-helper:    #8d8d8d;
  --text-on-color:  #ffffff;

  /* interaction — never a data colour */
  --interactive: #0f62fe;
  --link:        #78a9ff;
  --focus:       #ffffff;

  /* semantic — meaning only, never decoration */
  --graph:    #33b1ff;
  --vector:   #08bdba;
  --reason:   #be95ff;
  --verified: #42be65;
  --danger:   #fa4d56;

  /* families */
  --m: "IBM Plex Mono", ui-monospace, Menlo, monospace;
  --s: "IBM Plex Sans", system-ui, sans-serif;
  --d: "IBM Plex Serif", Georgia, serif;

  /* motion */
  --fast: 110ms;
  --base: 240ms;
  --slow: 400ms;
  --ease-productive: cubic-bezier(.2, 0, .38, .9);
  --ease-expressive: cubic-bezier(.4, .14, .3, 1);
}
```

Fills use `--interactive` with `--text-on-color` on top. Text and links use `--link`:
`#0f62fe` as a foreground on `#161616` is 3.4:1 and fails.

### 3.2 The colour contract

This is the rule that keeps the interface readable at a glance, and it is absolute:

> **A colour is a claim about meaning.** If you cannot say what a colour *asserts*,
> use `--text-primary`, `--text-secondary` or `--text-helper`.

| Token | Asserts | Appears on |
|---|---|---|
| `--interactive` | *this is interactive, or this is what you selected* | primary button, active tab rule, selection, lit node ring, focus |
| `--link` | the same, as text | links, kickers, tool names in a trace |
| `--graph` | *this comes from the deterministic graph* | graph RAG, `graph_lookup`, structural relationships |
| `--vector` | *this comes from semantic search* | vector RAG, `search_code`, similarity scores |
| `--reason` | *this is the model reasoning* | the `think` step, trace lines authored by the agent |
| `--verified` | *this was verified / granted* | verified-sources badge, audit chain intact, additions in a diff |
| `--danger` | *this breaks / was denied* | impact radius, RBAC refusal, deletions in a diff |

Consequences you must respect:

- **The interactive blue is not in the entity palette.** In the estate graph a program is
  cyan and a copybook is purple; blue means *you clicked this*. If a kind of thing were
  also blue, selection would stop being readable.
- Never use `--danger` for a decorative heading, nor `--verified` for a generic success
  toast that has nothing to do with verification.
- **Never colour a metric.** A number is not made important by tinting it; if it matters,
  it is large. Carbon's display weight for figures is 300.
- Two accents never touch. If `--graph` and `--vector` sit side by side, they are
  contrasting two retrieval paths — legitimate. Side by side for variety: delete one.

### 3.3 Contrast floors

On `--bg` (`#161616`):

| Token | Measured | Floor |
|---|---|---|
| `--text-primary` `#f4f4f4` | 16.45:1 | ≥ 7:1 |
| `--text-secondary` `#c6c6c6` | 10.59:1 | ≥ 7:1 |
| `--text-helper` `#8d8d8d` | 5.45:1 | ≥ 4.5:1 |
| `--link` `#78a9ff` | 7.68:1 | ≥ 4.5:1 |
| `--graph` `#33b1ff` | 7.65:1 | ≥ 4.5:1 |
| `--vector` `#08bdba` | 7.75:1 | ≥ 4.5:1 |
| `--reason` `#be95ff` | 7.70:1 | ≥ 4.5:1 |
| `--verified` `#42be65` | 7.57:1 | ≥ 4.5:1 |
| `--danger` `#fa4d56` | 5.40:1 | ≥ 4.5:1 |

`--text-on-color` `#ffffff` on `--interactive` `#0f62fe` is 5.00:1.

`--text-secondary` carries body copy and every section lead. `--text-helper` is for text
that may be missed: labels, counters, metadata. **Never for a sentence the reader must
read** — that was the previous system's most damaging habit.

---

## 4. Typography

### 4.1 Families

Three, all IBM Plex. The typeface is an argument: the product runs on IBM Granite,
targets IBM mainframes, and is submitted to an IBM challenge.

- `--s` **IBM Plex Sans** — everything human, and every UI surface.
- `--m` **IBM Plex Mono** — everything machine.
- `--d` **IBM Plex Serif** — display type only: H1 and H2, nothing else.

**The mono rule** — mono is not a style, it is a signal. Use `--m` if and only if the
string is *produced or consumed by a machine*:

- ✅ identifiers (`LGPOLICY`, `lgacdb01.cbl:88`), tool names (`graph_lookup()`),
  commands, env vars, HTTP status, figure labels.
- ❌ headings, body copy, button labels, card descriptions, section kickers.

**The serif rule** — the serif is the display voice and appears nowhere else. A serif
used once, on one line, reads as a header pasted in from another site; a serif that
carries both heading levels reads as a decision.

### 4.2 Scale

| Role | Size / line-height | Weight | Family | Notes |
|---|---|---|---|---|
| Hero | `clamp(40px, 6vw, 76px)` / 1.04 | 400, second line 600 | `--d` | `letter-spacing: -.012em`, two lines, deliberate `<br />` |
| H2 | `clamp(28px, 3vw, 40px)` / 1.14 | 400 | `--d` | `letter-spacing: -.01em`, max 20ch |
| H3 / card title | 16 / 1.4 | 600 | `--s` | |
| Hero lead | 18 / 1.55 | 400 | `--s` | `--text-secondary`, max 46ch |
| Section lead | 16.5 / 1.6 | 400 | `--s` | `--text-secondary`, max 62ch |
| Body | 14 / 1.6 | 400 | `--s` | `--text-secondary`, max 72ch |
| Kicker | 12 / 1 | 600 | `--s` | `--link`, 3px left rule, sentence case |
| Label | 12.5 / 1.5 | 400 | `--s` | `--text-helper` |
| Code | 11.5–12 / 1.55 | 400 | `--m` | inside `--layer-02` |
| Metric | 40 / 1 | **300** | `--s` | `letter-spacing: -.01em`, never coloured |

**The ratio matters more than any single size.** H1÷H2 is **1.9×**. It was 3.9× — an 82px
hero over 21px headings — and that single number is why every section below the fold
read as a footnote regardless of what it said.

Carbon uses light weights for display, so 300 is correct for figures. Weights in use:
300 (metrics), 400 (display and body), 600 (emphasis, card titles, kickers).

### 4.3 Copy rules

- Headings: sentence case, no trailing period unless the heading is a full sentence
  making an argument (`Understanding ≠ changing.` keeps its period; `The problem` does not).
- One idea per sentence. If a sentence needs a semicolon to survive, split it.
- Numbers always with their unit and their source: *"11 programs"*, not *"11"*.
- Em dashes for asides, never parentheses stacked inside parentheses.
- French is allowed **nowhere** in user-visible strings. The jury is international.
  (Internal test names and code comments are exempt; the repository's tests are French.)

---

## 5. Space, shape, elevation

### 5.1 Spacing scale

Carbon's steps: `2 · 4 · 8 · 12 · 16 · 24 · 32 · 40 · 48 · 64 · 80 · 96`.

Section rhythm: `64px` vertical padding, `32px` horizontal gutter, content capped at
`1440px`. The hero takes `104px` at the top — the silence above the headline is the
single most Resend thing on the page, and confidence reads as space.

`gap: 1px` is not spacing. It is how a hairline grid draws its rules: the container takes
`background: var(--border-subtle)` and the cells take `background: var(--bg)`.

*The workshop keeps its own tighter optical spacing.* It is a dense IDE chrome, and
Carbon's own product surfaces do the same in dense contexts.

### 5.2 Radius

**Zero. Everywhere.**

The single exception is an element that is genuinely a circle: a status dot, an avatar,
a spinner, a count badge. Those take `99px`. A brand mark that happens to be square is
square; a colour swatch is square.

There is no concentric radius rule any more, because there are no radii to nest.

### 5.3 Borders and elevation

- **1px `--border-subtle` is the separator.** It does all the work.
- **No shadows.** Not on cards, not on floating panels, not on the modal. Carbon
  distinguishes by layer: `--bg` → `--layer-01` → `--layer-02` → `--layer-03`. A panel
  that floats gets a border and a higher layer, and that is enough.
- A highlighted element takes `border-color: var(--interactive)` and a
  `rgba(15, 98, 254, .12)` fill. Nothing else.
- A selected row takes `box-shadow: inset 3px 0 0 var(--interactive)` — a left rule, not
  an elevation.
- **Blue carries far less than amber did at the same alpha.** A tint below `.12` on
  `#161616` is invisible; do not copy alpha values from a warmer palette.

---

## 6. Motion

Motion exists to explain causality — *this happened because of that*. Motion that exists
to delight is noise here.

Use the tokens; do not write a duration by hand. `--fast` for hover, focus and toggles;
`--base` for a panel opening or a tab switching; `--slow` for a viewport re-frame.
`--ease-productive` for interface response, `--ease-expressive` for anything that moves
a distance.

Rules:

- Only `opacity`, `transform`, `border-color`, `background-color` animate. Never `height`,
  `width`, `top`, `left` — they jank and they read as cheap.
- Nothing animates on page load except a single content fade.
- Nothing loops except: the agent spinner, the caret, and the pulse on nodes the agent is
  currently touching. All stop the instant the work stops.
- **`prefers-reduced-motion: reduce` is one global rule** in `styles.css`, not a
  per-selector list that new code keeps forgetting to join. It sets
  `animation-duration`, `animation-iteration-count`, `transition-duration` and
  `scroll-behavior`. Part of the audience uses it; it is not optional.

### 6.1 The signature moment

The estate graph greying out and lighting up entity by entity while the agent retrieves
is **the single most valuable frame in the product**. No competitor has it.

Design rules for it:

- Un-touched nodes go to `opacity: .05` — nearly gone, still spatially present, so the
  reader keeps the map in their head.
- Touched nodes return to full opacity with a ring: `box-shadow: 0 0 0 1px var(--interactive)`.
  The ring contracts once on arrival so the eye catches which node just lit up. **No glow.**
- Edges between two lit nodes animate; everything else stays static.
- The viewport re-frames to the lit set over `--slow`, once, at the end — not per node.
- During the initial wait (no nodes lit yet) the graph stays **fully readable**. A greyed
  screen during a six-second wait reads as a freeze, not as thinking. The public page's
  fold shows exactly this state.

---

## 7. Components

### 7.1 Buttons

```
btn-pri   background var(--interactive) · color var(--text-on-color) · radius 0
btn       background var(--layer-01) · color var(--text-primary) · border 1px var(--border-subtle) · radius 0
```

- Exactly **one** `btn-pri` per viewport. Two primaries means neither is primary.
- The pair sits at `gap: 1px`, so the two read as one control with a dominant half.
- Hover: `btn` → `border-color: var(--layer-03)`; `btn-pri` → `#0353e9` (Carbon blue-70).
- A primary action carries a trailing `→`.
- Disabled: `opacity: .45`, cursor default, no colour change.

### 7.2 Focus

One global rule, on `:focus-visible`, covering every interactive element in both the page
and the workshop:

```css
outline: 2px solid var(--focus);
outline-offset: -2px;
box-shadow: inset 0 0 0 3px var(--interactive);
```

Never `outline: none` without a replacement. Three workshop inputs did exactly that, and
the product had no visible keyboard focus at all until it was found.

### 7.3 Cards and grids

A grid is a hairline grid: container `gap: 1px` on `background: var(--border-subtle)`,
cells on `background: var(--bg)`, one `1px` border around the whole. Padding `24px`.
Never more than one accent colour per cell.

`grid-template-columns: repeat(N, 1fr)` with N ∈ {2, 3, 4}. Below 900px every grid
collapses to a single column — no intermediate 2-up breakpoint, it always looks accidental.

### 7.4 Code wells and traces

`background --layer-02 · border 1px --border-subtle · radius 0 · padding 12/16 · font --m 11.5/1.55`

A trace line reads `time · tool · summary`: the timestamp in `--text-helper`, the tool in
its semantic colour (§3.2), the summary in `--text-secondary`. Alignment between lines
matters more than colour here.

### 7.5 Metric tiles

Number in `--s` at 40px weight 300, label underneath in Label style. **Never coloured,
never animated.** They sit in a hairline grid, not in cards.

### 7.6 Inputs

`background --layer-02 · border 1px --border-subtle · radius 0 · padding 8/12 · color --text-primary`
Focus: the global ring (§7.2). Placeholder in `--text-helper`, and it must say something
useful ("we send one confirmation link, nothing else"), never repeat the label.

### 7.7 Badges and tags

```
badge-ok    --verified text, rgba(66,190,101,.14) fill, 3px left rule --verified
badge-warn  --danger equivalent
tag         --text-secondary text, 1px --border-subtle, radius 0, font --m 10/uppercase
```

A badge states a verified fact (`✓ 11 sources verified`). A tag classifies (`read-only`).
Never use a badge for decoration.

### 7.8 Tables

Header: Label style, `--text-helper`, bottom border `--border-subtle`. Rows:
`--text-secondary`, bottom border `--layer-02`. Emphasised cell content in
`--text-primary`. Description columns capped at 72ch. No zebra striping, no vertical rules.

### 7.9 Modal

Scrim `rgba(0,0,0,.6)`, panel `--layer-01`, radius 0, **no shadow**, border 1px
`--border-subtle`, width 400–470px. Closes on scrim click and on Escape. Focus moves to
the first input on open and returns to the trigger on close.

---

## 8. Page composition

### 8.1 The fold

Four elements, and this is the one place the rule is a hard count:

1. **Kicker** — a short topic, `--link`, 3px left rule.
2. **H1** — two lines in `--d`, with a deliberate break.
3. **Lead** — one sentence, two lines at most, 46ch.
4. **Actions** — one `btn-pri`, one `btn`.

Then, still above the fold, **the estate at rest**: real entities, dim, wide, bleeding off
the right edge. It is the product before the agent runs, not an illustration of it, and
it is readable rather than greyed — the trace below is what greys and lights up, and the
two states must not say the same thing.

The measured numbers **leave the fold** and sit in a hairline strip immediately below it.
The real reasoning trace follows. Nothing else belongs in the first screen.

### 8.2 Section rhythm

Alternate `--bg` and `--layer-01` bands so the eye can count sections without scrolling
back. Every section carries, in order:

1. **Kicker** — `NN — Topic`. **The number is derived from the section's index**, never
   typed into a prop. It drifted to `00 01 02 03 04 05 06 10 07 08 09 11` when it was a
   string, and a reader following the page in order saw a bug before they saw the argument.
2. **H2** — one assertion, not a noun phrase. *"Understanding ≠ changing."* beats
   *"Our approach"*.
3. **Lead** — one paragraph, ≤ 62ch, that could stand alone as the section's summary.
4. **Evidence** — a grid, a code well, a trace, a flow, or one full-width plate.
   **Never the same evidence shape as either neighbour** (§2, Repetition).

### 8.3 Product plates

- One per section, at full width. Never two side by side.
- Regenerated with `make shots`, never by hand. A plate taken by hand becomes a picture
  of a product that no longer exists the moment anything is retinted.
- **The caption must claim exactly what the image shows** — the entity, and the number.
  If the plate shows LGCMAREA reaching 25 programs, the caption does not say LGPOLICY
  and 11.

---

## 9. Accessibility

Non-negotiable, and cheap:

- Every interactive element reachable by keyboard, in DOM order.
- `:focus-visible` styled globally (§7.2). Test by tabbing the whole page once.
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
- Fonts: locally served IBM Plex, via `@fontsource`.
- Icons: inline SVG, `currentColor`, no icon font, no sprite sheet.
- Two stylesheets: `styles.css` (tokens, reset, primitives, workshop) and
  `components/landing.css` (the public page). New rules go in their section, never
  appended at the bottom.
- **The public page scrolls in the document.** The workshop shell sizes itself with
  `height: 100vh`; nothing pins the body.
- Every component that renders data a juror might verify (counts, node totals, test
  numbers) reads it from **one** constant, never a literal in JSX.
- Structural guarantees are tested, not remembered: `web/e2e/landing.spec.ts` guards
  native scroll, the numbering sequence, the absence of hand-written product data, and
  the four-element fold.

---

## 11. Working method for the agent

1. **Read the product first.** Open the running app before designing a page about it.
   Screenshots of the real workshop beat any illustration you could compose.
2. **Design the evidence, then the frame.** Decide which real artefact proves the section
   (a trace, a plate, a count), then build the layout around it.
3. **Write the copy before the CSS.** If the sentence is vague, no styling will save it.
4. **Every number is a claim.** Before shipping a number, run the command that produces it.
   Four different test counts were live in this repository at once, and none was right.
5. **Delete one thing per section.** If a section survives the deletion, it was noise.
6. **Count your shapes.** Before committing a section, look at its two neighbours. Three
   of the same block in a row is the failure mode this system is most prone to.
7. **Check against §2 before committing.** Genericness creeps in through small additions.

---

## 12. Pre-ship checklist

- [ ] No forbidden pattern from §2 present anywhere.
- [ ] `grep -rn "border-radius" web/src | grep -v 99px | grep -v ": 0"` is empty.
- [ ] `grep -rn "box-shadow" web/src | grep -vE "0 0 0 1px|inset"` is empty.
- [ ] Exactly one `btn-pri` per viewport.
- [ ] Every colour on the page can be justified by §3.2, and none of them is a metric.
- [ ] No section shares its evidence shape with either neighbour.
- [ ] Section numbers read `00`…`11` with no gap.
- [ ] Tab through the entire page: focus is always visible, order is logical.
- [ ] `prefers-reduced-motion: reduce` removes every animation and the node pulse.
- [ ] 200% zoom: no horizontal scrollbar.
- [ ] Fonts blocked: layout stable, nothing overlaps.
- [ ] Every metric matches the README **and the repository** to the digit.
- [ ] Every plate was produced by `make shots`, and its caption matches what it shows.
- [ ] No French, no emoji ornament, no exclamation mark in user-visible copy.
- [ ] Read the page aloud. If a sentence embarrasses you, rewrite it.
