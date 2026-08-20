import { Icon } from "./Icons";

/** Public home page. A juror (or anyone) lands here before signing in: what the
 *  problem is, what the product does, which IBM pieces it runs on — then the door
 *  into the workshop. Content mirrors the README's five required sections. */

const VERBS = [
  { verb: "Plan", title: "Exhaustive impact", body: "“Changing this copybook breaks these N programs and these batch chains” — a deterministic graph traversal, not a plausible sample." },
  { verb: "Coordinate", title: "Team versioning", body: "Every change lives in an isolated version: affected owners, review, conflict resolution, merge gate." },
  { verb: "Decide", title: "Grounded answers", body: "Every fact the agent states is cited down to file:line, and re-verified against the source before you see it." },
  { verb: "Execute", title: "Governed merge", body: "Propose → measure impact → approve → merge, with an HMAC-chained audit trail that detects tampering." },
];

const STACK = [
  { name: "IBM Granite", detail: "the reasoning model behind every answer — self-hosted via Ollama, or hosted on watsonx.ai", tag: "LLM" },
  { name: "IBM Granite Embedding", detail: "semantic search over the estate, so you can ask by intent when you don't know the program name", tag: "Vector RAG" },
  { name: "BeeAI", detail: "the agent loop: it picks its own tools and logs why, which is what makes the reasoning auditable", tag: "Agent" },
  { name: "IBM watsonx.ai", detail: "granite-4-h-small in Dallas — the switchable hosted backend used by this deployment", tag: "Cloud" },
];

const BOB_TOOLS = [
  { name: "graph_lookup", body: "impact · lineage · callers · callees · summary — the deterministic traversal of the estate graph" },
  { name: "search_code", body: "semantic search across the ingested COBOL, powered by Granite embeddings" },
  { name: "read_source_lines", body: "the exact source lines behind a claim, so Bob can cite instead of paraphrase" },
];

const PROOF = [
  { n: "154", label: "automated tests" },
  { n: "2", label: "real mainframe estates" },
  { n: "1 496", label: "entities mapped" },
  { n: "30 s", label: "instead of days of manual hunting" },
];

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

      <section className="lp-sec">
        <div className="lp-h2">Four gestures, one governed workflow</div>
        <div className="lp-grid4">
          {VERBS.map((v) => (
            <div className="lp-card" key={v.verb}>
              <div className="lp-verb">{v.verb}</div>
              <div className="lp-ctitle">{v.title}</div>
              <p>{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-sec lp-alt" data-testid="ibm-section">
        <div className="lp-h2">Built on the IBM stack</div>
        <p className="lp-sub">
          No competing model anywhere in the pipeline: the reasoning, the embeddings and the hosted
          inference are all IBM.
        </p>
        <div className="lp-grid2">
          {STACK.map((s) => (
            <div className="lp-card" key={s.name}>
              <div className="lp-tag">{s.tag}</div>
              <div className="lp-ctitle">{s.name}</div>
              <p>{s.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-sec" data-testid="bob-section">
        <div className="lp-h2">
          <Icon name="graph" size={17} color="var(--amber)" /> Connected to IBM Bob
        </div>
        <p className="lp-sub">
          COBOL Explorer doesn't just <i>use</i> an AI — it <b>extends one</b>. Its analysis tools are exposed to
          IBM Bob over the Model Context Protocol, so a developer working inside Bob can ask
          “what breaks if I change LGPOLICY?” and get the exhaustive, grounded answer a file-reading
          assistant cannot guarantee.
        </p>
        <div className="lp-grid3">
          {BOB_TOOLS.map((t) => (
            <div className="lp-card" key={t.name}>
              <div className="lp-mono">{t.name}()</div>
              <p>{t.body}</p>
            </div>
          ))}
        </div>
        <div className="lp-note">
          Drop <code>.bob/mcp.json</code> into the workspace and the three tools appear in Bob. The estate
          graph becomes part of Bob's own reasoning — the integration runs both ways.
        </div>
      </section>

      <section className="lp-sec lp-alt">
        <div className="lp-h2">Governed by design</div>
        <div className="lp-grid3">
          <div className="lp-card">
            <div className="lp-ctitle">Proven identity</div>
            <p>Sign-in issues a signed token; your role rides inside it. A forged header promotes nobody.</p>
          </div>
          <div className="lp-card">
            <div className="lp-ctitle">Enforced roles</div>
            <p>Seven actions across six roles. An auditor reads and audits; only dev and architect may merge.</p>
          </div>
          <div className="lp-card">
            <div className="lp-ctitle">Tamper-evident audit</div>
            <p>Every attempt — granted, denied or rejected — is appended to an HMAC-chained log that detects edits and truncation.</p>
          </div>
        </div>
      </section>

      <footer className="lp-foot">
        <div>
          <b style={{ color: "var(--tx)" }}>Days of manual impact hunting → 30 seconds, with line-level proof.</b>
          <div style={{ marginTop: 6 }}>
            Demo estates: GenApp (insurance) · CardDemo (credit cards). Apache-2.0.
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn-pri lp-cta" data-testid="foot-signup" onClick={onSignUp}>Create account →</button>
      </footer>
    </div>
  );
}
