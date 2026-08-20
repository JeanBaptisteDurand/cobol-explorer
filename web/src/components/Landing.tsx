import { Icon } from "./Icons";

/** Public home page — the submission deck, rebuilt as a long-scroll SaaS landing.
 *  Same argument and same order as docs/presentation.html: the stake, challenge fit,
 *  the two gestures, the agent, the Bob/MCP complementarity, the two RAGs, a real
 *  trace, governance, the IBM stack. A juror who never opens the deck still gets it. */

const PROOF = [
  { n: "169", label: "automated tests" },
  { n: "2", label: "real mainframe estates" },
  { n: "1 496", label: "entities mapped" },
  { n: "30 s", label: "instead of days of manual hunting" },
];

const PROBLEM = [
  { t: "The experts are retiring", d: "Knowledge leaves faster than it is passed on. The last person who knew why retired last year." },
  { t: "No reliable documentation", d: "The only trustworthy specification is the code itself — and it runs to millions of lines." },
  { t: "Fear of touching anything", d: "A copybook shared by 25 programs: changing one field without knowing the blast radius is a production incident." },
  { t: "Regulators demand proof", d: "EU DORA and national banking regulators: prove which rule applies, where it lives, and who touched it." },
];

const VERBS = [
  { verb: "Plan", title: "Exhaustive impact", body: "“Changing this copybook breaks these 11 programs and these 2 batch chains” — a deterministic traversal, not a plausible sample." },
  { verb: "Coordinate", title: "Team versioning", body: "Every change lives in an isolated branch: affected owners, review, conflict resolution, merge gate." },
  { verb: "Decide", title: "Grounded answers", body: "Every fact is cited to file:line and re-verified against the source before it reaches you." },
  { verb: "Execute", title: "Governed merge", body: "Propose → measure → approve → merge, with an HMAC-chained audit trail that detects tampering." },
];

const TOOLS = [
  { n: "think", c: "var(--purple)", d: "Reasons out loud before each action — the “why” behind the tool choice, captured in the trace." },
  { n: "graph_lookup", c: "var(--blue)", d: "Graph RAG — summary, impact, lineage, callers, callees, neighbors. Deterministic, no model in the loop." },
  { n: "search_code", c: "var(--teal)", d: "Vector RAG — semantic search over the estate, 768-dim IBM Granite embeddings." },
  { n: "read_source_lines", c: "var(--dim)", d: "Reads the exact source lines — the raw material of every file:line citation." },
  { n: "web_search", c: "var(--dim)", d: "External context only: regulation, business definitions." },
  { n: "propose_change", c: "var(--amber)", d: "Creates a git version and computes its impact — the bridge to the “change” gesture." },
];

const BOB_HAS = [
  "reads, greps, opens, follows a CALL or a COPY on demand",
  "understands COBOL and reasons about what it reads",
  "orchestrates — it decides when to call a tool",
];
const MCP_ADDS = [
  "the exhaustive transitive closure, pre-computed — instead of re-deriving it token by token on every prompt",
  "the scheduler chains, which live in no readable file — they come from the scheduler export, joined into the graph",
  "the file:line citation, systematic and deterministic every single time",
];
const BOB_TOOLS = ["graph_lookup", "search_code", "read_source_lines"];

const RAGS = [
  {
    accent: "var(--blue)", icon: "🕸", title: "Graph RAG — Neo4j",
    sub: "exact, traceable structure · 339 nodes / 421 edges",
    items: [
      "Deterministic traversal — built by parsing the code, no model in the loop",
      "Impact, data lineage, call chains, functional profile",
      "Every edge carries its evidence: the line of the COPY / CALL / EXEC SQL",
    ],
    q: "“Which programs break if I change LGPOLICY?”",
    a: "→ 11 programs · jobs DAILYPOL·POLRPT · chains SDAILYPOL·SPOLRPT",
  },
  {
    accent: "var(--teal)", icon: "◎", title: "Vector RAG — pgvector",
    sub: "semantic, by intent · PostgreSQL + HNSW cosine",
    items: [
      "IBM Granite embeddings (granite-embedding:278m, 768 dimensions)",
      "Find things when you don't know the name: concepts, intent, business language",
      "Wired into the agent, the ⌘P palette and the MCP server",
    ],
    q: "“Where is the logging?” (no name known)",
    a: "→ LGSTSQ 0.64 · LGWEBST5 0.55 · LGSETUP 0.55",
  },
];

const TRACE = [
  { e: "trace", c: "var(--purple)", t: "💭 think", d: "“search semantically first, then profile through the graph”" },
  { e: "trace", c: "var(--teal)", t: "search_code", d: "(query=policy inquiry) → 5 results lgipol01.cbl" },
  { e: "trace", c: "var(--blue)", t: "graph_lookup", d: "(op=summary, node=LGIPOL01) → 2 copybooks · 2 calls · 4 transactions" },
  { e: "trace", c: "var(--blue)", t: "graph_lookup", d: "(op=impact, node=LGPOLICY) → 11 programs, 2 batch chains" },
  { e: "answer", c: "var(--tx)", t: "answer", d: "business function + 11 programs, each with its line" },
  { e: "verify", c: "var(--green)", t: "✓ verify", d: "every file:line citation re-checked against the corpus" },
];

const GOVERNANCE = [
  { t: "🛡 Anti-hallucination guardrail", d: "After every answer the server re-verifies each citation against the corpus — does the file exist, is the line in range. A plausible but ungrounded answer never passes silently." },
  { t: "⛓ Tamper-evident audit log", d: "Every action — and every refusal — is appended to an HMAC-SHA256 chain. Altering one line breaks the chain, and the UI says so." },
  { t: "👥 Role-based access control", d: "Sign-in issues a signed token carrying your role, so a forged header promotes nobody. Proposing ≠ merging ≠ auditing." },
  { t: "📊 Quality measured, not assumed", d: "A golden Q/A set scored on entity recall, citation grounding and impact coverage — run in CI, so a quality regression breaks the build." },
];

const FLOW = [
  { n: "1", t: "New version", d: "a real git branch, isolated from the estate" },
  { n: "2", t: "Edit", d: "one commit per change, author recorded" },
  { n: "3", t: "Impact", d: "recomputed at every edit: programs, jobs, chains" },
  { n: "4", t: "Diff & review", d: "a real git diff plus team comments" },
  { n: "5", t: "Merge gate", d: "“this touches 11 programs — confirm?” + RBAC", hl: true },
];

const STACK = [
  { name: "IBM Granite", tag: "LLM", detail: "The agent's brain — self-hosted via Ollama, or granite-4-h-small on watsonx.ai. Same model family, your choice of where it runs." },
  { name: "IBM Granite Embedding", tag: "Vector RAG", detail: "Semantic search over the estate, so you can ask by intent when you don't know the program name." },
  { name: "BeeAI", tag: "Agent", detail: "The ReAct loop: the agent picks its own tools and logs why — which is what makes the reasoning auditable." },
  { name: "IBM watsonx.ai", tag: "Cloud", detail: "granite-4-h-small in Dallas — the hosted backend serving this deployment, about 6 s per agent answer." },
];

function Section({ id, kicker, title, sub, alt, children }: {
  id: string; kicker?: string; title: React.ReactNode; sub?: string; alt?: boolean; children: React.ReactNode;
}) {
  return (
    <section className={`lp-sec ${alt ? "lp-alt" : ""}`} data-testid={id}>
      <div className="lp-inner">
        {kicker && <div className="lp-kicker sm">{kicker}</div>}
        <div className="lp-h2">{title}</div>
        {sub && <p className="lp-sub">{sub}</p>}
        {children}
      </div>
    </section>
  );
}

export default function Landing({ onSignIn, onSignUp }: { onSignIn: () => void; onSignUp: () => void }) {
  return (
    <div className="landing sb" data-testid="landing">
      <header className="lp-nav">
        <div className="lp-brand"><span className="sq" /><span className="nm">COBOL Explorer</span></div>
        <div style={{ flex: 1 }} />
        <span className="lp-badge">IBM AI Builders Challenge · Wildcard</span>
        <span className="btn" data-testid="nav-signin" onClick={onSignIn}>Sign in</span>
        <button className="btn-pri lp-cta" data-testid="nav-signup" onClick={onSignUp}>Create account</button>
      </header>

      <section className="lp-hero">
        <div className="lp-kicker">Intelligent systems for the future of work</div>
        <h1>The AI workshop for the code<br />the world still runs on.</h1>
        <p className="lp-lead">
          200+ billion lines of COBOL run banks, insurers and public services. Understanding them is still
          manual, expert-dependent guesswork — and “we found 8 of the 14 impacted programs” is a production
          incident. COBOL Explorer maps the whole estate into a dependency graph and answers questions in
          plain language, <b>grounded to the exact source line</b>.
        </p>
        <div className="lp-actions">
          <button className="btn-pri lp-cta" data-testid="hero-signup" onClick={onSignUp}>Enter the workshop →</button>
          <span className="btn" data-testid="hero-signin" onClick={onSignIn}>I already have an account</span>
        </div>
        <div className="lp-proof">
          {PROOF.map((p) => (
            <div key={p.label}><div className="lp-num">{p.n}</div><div className="lp-plabel">{p.label}</div></div>
          ))}
        </div>
      </section>

      <Section id="problem-section" alt kicker="01 · The problem"
        title="Billions of lines of COBOL, and no one left to read them."
        sub="Generic AI assistants answer — but without proof. On a bank's estate, a plausible-but-wrong answer is worse than no answer at all.">
        <div className="lp-grid4">
          {PROBLEM.map((c) => (
            <div className="lp-card" key={c.t}><div className="lp-ctitle">{c.t}</div><p>{c.d}</p></div>
          ))}
        </div>
      </Section>

      <Section id="verbs-section" kicker="02 · Challenge fit — Future of Work"
        title="Disconnected tasks → one governed system."
        sub="Not only for COBOL developers. The people who carry the risk of a change and cannot read the code — risk, compliance, audit — get the same grounded answers, in their own language.">
        <div className="lp-grid4">
          {VERBS.map((v) => (
            <div className="lp-card" key={v.verb}>
              <div className="lp-verb">{v.verb}</div>
              <div className="lp-ctitle">{v.title}</div>
              <p>{v.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="gestures-section" alt kicker="03 · The founding principle"
        title="Understanding ≠ changing."
        sub="The product keeps the two apart on purpose. One has no side effects by construction; the other never reaches the estate without an explicit confirmation.">
        <div className="lp-grid2">
          <div className="lp-card">
            <div className="lp-tag">read-only</div>
            <div className="lp-ctitle">🔎 Understand</div>
            <p>Browse, ask, analyse — without ever altering the estate. The agent reads the code, walks the graph
              and cites the source line for every claim.</p>
            <div className="lp-code">
              <span style={{ color: "var(--purple)" }}>think</span> “where is the premium computed?”<br />
              <span style={{ color: "var(--teal)" }}>search_code</span> → MAJORER-PRIME <span style={{ color: "var(--amber)" }}>lgipol01.cbl:50</span><br />
              <span style={{ color: "var(--green)" }}>✓ sources verified</span>
            </div>
          </div>
          <div className="lp-card lp-hi">
            <div className="lp-tag" style={{ color: "var(--amber)", borderColor: "var(--amber-d)" }}>isolated version</div>
            <div className="lp-ctitle">✍️ Change</div>
            <p>Every change lives in a real git branch — one commit per edit, a real diff. Impact computed first,
              team review, then the merge gate.</p>
            <div className="lp-code">
              <span style={{ color: "var(--green)" }}>+ 05 PREMIUM PIC 9(7)V99.</span><br />
              <span style={{ color: "var(--red)" }}>− 05 PREMIUM PIC 9(6)V99.</span><br />
              <span style={{ color: "var(--amber)" }}>⚠ merge gate — touches 11 programs. Confirm?</span>
            </div>
          </div>
        </div>
        <div className="lp-flow">
          {FLOW.map((f) => (
            <div className={`lp-st ${f.hl ? "hl" : ""}`} key={f.n}>
              <div className="lp-stn">{f.n}</div>
              <div className="lp-stt">{f.t}</div>
              <div className="lp-std">{f.d}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="agent-section" kicker="04 · The heart of the product"
        title="One agent, six tools, a traceable path."
        sub="A BeeAI RequirementAgent on IBM Granite. The model decides the order of the tools; every call is logged and audited, and a think step records why before each one.">
        <div className="lp-grid3">
          {TOOLS.map((t) => (
            <div className="lp-card" key={t.n}>
              <div className="lp-mono" style={{ color: t.c }}>{t.n}()</div>
              <p>{t.d}</p>
            </div>
          ))}
        </div>
        <div className="lp-loop">
          <span>Question</span><i>→</i><span className="on">💭 think</span><i>→</i><span>tool</span><i>→</i>
          <span>observe</span><i>→ ⟳ →</i><span className="on">Answer + citations + ✓ verification</span>
        </div>
      </Section>

      <Section id="bob-section" alt kicker="05 · Complementarity · MCP → IBM Bob"
        title={<><Icon name="graph" size={17} color="var(--amber)" /> Bob reads the code. MCP hands it the estate already computed.</>}
        sub="COBOL Explorer doesn't just use an AI — it extends one. Bob reads and reasons over code very well already, and this does not replace that. It hands Bob a symbol table, a call graph and data lineage computed once, offline — so Bob stops re-deriving everything on every question, and gains what lives in no file it could read.">
        <div className="lp-grid2">
          <div className="lp-card">
            <div className="lp-ctitle" style={{ color: "var(--blue)" }}>🤖 What Bob already does — very well</div>
            <ul className="lp-ul">{BOB_HAS.map((x) => <li key={x}><span style={{ color: "var(--blue)" }}>✓</span> {x}</li>)}</ul>
          </div>
          <div className="lp-card lp-hi">
            <div className="lp-ctitle" style={{ color: "var(--amber)" }}>🕸 What MCP adds on top</div>
            <ul className="lp-ul">{MCP_ADDS.map((x) => <li key={x}><span style={{ color: "var(--green)" }}>✓</span> {x}</li>)}</ul>
          </div>
        </div>
        <div className="lp-grid3" style={{ marginTop: 15 }}>
          {BOB_TOOLS.map((t) => (
            <div className="lp-card" key={t}>
              <div className="lp-mono">{t}()</div>
              <p>Exposed to IBM Bob over the Model Context Protocol — drop <code>.bob/mcp.json</code> into the
                workspace and the tool appears inside Bob.</p>
            </div>
          ))}
        </div>
        <div className="lp-note">
          <b>The LSP analogy</b> — an IDE gives developers “go-to-definition” and “find-references” through an LSP.
          Not because they cannot read, but because re-deriving those links by hand is expensive. COBOL Explorer plays
          that role for Bob — cross-language (COBOL + JCL + DB2 + scheduler), across the whole estate.
        </div>
      </Section>

      <Section id="rag-section" kicker="06 · Retrieval-augmented generation"
        title="Two complementary RAGs, self-hosted."
        sub="The agent routes between them: the graph when the answer must be exact and exhaustive, the vector index when you don't know the name of what you're looking for.">
        <div className="lp-grid2">
          {RAGS.map((r) => (
            <div className="lp-card" key={r.title} style={{ borderTop: `3px solid ${r.accent}` }}>
              <div className="lp-ctitle"><span style={{ color: r.accent }}>{r.icon}</span> {r.title}</div>
              <div className="lp-sublabel">{r.sub}</div>
              <ul className="lp-ul">{r.items.map((i) => <li key={i}><span style={{ color: "var(--faint)" }}>›</span> {i}</li>)}</ul>
              <div className="lp-code">{r.q}<br /><b style={{ color: "var(--tx)" }}>{r.a}</b></div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="trace-section" alt kicker="07 · The reasoning path, for real"
        title="Every answer arrives with its reasoning."
        sub="A real product trace, streamed event by event over SSE. While it runs, the graph greys out and the entities the agent retrieves light up one by one.">
        <div className="lp-trace">
          {TRACE.map((t, i) => (
            <div key={i}>
              <span className="ev">event:</span> <span className="et">{t.e}</span>
              <b style={{ color: t.c }}>{t.t}</b> <span>{t.d}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section id="governance-section" kicker="08 · Traceability &amp; governance"
        title="Every answer proven, every action audited."
        sub="This is what decides whether a regulated organisation can put an AI anywhere near its core systems.">
        <div className="lp-grid2">
          {GOVERNANCE.map((g) => (
            <div className="lp-card" key={g.t}><div className="lp-ctitle">{g.t}</div><p>{g.d}</p></div>
          ))}
        </div>
      </Section>

      <Section id="ibm-section" alt kicker="09 · A 100% IBM AI layer"
        title="Built on IBM, designed for Bob."
        sub="No competing model anywhere in the pipeline: the reasoning, the embeddings and the hosted inference are all IBM.">
        <div className="lp-grid2">
          {STACK.map((s) => (
            <div className="lp-card" key={s.name}>
              <div className="lp-tag">{s.tag}</div>
              <div className="lp-ctitle">{s.name}</div>
              <p>{s.detail}</p>
            </div>
          ))}
        </div>
      </Section>

      <footer className="lp-foot">
        <div>
          <b style={{ color: "var(--tx)" }}>Days of manual impact hunting → 30 seconds, with line-level proof.</b>
          <div style={{ marginTop: 6 }}>Demo estates: GenApp (insurance) · CardDemo (credit cards). Apache-2.0.</div>
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn-pri lp-cta" data-testid="foot-signup" onClick={onSignUp}>Create account →</button>
      </footer>
    </div>
  );
}
