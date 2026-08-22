import type { ReactNode } from "react";
import EstateAtRest from "./EstateAtRest";
import SectionIndex, { SECTIONS, pad } from "./SectionIndex";
import Logo from "./Logo";
import ReasoningTrace from "./ReasoningTrace";
import "./landing.css";

/** Public home page — the argument, in the order a sceptical reader needs it:
 *  the instrument first (a real reasoning trace), then the problem, the two
 *  gestures, the agent, the two RAGs, the Bob/MCP complementarity, governance,
 *  the IBM stack. A juror who never opens the deck still gets it.
 *
 *  Product screenshots carry the claims: each plate sits in the section it proves,
 *  and lives in web/public/shots/. */

const METRICS = [
  { n: "6.5 s", l: "per grounded answer\ngranite-4-h-small · watsonx.ai" },
  // Comma, not the French thin space: the page is in English, and "1 496" reads
  // as two numbers to the reader it is written for. 339 + 1157 and 421 + 1294,
  // the two estates added.
  { n: "1,496", l: "entities mapped\n1,715 typed edges" },
  { n: "200", l: "automated tests\n151 backend · 49 e2e" },
  { n: "2", l: "real estates analysed\nIBM GenApp · AWS CardDemo" },
];

const PROBLEM: Array<{ t: string; d: ReactNode }> = [
  { t: "The experts are retiring", d: "Knowledge leaves faster than it is passed on. The last person who knew why retired last year, and the reason went with them." },
  { t: "No reliable documentation", d: "The only trustworthy specification is the code itself, and it runs to millions of lines across five languages no single tool reads together." },
  { t: "Fear of touching anything", d: <>One copybook, <span className="ce-mono-sm">LGPOLICY</span>, is copied by 11 programs and reaches 2 batch chains. Changing a field without knowing that is a gamble.</> },
  { t: "Regulators demand proof", d: "EU DORA and national banking supervisors: prove which rule applies, where it lives, and who touched it. A screenshot of a chat is not evidence." },
];

const PIPELINE = [
  { n: "Step 1", t: "New version", d: "a real git branch, isolated from the estate" },
  { n: "Step 2", t: "Edit", d: "one commit per change, author recorded" },
  { n: "Step 3", t: "Impact", d: "recomputed at every edit: programs, jobs, chains" },
  { n: "Step 4", t: "Diff & review", d: "a real git diff plus team comments" },
  { n: "Step 5", t: "Merge gate", d: "“this touches 11 programs — confirm?” plus RBAC", gate: true },
];

/** The four acts of e2e/governance.spec.ts, which plays this scenario in a browser
 *  with three real accounts. Every claim below is a test that has to pass. */
const COWORK = [
  { who: "Sofia", role: "risk", t: "proposes, in isolation",
    d: "She opens a version — a real git branch off the estate — edits a copybook, and the impact of her change is recomputed as she types: the programs, the jobs, the chains." },
  { who: "Sofia", role: "risk", t: "is refused the merge",
    d: "Her role may propose and may not apply. The refusal is not a disabled button: the server says no, and writes the attempt to the audit trail under her name." },
  { who: "Amine", role: "dev", t: "reviews, comments, merges",
    d: "He reads the diff, leaves a comment on the version, and passes the merge gate — which states the blast radius out loud and asks him to confirm it before anything touches main." },
  { who: "Marc", role: "auditor", t: "can change nothing, and sees everything",
    d: "He may propose no version at all, and he reads the complete chain: who asked what, who edited what, who was refused, and whether the chain is still intact." },
];

const TOOLS = [
  { n: "think", c: "var(--reason)", cls: "reason", d: "Reasons out loud before each action — the “why” behind the tool choice, captured in the trace." },
  { n: "graph_lookup", c: "var(--graph)", cls: "graph rag", d: "Summary, impact, lineage, callers, callees, neighbours. Deterministic traversal, no model in the loop." },
  { n: "search_code", c: "var(--vector)", cls: "vector rag", d: "Semantic search over the estate, 768-dimension IBM Granite embeddings, for when the name is unknown." },
  { n: "read_source_lines", c: "var(--text-primary)", cls: "evidence", d: "Reads the exact source lines. The raw material of every file:line citation the answer carries." },
  { n: "web_search", c: "var(--text-secondary)", cls: "external", d: "External context only: regulation, business definitions. Never the estate itself." },
  { n: "propose_change", c: "var(--interactive)", cls: "write", d: "Creates a git version and computes its impact — the single bridge from understanding to changing." },
];

/** Verbatim from .bob/mcp.json — a config a reader copies has to be the real one. */
const CLONE = `git clone https://github.com/JeanBaptisteDurand/cobol-explorer
cd cobol-explorer
make setup`;

/** Verbatim .bob/mcp.json — including `env`. The abridged version published here
 *  first was not a shorter way of saying the same thing: without PYTHONPATH the
 *  server module is not importable and `python -m mcp_server.server` exits before
 *  it speaks. A snippet a reader pastes has to be the one that works. */
const MCP_JSON = `{
  "mcpServers": {
    "cobol-explorer": {
      "command": "\${workspaceFolder}/.venv/bin/python",
      "args": ["-m", "mcp_server.server"],
      "cwd": "\${workspaceFolder}",
      "env": {
        "PYTHONPATH": "\${workspaceFolder}/packages/core:\${workspaceFolder}/ingestion:\${workspaceFolder}/server",
        "COBOL_EXPLORER_GRAPH": "\${workspaceFolder}/graph.json",
        "COBOL_EXPLORER_CORPUS": "\${workspaceFolder}/corpora"
      }
    }
  }
}`;

const BOB_HAS = [
  "reads, greps, opens, follows a CALL or a COPY on demand",
  "understands COBOL and reasons about what it reads",
  "orchestrates — it decides when to call a tool",
];

const MCP_ADDS: ReactNode[] = [
  "the exhaustive transitive closure, pre-computed instead of re-derived token by token on every prompt",
  "the scheduler chains, which live in no readable file — they come from the scheduler export, joined into the graph",
  <>the <span className="ce-mono-sm">file:line</span> citation, systematic and deterministic every single time</>,
];

const GOVERNANCE = [
  { tag: "Verified", c: "var(--verified)", t: "Anti-hallucination guardrail", d: "After every answer the server re-verifies each citation against the corpus: does the file exist, is the line in range. An ungrounded answer never passes silently — the panel labels it." },
  { tag: "Audited", c: "var(--graph)", t: "Tamper-evident audit log", d: "Every action, and every refusal, is appended to an HMAC-SHA256 chain. Altering one line breaks the chain, and the panel says so." },
  { tag: "Scoped", c: "var(--reason)", t: "Role-based access control", d: "Sign-in issues a signed token carrying your role, so a forged header promotes nobody. Proposing, merging and auditing are three different rights. Passwords are never stored — PBKDF2-HMAC-SHA256, 120,000 iterations, per-account salt." },
  { tag: "Measured", c: "var(--danger)", t: "Quality, not assumption", d: "A golden question set scored on entity recall, citation grounding and impact coverage, run in CI — so a quality regression breaks the build rather than reaching a demo." },
];

const STACK = [
  { l: "Reasoning", t: "IBM Granite", d: "The agent's brain. Self-hosted via Ollama so the estate never leaves the machine, or granite-4-h-small on watsonx.ai." },
  { l: "Embeddings", t: "Granite Embedding", d: "768-dimension semantic search over the estate, so you can ask by intent when the program name is unknown." },
  { l: "Orchestration", t: "BeeAI", d: "The ReAct loop: the agent picks its own tools and logs why, which is what makes the reasoning auditable." },
  { l: "Inference", t: "IBM watsonx.ai", d: "granite-4-h-small in Dallas, the hosted backend serving this deployment. 6.5 s per answer against 30-40 s on CPU." },
];

const VERBS = [
  { v: "Plan", t: "Exhaustive impact", d: "A deterministic traversal, not a plausible sample." },
  { v: "Coordinate", t: "Team versioning", d: "Isolated branches, affected owners, review, merge gate." },
  { v: "Decide", t: "Grounded answers", d: "Every fact cited to file:line and re-verified at the source." },
  { v: "Execute", t: "Governed merge", d: "Propose, measure, approve, merge — on a chained audit trail." },
];


const FIT = [
  { t: "Plan", d: "Exhaustive impact: “this copybook breaks these 11 programs and these 2 batch chains” — a deterministic traversal, never a plausible sample." },
  { t: "Coordinate", d: "Team versioning on real git branches: the owners actually affected, review, conflict resolution, a merge gate." },
  { t: "Decide", d: "Grounded answers, every fact cited to file:line and re-verified against the source before it reaches the screen." },
  { t: "Execute", d: "A governed merge — propose, measure, approve, apply — recorded in a hash-chained audit trail." },
];

const IDENTITY = [
  { t: "Signed sessions", d: "Sign-in mints an HS256 token carrying the role; PBKDF2 password hashing, 120,000 iterations, salted per account. The demo headers stop being trusted the moment real auth is on." },
  { t: "Confirmed addresses", d: "Sign-up sends a single-use link over plain SMTP from the estate's own domain — no third-party mail service. Until it is clicked, signing in is refused." },
  { t: "Continue with IBM", d: "An OIDC authorization-code flow through IBM Cloud App ID. The token comes back in the URL fragment, so it never reaches a server log, and a federated sign-in gets the least privileged role that is still useful." },
  { t: "Roles that bite", d: "Seven actions across six roles. An auditor reads and audits; only dev and architect may merge — and the refusal is written to the log like everything else." },
];

const BUILT = [
  { t: "Plan before code", d: "A brainstorming skill settles requirements and design before a line is written, so the spec is the artefact and the code follows it." },
  { t: "Test before implementation", d: "A TDD skill writes the failing test first. It is why this repository carries 151 backend tests instead of a happy-path demo." },
  { t: "Simplify after", d: "A cleanup skill re-reads the diff for duplication and dead code. It removed a dead helper, an MCP parameter that filtered nothing, and a hard-coded path that broke the Bob integration on any other machine." },
];

/** The number comes from the section's position, never from a string a writer
 *  types. The previous version took it from the kicker prop and had drifted to
 *  00 01 02 03 04 05 06 10 07 08 09 11 — a reader following the page in order
 *  saw a bug before they saw the argument. */
function Section({ id, title, lead, alt, children }: {
  id: string; title: string; lead?: ReactNode; alt?: boolean; children?: ReactNode;
}) {
  const n = SECTIONS.findIndex((s) => s.id === id);
  const topic = SECTIONS[n].topic;
  return (
    <section id={id} className={`ce-sec ${alt ? "is-alt" : ""}`} data-testid={id}>
      <div className="ce-inner">
        <span className="ce-kicker">{pad(n)} — {topic}</span>
        <h2 className="ce-h2">{title}</h2>
        {lead && <p className="ce-lead">{lead}</p>}
        {children}
      </div>
    </section>
  );
}

function Figure({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  return (
    <figure style={{ margin: 0 }}>
      {/* width/height are the capture size: they reserve the space before the
          image arrives, so lazy loading cannot shift what is below it — which is
          what made anchored navigation land in the wrong place. */}
      <div className="ce-shot">
        <img src={src} alt={alt} loading="lazy" decoding="async" width={2880} height={1800} />
      </div>
      <figcaption className="ce-cap">{caption}</figcaption>
    </figure>
  );
}

/** The public front door and /presentation are the same page.
 *
 *  Someone already inside the workshop who wants the argument — to send it to a
 *  colleague, or to remind themselves what the thing claims — should not meet a
 *  second, drifting copy of it. Only the two calls to action change: a visitor is
 *  asked to sign in, a signed-in reader is offered the way back. */
export default function Landing({
  onSignIn,
  onSignUp,
  mode = "public",
  onBack,
}: {
  onSignIn: () => void;
  onSignUp: () => void;
  mode?: "public" | "presentation";
  onBack?: () => void;
}) {
  const inside = mode === "presentation";
  return (
    <div className="ce-landing" data-testid={inside ? "presentation" : "landing"}>
      <header className="ce-nav">
        <a className="ce-mark" href="#top" aria-label="COBOL Explorer — top of page">
          <Logo size={26} title="COBOL Explorer" />
        </a>
        <span className="ce-spacer" />
        <SectionIndex />
        {inside ? (
          <button className="ce-btn-pri ce-nav-cta" data-testid="back-to-workshop" onClick={onBack}>
            Back to the workshop
          </button>
        ) : (
          <>
            <button className="ce-btn" data-testid="nav-signin" onClick={onSignIn}>Sign in</button>
            <button className="ce-btn-pri ce-nav-cta" data-testid="nav-signup" onClick={onSignUp}>Create account</button>
          </>
        )}
      </header>

      {/* HERO — four elements and nothing else. Everything the page has to prove
          comes after; the fold only has to make the reader want it. Underneath
          sits the estate at rest, which is the product before the agent runs —
          not an illustration, and readable rather than greyed, because during a
          wait a greyed screen reads as a freeze instead of as thinking. */}
      <section className="ce-hero" data-testid="hero-section" id="top">
        <div className="ce-inner">
          <span className="ce-kicker">Grounded agentic RAG · mainframe-native graph</span>
          <h1>Ask the estate.<br /><b>Get the proof.</b></h1>
          <p className="ce-hero-lead">
            Every answer cited to the exact source line, across COBOL, JCL, CICS, DB2 and the scheduler.
          </p>
          <div className="ce-hero-actions">
            {inside ? (
              <button className="ce-btn-pri" data-testid="hero-back" onClick={onBack}>Back to the workshop</button>
            ) : (
              <button className="ce-btn-pri" data-testid="hero-signup" onClick={onSignUp}>Enter the workshop</button>
            )}
            <a className="ce-btn" href="#fig01">Watch it reason</a>
          </div>
        </div>
        <EstateAtRest />
      </section>

      {/* The measured numbers leave the fold. A hairline grid, no cards: in Carbon
          the rule does the separating. */}
      <div className="ce-metrics">
        {METRICS.map((m) => (
          <div className="ce-metric" key={m.n}>
            <div className="ce-metric-n">{m.n}</div>
            <div className="ce-metric-l" style={{ whiteSpace: "pre-line" }}>{m.l}</div>
          </div>
        ))}
      </div>

      <div id="fig01"><ReasoningTrace /></div>

      <Section id="product-section" alt
        title="An IDE for an estate nobody can read."
        lead="Activity bar, explorer, tabbed editor, agent panel. A developer knows where everything is on the first click, and a risk officer can follow the same trail without reading a line of COBOL.">
        <Figure src="/shots/sc-apercu.png"
          alt="The COBOL Explorer workshop: explorer tree, estate overview tab, and the agent panel"
          caption="Fig 01 · the workshop · GenApp insurance estate" />
      </Section>

      <Section id="problem-section"
        title="Billions of lines, and no one left to read them."
        lead="Generic assistants answer without proof. On a bank's core systems a plausible-but-wrong answer is worse than no answer, because nobody can tell the difference until production tells them.">
        <div className="ce-rows">
          {PROBLEM.map((p, i) => (
            <div className="ce-row" key={p.t}>
              <span className="ce-row-n">{String(i + 1).padStart(2, "0")}</span>
              <span className="ce-row-t">{p.t}</span>
              <span className="ce-row-d">{p.d}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 32 }}>
          <Figure src="/shots/sc-impact.png"
            alt="The graph with the impact radius of LGCMAREA drawn in red: 25 impacted programs, each named"
            caption="Fig 02 · impact radius · LGCMAREA reaches 25 programs, drawn in red" />
        </div>
      </Section>

      <Section id="gestures-section" alt
        title="Understanding ≠ changing."
        lead="The product keeps the two gestures apart on purpose. One has no side effects by construction. The other never reaches the estate without an explicit, recorded confirmation.">
        <div className="ce-grid2">
          <div className="ce-card">
            <span className="ce-tag">read-only</span>
            <div className="ce-card-t">Understand</div>
            <p>Browse, ask, analyse without ever altering the estate. Read-only by construction, not by policy.</p>
            <div className="ce-code">
              <span style={{ color: "var(--reason)" }}>think</span> “where is the premium computed?”<br />
              <span style={{ color: "var(--vector)" }}>search_code</span> → MAJORER-PRIME{" "}
              <span style={{ color: "var(--interactive)" }}>lgipol01.cbl:50</span><br />
              <span style={{ color: "var(--verified)" }}>✓ 3 sources verified</span>
            </div>
          </div>
          <div className="ce-card is-hi">
            <span className="ce-tag is-accent">isolated branch</span>
            <div className="ce-card-t">Change</div>
            <p>Every edit lives in a real git branch. Impact is computed before review, and the merge gate states the blast radius out loud.</p>
            <div className="ce-code">
              <span style={{ color: "var(--verified)" }}>+ 05 PREMIUM PIC 9(7)V99.</span><br />
              <span style={{ color: "var(--danger)" }}>− 05 PREMIUM PIC 9(6)V99.</span><br />
              <span style={{ color: "var(--interactive)" }}>merge gate — touches 11 programs. Confirm?</span>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 32 }}>
          <Figure src="/shots/sc-merge.png"
            alt="The merge gate: a change-set with its diff, impact and review state before merging"
            caption="Fig 03 · change · the change record, its measured impact and the merge gate" />
        </div>
        <div className="ce-pipe">
          {PIPELINE.map((s) => (
            <div className={`ce-pipe-st ${s.gate ? "is-gate" : ""}`} key={s.n}>
              <div className="ce-pipe-n">{s.n}</div>
              <div className="ce-pipe-t">{s.t}</div>
              <div className="ce-pipe-d">{s.d}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="cowork-section"
        title="A change is a proposal, not an edit."
        lead="One person changing a copybook alone is how estates break. The work is split the way a team actually works — someone proposes, someone else reviews, and the system refuses whoever is not entitled — and every branch knows what the rest of the team merged while it was open.">
        <div className="ce-rows">
          {COWORK.map((c, i) => (
            <div className="ce-row" key={i}>
              <span className="ce-row-n">{String(i + 1).padStart(2, "0")}</span>
              <span className="ce-row-t">
                {c.who} <span className="ce-mono-sm" style={{ color: "var(--text-helper)" }}>{c.role}</span>
                <div style={{ font: "400 13px var(--s)", color: "var(--text-secondary)", marginTop: 3 }}>{c.t}</div>
              </span>
              <span className="ce-row-d">{c.d}</span>
            </div>
          ))}
        </div>

        <div className="ce-grid2" style={{ marginTop: 32 }}>
          <div className="ce-card">
            <span className="ce-tag">branch state</span>
            <div className="ce-card-t">Every version knows what it is missing</div>
            <p>
              A branch that has been open while the team merged is behind, and says so —
              <span className="ce-mono-sm"> 3 commits behind main</span>. Importing that work is one
              action, and the impact is recomputed against the estate as it is now, not as it was
              when the branch was cut.
            </p>
          </div>
          <div className="ce-card">
            <span className="ce-tag">conflict</span>
            <div className="ce-card-t">Two people on the same lines is a question, not a crash</div>
            <p>
              When both sides touched the same lines the merge stops and asks: keep mine, or take
              the team's. Whichever you pick, the other file's changes are still imported — and the
              decision lands in the audit trail like everything else.
            </p>
          </div>
        </div>

        <p className="ce-fine">
          This is the part that turns a clever tool into something a bank can put people on. It is
          also the part that is easiest to claim and hardest to prove, so it is played end to end in
          the browser with three separate accounts on every run.
        </p>
      </Section>

      <Section id="agent-section"
        title="One agent, six tools, every call on the record."
        lead={<>A BeeAI RequirementAgent on IBM Granite. The model chooses the order of the tools; the server logs each one, and a <span className="ce-mono-in" style={{ color: "var(--reason)" }}>think</span> step records why before every call. That log is what makes the reasoning auditable rather than merely plausible.</>}>
        <div>
          <div className="ce-thead">
            <span style={{ width: 178, flex: "none" }}>Tool</span>
            <span style={{ width: 96, flex: "none" }}>Class</span>
            <span style={{ flex: 1 }}>Behaviour</span>
          </div>
          {TOOLS.map((t) => (
            <div className="ce-trow" key={t.n}>
              <span className="ce-tname" style={{ color: t.c }}>{t.n}()</span>
              <span className="ce-tclass">{t.cls}</span>
              <span className="ce-tdesc">{t.d}</span>
            </div>
          ))}
        </div>
        <div className="ce-loop">
          <span>question</span><i>→</i>
          <span style={{ color: "var(--reason)" }}>think</span><i>→</i>
          <span>tool</span><i>→</i>
          <span>observe</span><i>→ ⟳ →</i>
          <span className="is-accent">answer + citations + verify</span>
        </div>
      </Section>

      <Section id="rag-section" alt
        title="Two RAGs, because one is never enough."
        lead="The agent routes between them: the graph when the answer must be exact and exhaustive, the vector index when you don't know the name of what you are looking for. Neither is a substitute for the other.">
        <div className="ce-grid2">
          <div className="ce-card">
            <div className="ce-rag-head">
              <span className="ce-swatch" style={{ background: "var(--graph)" }} aria-hidden="true" />
              <span className="ce-card-t">Graph RAG</span>
              <span className="ce-spacer" />
              <span className="ce-rag-eng">Neo4j</span>
            </div>
            <p>Deterministic traversal, built by parsing the code. No model in the loop, so the same question always
              returns the same closure. Impact, data lineage, call chains, functional profile. Every edge carries its
              evidence — the line of the COPY, CALL or EXEC SQL that produced it.</p>
            <div className="ce-code">
              “which programs break if I change LGPOLICY?”<br />
              <span style={{ color: "var(--text-primary)" }}>→ 11 programs · jobs DAILYPOL·POLRPT</span><br />
              <span style={{ color: "var(--text-primary)" }}>→ chains SDAILYPOL·SPOLRPT</span>
            </div>
          </div>
          <div className="ce-card">
            <div className="ce-rag-head">
              <span className="ce-swatch" style={{ background: "var(--vector)" }} aria-hidden="true" />
              <span className="ce-card-t">Vector RAG</span>
              <span className="ce-spacer" />
              <span className="ce-rag-eng">pgvector · HNSW</span>
            </div>
            <p>IBM Granite embeddings — granite-embedding:278m, 768 dimensions, cosine similarity. Finds things when
              you don't know the name: concepts, intent, business language. Wired into the agent, the ⌘P palette and
              the MCP server alike.</p>
            <div className="ce-code">
              “where is the logging?” — no name known<br />
              <span style={{ color: "var(--text-primary)" }}>→ LGSTSQ 0.64 · LGWEBST5 0.55</span><br />
              <span style={{ color: "var(--text-primary)" }}>→ LGSETUP 0.55</span>
            </div>
          </div>
        </div>
      </Section>

      <Section id="bob-section"
        title="Bob reads the code. MCP hands it the estate already computed."
        lead="COBOL Explorer doesn't just use an AI, it extends one. Bob reads and reasons over code very well already, and this does not replace that. It hands Bob a symbol table, a call graph and data lineage computed once, offline — so Bob stops re-deriving everything on every prompt, and gains what lives in no file it could read.">
        <div className="ce-grid2">
          <div className="ce-card">
            <div className="ce-card-t" style={{ color: "var(--graph)", marginBottom: 14 }}>What Bob already does, very well</div>
            <ul className="ce-ul">
              {BOB_HAS.map((x) => (
                <li key={x}><span className="ce-mark" style={{ color: "var(--graph)" }}>✓</span>{x}</li>
              ))}
            </ul>
          </div>
          <div className="ce-card is-hi">
            <div className="ce-card-t" style={{ color: "var(--interactive)", marginBottom: 14 }}>What MCP adds on top</div>
            <ul className="ce-ul">
              {MCP_ADDS.map((x, i) => (
                <li key={i}><span className="ce-mark" style={{ color: "var(--verified)" }}>✓</span><span>{x}</span></li>
              ))}
            </ul>
          </div>
        </div>
        <div className="ce-chips">
          <span>Exposed over MCP:</span>
          <span className="ce-chip">graph_lookup</span>
          <span className="ce-chip">search_code</span>
          <span className="ce-chip">read_source_lines</span>
        </div>

        {/* The page claimed three tools were exposed and never said how to reach
            them. It is a stdio server, so it runs beside the estate on your own
            machine — which is the constraint and also the point. */}
        <div id="connect-bob" className="ce-setup">
          <div className="ce-setup-head">
            <span className="ce-kicker">Connect your own Bob</span>
            <p className="ce-setup-lead">
              The server speaks MCP over stdio, so it runs on your machine, beside the estate it
              reads. Nothing about your code leaves it — which is why a bank can run this at all.
              Three commands, and the tools are inside Bob.
            </p>
          </div>
          <div className="ce-setup-steps">
            <div>
              <span className="ce-setup-n">01</span>
              <div>
                <div className="ce-setup-t">Clone it beside your estate</div>
                <pre className="ce-code">{CLONE}</pre>
              </div>
            </div>
            <div>
              <span className="ce-setup-n">02</span>
              <div>
                <div className="ce-setup-t">Point it at your COBOL</div>
                <p>
                  Drop your sources under <span className="ce-mono-sm">corpora/</span> and run{" "}
                  <span className="ce-mono-sm">make ingest</span>. It parses COBOL, JCL, CICS, DB2 and
                  the scheduler export into the graph the tools traverse. The two demo estates are
                  already there if you would rather try it first.
                </p>
              </div>
            </div>
            <div>
              <span className="ce-setup-n">03</span>
              <div>
                <div className="ce-setup-t">Open the folder in Bob</div>
                <p>
                  <span className="ce-mono-sm">.bob/mcp.json</span> is already in the repository, so
                  Bob finds the server on its own. Ask it what breaks if you change a copybook and it
                  calls <span className="ce-mono-sm">graph_lookup</span> instead of guessing from the
                  files it happened to open.
                </p>
              </div>
            </div>
          </div>
          {/* Full width, below the three steps rather than inside the third: the
              real entry carries an env block, and in a 380px column every path in
              it wrapped mid-token. A configuration has to be readable to be
              trusted, and this one is what actually starts the server. */}
          <div className="ce-setup-foot">
            <div className="ce-setup-t">Only if your client keeps its MCP servers elsewhere</div>
            <pre className="ce-code">{MCP_JSON}</pre>
          </div>
        </div>
        <div className="ce-note">
          <div className="ce-kicker">The LSP analogy</div>
          <p>An IDE gives developers go-to-definition and find-references through an LSP — not because they cannot
            read, but because re-deriving those links by hand is expensive.{" "}
            <span className="ce-strong">COBOL Explorer plays that role for Bob</span>, cross-language and across the
            whole estate.</p>
        </div>
      </Section>

      <Section id="governance-section" alt
        title="Every answer proven, every action audited."
        lead="This is what decides whether a regulated organisation can put an AI anywhere near its core systems. It is not a feature list; it is the precondition.">
        <div className="ce-rows">
          {GOVERNANCE.map((g) => (
            <div className="ce-gov-row" key={g.t}>
              <span className="ce-gov-tag" style={{ color: g.c }}>{g.tag}</span>
              <div className="ce-gov-main">
                <div className="ce-gov-t">{g.t}</div>
                <p className="ce-gov-d">{g.d}</p>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 26 }}>
          <Figure src="/shots/sc-audit.png"
            alt="The audit panel: a chained log of actions and refusals, with the chain integrity state"
            caption="Fig 04 · the audit trail, chain state included" />
        </div>
      </Section>

      <Section id="ibm-section"
        title="Built on IBM, designed for Bob."
        lead="No competing model anywhere in the pipeline: the reasoning, the embeddings and the hosted inference are all IBM.">
        <div className="ce-grid4 ce-stack">
          {STACK.map((s) => (
            <div key={s.t}>
              <div className="ce-stack-l">{s.l}</div>
              <div className="ce-stack-t">{s.t}</div>
              <p className="ce-stack-d">{s.d}</p>
            </div>
          ))}
        </div>
        <div className="ce-grid4 ce-stack" style={{ marginTop: 34 }}>
          {VERBS.map((v) => (
            <div key={v.v}>
              <div className="ce-stack-l is-accent">{v.v}</div>
              <div className="ce-stack-t">{v.t}</div>
              <p className="ce-stack-d">{v.d}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="fit-section"
        title="Disconnected tasks, turned into one governed system."
        lead="The Wildcard asks for intelligent systems that cut repetitive work, improve decisions and get teams to an outcome faster. Maintaining a mainframe estate is the work that never received that treatment.">
        {/* The four Wildcard verbs, as a grid: they are four peers, not an
            ordered list, and the row table was already this page's most reused
            shape. */}
        <div className="ce-grid4 ce-verbs">
          {FIT.map((f) => (
            <div className="ce-verb" key={f.t}>
              <div className="ce-verb-t">{f.t}</div>
              <p className="ce-verb-d">{f.d}</p>
            </div>
          ))}
        </div>
        <p className="ce-fine">
          Not only for COBOL developers. The people who carry the risk of a change and cannot read the code — risk,
          compliance, audit — get the same grounded answers in their own language, from the same estate. That is the
          part that makes it a system rather than a tool.
        </p>
      </Section>

      <Section id="identity-section" alt
        title="Who is asking, proven — not declared."
        lead="Governance is only worth the identity behind it. Sign-in issues a signed token that carries your role, so a forged header promotes nobody, and every action lands in the audit trail under a name that was verified.">
        <div className="ce-rows">
          {IDENTITY.map((f, i) => (
            <div className="ce-row" key={f.t}>
              <span className="ce-row-n">{String(i + 1).padStart(2, "0")}</span>
              <span className="ce-row-t">{f.t}</span>
              <span className="ce-row-d">{f.d}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section id="built-section"
        title="Built with IBM Bob — spec first, not vibes."
        lead="The July lab teaches spec-driven development with Bob rather than vibe coding: describe the intent, let the agent plan, review the plan, then implement. Reusable skills kept that discipline on every unit of work.">
        <div className="ce-grid3 ce-verbs">
          {BUILT.map((f) => (
            <div className="ce-verb" key={f.t}>
              <div className="ce-verb-t">{f.t}</div>
              <p className="ce-verb-d">{f.d}</p>
            </div>
          ))}
        </div>
        <p className="ce-fine">
          The loop closes: Bob helped build the tool that now extends Bob. The same three tools are exposed back to it
          over MCP, so a developer inside Bob can ask what breaks and get an exhaustive, grounded answer.
        </p>
      </Section>

      <Section id="access-section" alt
        title="Days of manual hunting, down to 6.5 seconds — with line-level proof."
        lead="Your role travels inside a signed token: it decides what you may read, propose and merge, and every action is written to the tamper-evident audit trail under your name.">
        <div className="ce-access-actions">
          {inside ? (
            <>
              <button className="ce-btn-pri" onClick={onBack}>Back to the workshop</button>
              <span className="ce-demo">you are signed in — this page is the argument, not the door</span>
            </>
          ) : (
            <>
              <button className="ce-btn-pri" data-testid="foot-signup" onClick={onSignUp}>Create account</button>
              <button className="ce-btn" data-testid="hero-signin" onClick={onSignIn}>Sign in</button>
              <span className="ce-demo">demo account: amine / demo · roles dev · architect · risk · auditor</span>
            </>
          )}
        </div>
      </Section>

      <footer className="ce-foot">
        <Logo size={18} />
        <span>Demo estates: GenApp (insurance) · CardDemo (credit cards)</span>
        <span>Apache-2.0</span>
        <span className="ce-spacer" />
        {/* Provenance belongs at the end, next to the licence — not in the masthead. */}
        <span className="ce-foot-badge">IBM AI Builders Challenge · Wildcard</span>
        <span className="ce-foot-url">cobol-explorer.fr</span>
      </footer>
    </div>
  );
}
