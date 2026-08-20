import type { ReactNode } from "react";
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
  { n: "6.5 s", l: "per grounded answer\ngranite-4-h-small · watsonx.ai", accent: true },
  { n: "1 496", l: "entities mapped\n1 715 typed edges" },
  { n: "181", l: "automated tests\n146 backend · 35 e2e" },
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

const TOOLS = [
  { n: "think", c: "var(--purple)", cls: "reason", d: "Reasons out loud before each action — the “why” behind the tool choice, captured in the trace." },
  { n: "graph_lookup", c: "var(--blue)", cls: "graph rag", d: "Summary, impact, lineage, callers, callees, neighbours. Deterministic traversal, no model in the loop." },
  { n: "search_code", c: "var(--teal)", cls: "vector rag", d: "Semantic search over the estate, 768-dimension IBM Granite embeddings, for when the name is unknown." },
  { n: "read_source_lines", c: "var(--tx)", cls: "evidence", d: "Reads the exact source lines. The raw material of every file:line citation the answer carries." },
  { n: "web_search", c: "var(--dim)", cls: "external", d: "External context only: regulation, business definitions. Never the estate itself." },
  { n: "propose_change", c: "var(--amber)", cls: "write", d: "Creates a git version and computes its impact — the single bridge from understanding to changing." },
];

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
  { tag: "Verified", c: "var(--green)", t: "Anti-hallucination guardrail", d: "After every answer the server re-verifies each citation against the corpus: does the file exist, is the line in range. An ungrounded answer never passes silently — the panel labels it." },
  { tag: "Audited", c: "var(--blue)", t: "Tamper-evident audit log", d: "Every action, and every refusal, is appended to an HMAC-SHA256 chain. Altering one line breaks the chain, and the panel says so." },
  { tag: "Scoped", c: "var(--purple)", t: "Role-based access control", d: "Sign-in issues a signed token carrying your role, so a forged header promotes nobody. Proposing, merging and auditing are three different rights. Passwords are never stored — PBKDF2-HMAC-SHA256, 120 000 iterations, per-account salt." },
  { tag: "Measured", c: "var(--red)", t: "Quality, not assumption", d: "A golden question set scored on entity recall, citation grounding and impact coverage, run in CI — so a quality regression breaks the build rather than reaching a demo." },
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

function Section({ id, kicker, title, lead, alt, children }: {
  id: string; kicker: string; title: string; lead?: ReactNode; alt?: boolean; children?: ReactNode;
}) {
  return (
    <section className={`ce-sec ${alt ? "is-alt" : ""}`} data-testid={id}>
      <div className="ce-inner">
        <div className="ce-kicker">{kicker}</div>
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
      <div className="ce-shot"><img src={src} alt={alt} loading="lazy" /></div>
      <figcaption className="ce-cap">{caption}</figcaption>
    </figure>
  );
}

export default function Landing({ onSignIn, onSignUp }: { onSignIn: () => void; onSignUp: () => void }) {
  return (
    <div className="ce-landing sb" data-testid="landing">
      <header className="ce-nav">
        <a className="ce-brand" href="#top" aria-label="COBOL Explorer — home">
          <Logo size={22} />
          <span className="nm">COBOL Explorer</span>
        </a>
        <span className="ce-spacer" />
        <nav className="ce-nav-links" aria-label="Sections">
          <a href="#fig01">Reasoning</a>
          <a href="#bob-section">IBM Bob</a>
          <a href="#governance-section">Governance</a>
        </nav>
        <span className="ce-nav-rule" aria-hidden="true" />
        <button className="ce-btn" data-testid="nav-signin" onClick={onSignIn}>Sign in</button>
        <button className="ce-btn-pri ce-nav-cta" data-testid="nav-signup" onClick={onSignUp}>Create account</button>
      </header>

      {/* HERO — the instrument first: a real trace, above the fold. */}
      <section className="ce-hero" data-testid="hero-section" id="top">
        <div className="ce-inner ce-hero-grid">
          <div>
          <div className="ce-kicker">Grounded agentic RAG · mainframe-native graph</div>
          <h1>Ask the estate.<br />Get the proof.</h1>
          <p className="ce-lead">
            200+ billion lines of COBOL run the world's banks and insurers, and the work of understanding them is
            still manual. <span className="ce-strong">“We found 8 of the 14 impacted programs” is a production
            incident.</span> COBOL Explorer parses the whole estate — COBOL, JCL, CICS, DB2, scheduler — into a
            dependency graph, and answers in plain language with every claim cited to{" "}
            <span className="ce-mono-in">file:line</span>.
          </p>
          <div className="ce-hero-actions">
            <button className="ce-btn-pri" data-testid="hero-signup" onClick={onSignUp}>Enter the workshop</button>
            <a className="ce-btn" href="#fig01">Watch it reason</a>
          </div>
          </div>

          {/* The void on the right used to be decoration waiting to happen. It holds the
              answer instead: the exact output of the question in the headline. */}
          <aside className="ce-answer" aria-label="A grounded answer, as returned by the product">
            <div className="ce-answer-head">
              <span className="ce-answer-q">what breaks if I change <b>LGPOLICY</b>?</span>
            </div>
            <div className="ce-answer-body">
              <div className="ce-answer-line"><b>11 programs</b> and <b>2 batch chains</b> are impacted.</div>
              <ul className="ce-answer-cites">
                <li><span>LGACDB01</span><i>lgacdb01.cbl:88</i></li>
                <li><span>LGIPOL01</span><i>lgipol01.cbl:55</i></li>
                <li><span>LGBATCH</span><i>LGBATCH.cbl:19</i></li>
                <li className="is-more">+ 8 more, each with its COPY line</li>
              </ul>
              <div className="ce-answer-chains">
                <span className="ce-chip">DAILYPOL</span><span className="ce-chip">POLRPT</span>
                <span className="ce-chip is-sched">SDAILYPOL</span><span className="ce-chip is-sched">SPOLRPT</span>
              </div>
            </div>
            <div className="ce-answer-foot">
              <span className="ce-verified">✓ 11 sources verified</span>
              <span className="ce-answer-time">6.5 s</span>
            </div>
          </aside>
        </div>
        <div className="ce-inner">
          <div className="ce-metrics">
            {METRICS.map((m) => (
              <div key={m.n}>
                <div className={`ce-metric-n ${m.accent ? "is-accent" : ""}`}>{m.n}</div>
                <div className="ce-metric-l" style={{ whiteSpace: "pre-line" }}>{m.l}</div>
              </div>
            ))}
          </div>
        </div>
        <div id="fig01"><ReasoningTrace /></div>
      </section>

      <Section id="product-section" alt kicker="00 · The product"
        title="An IDE for an estate nobody can read."
        lead="Activity bar, explorer, tabbed editor, agent panel. A developer knows where everything is on the first click, and a risk officer can follow the same trail without reading a line of COBOL.">
        <Figure src="/shots/sc-apercu.png"
          alt="The COBOL Explorer workshop: explorer tree, estate overview tab, and the agent panel"
          caption="Fig 02 · the workshop · GenApp insurance estate" />
      </Section>

      <Section id="problem-section" kicker="01 · The problem"
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
        <div className="ce-grid2" style={{ marginTop: 26 }}>
          <Figure src="/shots/sc-impact.png"
            alt="The graph with the impact radius of LGPOLICY drawn in red: 11 impacted programs"
            caption="Fig 03 · impact radius · 11 impacted, drawn in red" />
          <Figure src="/shots/sc-champs.png"
            alt="Field-level impact for LGPOLICY: 85 fields, 62 referenced, each with a count of programs"
            caption="Fig 04 · field-level impact · 85 fields, 62 referenced" />
        </div>
      </Section>

      <Section id="gestures-section" alt kicker="02 · The founding principle"
        title="Understanding ≠ changing."
        lead="The product keeps the two gestures apart on purpose. One has no side effects by construction. The other never reaches the estate without an explicit, recorded confirmation.">
        <div className="ce-grid2">
          <div className="ce-card">
            <span className="ce-tag">read-only</span>
            <div className="ce-card-t">Understand</div>
            <p>Browse, ask, analyse without ever altering the estate. Read-only by construction, not by policy.</p>
            <div className="ce-code">
              <span style={{ color: "var(--purple)" }}>think</span> “where is the premium computed?”<br />
              <span style={{ color: "var(--teal)" }}>search_code</span> → MAJORER-PRIME{" "}
              <span style={{ color: "var(--amber)" }}>lgipol01.cbl:50</span><br />
              <span style={{ color: "var(--green)" }}>✓ 3 sources verified</span>
            </div>
          </div>
          <div className="ce-card is-hi">
            <span className="ce-tag is-accent">isolated branch</span>
            <div className="ce-card-t">Change</div>
            <p>Every edit lives in a real git branch. Impact is computed before review, and the merge gate states the blast radius out loud.</p>
            <div className="ce-code">
              <span style={{ color: "var(--green)" }}>+ 05 PREMIUM PIC 9(7)V99.</span><br />
              <span style={{ color: "var(--red)" }}>− 05 PREMIUM PIC 9(6)V99.</span><br />
              <span style={{ color: "var(--amber)" }}>merge gate — touches 11 programs. Confirm?</span>
            </div>
          </div>
        </div>
        <div className="ce-grid2" style={{ marginTop: 15 }}>
          <Figure src="/shots/sc-split.png"
            alt="Split view: the COBOL source on the left, the estate graph on the right"
            caption="Fig 05 · understand · source beside the graph" />
          <Figure src="/shots/sc-merge.png"
            alt="The merge gate: a change-set with its diff, impact and review state before merging"
            caption="Fig 06 · change · diff, impact and the merge gate" />
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

      <Section id="agent-section" kicker="03 · The agent"
        title="One agent, six tools, every call on the record."
        lead={<>A BeeAI RequirementAgent on IBM Granite. The model chooses the order of the tools; the server logs each one, and a <span className="ce-mono-in" style={{ color: "var(--purple)" }}>think</span> step records why before every call. That log is what makes the reasoning auditable rather than merely plausible.</>}>
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
          <span style={{ color: "var(--purple)" }}>think</span><i>→</i>
          <span>tool</span><i>→</i>
          <span>observe</span><i>→ ⟳ →</i>
          <span className="is-accent">answer + citations + verify</span>
        </div>
        <div style={{ marginTop: 26 }}>
          <Figure src="/shots/sc-agent.png"
            alt="The agent panel: a grounded answer with its tool-call trace and clickable file:line citations"
            caption="Fig 07 · a grounded answer, its trace and its citations" />
        </div>
      </Section>

      <Section id="rag-section" alt kicker="04 · Retrieval"
        title="Two RAGs, because one is never enough."
        lead="The agent routes between them: the graph when the answer must be exact and exhaustive, the vector index when you don't know the name of what you are looking for. Neither is a substitute for the other.">
        <div className="ce-grid2">
          <div className="ce-card">
            <div className="ce-rag-head">
              <span className="ce-swatch" style={{ background: "var(--blue)" }} aria-hidden="true" />
              <span className="ce-card-t">Graph RAG</span>
              <span className="ce-spacer" />
              <span className="ce-rag-eng">Neo4j</span>
            </div>
            <p>Deterministic traversal, built by parsing the code. No model in the loop, so the same question always
              returns the same closure. Impact, data lineage, call chains, functional profile. Every edge carries its
              evidence — the line of the COPY, CALL or EXEC SQL that produced it.</p>
            <div className="ce-code">
              “which programs break if I change LGPOLICY?”<br />
              <span style={{ color: "var(--tx)" }}>→ 11 programs · jobs DAILYPOL·POLRPT</span><br />
              <span style={{ color: "var(--tx)" }}>→ chains SDAILYPOL·SPOLRPT</span>
            </div>
          </div>
          <div className="ce-card">
            <div className="ce-rag-head">
              <span className="ce-swatch" style={{ background: "var(--teal)" }} aria-hidden="true" />
              <span className="ce-card-t">Vector RAG</span>
              <span className="ce-spacer" />
              <span className="ce-rag-eng">pgvector · HNSW</span>
            </div>
            <p>IBM Granite embeddings — granite-embedding:278m, 768 dimensions, cosine similarity. Finds things when
              you don't know the name: concepts, intent, business language. Wired into the agent, the ⌘P palette and
              the MCP server alike.</p>
            <div className="ce-code">
              “where is the logging?” — no name known<br />
              <span style={{ color: "var(--tx)" }}>→ LGSTSQ 0.64 · LGWEBST5 0.55</span><br />
              <span style={{ color: "var(--tx)" }}>→ LGSETUP 0.55</span>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 15 }}>
          <Figure src="/shots/sc-palette.png"
            alt="The command palette resolving a natural-language query into ranked estate entities"
            caption="Fig 08 · the same vector index, in the ⌘P palette" />
        </div>
      </Section>

      <Section id="bob-section" kicker="05 · MCP → IBM Bob"
        title="Bob reads the code. MCP hands it the estate already computed."
        lead="COBOL Explorer doesn't just use an AI, it extends one. Bob reads and reasons over code very well already, and this does not replace that. It hands Bob a symbol table, a call graph and data lineage computed once, offline — so Bob stops re-deriving everything on every prompt, and gains what lives in no file it could read.">
        <div className="ce-grid2">
          <div className="ce-card">
            <div className="ce-card-t" style={{ color: "var(--blue)", marginBottom: 14 }}>What Bob already does, very well</div>
            <ul className="ce-ul">
              {BOB_HAS.map((x) => (
                <li key={x}><span className="ce-mark" style={{ color: "var(--blue)" }}>✓</span>{x}</li>
              ))}
            </ul>
          </div>
          <div className="ce-card is-hi">
            <div className="ce-card-t" style={{ color: "var(--amber)", marginBottom: 14 }}>What MCP adds on top</div>
            <ul className="ce-ul">
              {MCP_ADDS.map((x, i) => (
                <li key={i}><span className="ce-mark" style={{ color: "var(--green)" }}>✓</span><span>{x}</span></li>
              ))}
            </ul>
          </div>
        </div>
        <div className="ce-chips">
          <span>Exposed over MCP:</span>
          <span className="ce-chip">graph_lookup</span>
          <span className="ce-chip">search_code</span>
          <span className="ce-chip">read_source_lines</span>
          <span>drop <span className="ce-mono-sm">.bob/mcp.json</span> into the workspace and the tools appear inside Bob.</span>
        </div>
        <div className="ce-note">
          <div className="ce-kicker">The LSP analogy</div>
          <p>An IDE gives developers go-to-definition and find-references through an LSP — not because they cannot
            read, but because re-deriving those links by hand is expensive.{" "}
            <span className="ce-strong">COBOL Explorer plays that role for Bob</span>, cross-language and across the
            whole estate.</p>
        </div>
      </Section>

      <Section id="governance-section" alt kicker="06 · Traceability and governance"
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
            caption="Fig 09 · the audit trail, chain state included" />
        </div>
      </Section>

      <Section id="ibm-section" kicker="07 · The IBM layer"
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
        <p className="ce-fine">
          Wildcard — Build Intelligent Systems for the Future of Work. Not only for COBOL developers: the people who
          carry the risk of a change and cannot read the code, in risk, compliance and audit, get the same grounded
          answers in their own language.
        </p>
      </Section>

      <Section id="access-section" alt kicker="08 · Access"
        title="Days of manual hunting, down to 6.5 seconds — with line-level proof."
        lead="Your role travels inside a signed token: it decides what you may read, propose and merge, and every action is written to the tamper-evident audit trail under your name.">
        <div className="ce-access-actions">
          <button className="ce-btn-pri" data-testid="foot-signup" onClick={onSignUp}>Create account</button>
          <button className="ce-btn" data-testid="hero-signin" onClick={onSignIn}>Sign in</button>
          <span className="ce-demo">demo account: amine / demo · roles dev · architect · risk · auditor</span>
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
