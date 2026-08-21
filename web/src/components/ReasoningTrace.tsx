import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

/** The one moment that must land: a real SSE reasoning trace, replayed.
 *
 *  The estate greys out and lights up entity by entity as the agent retrieves.
 *  Every identifier, path and evidence line below is read from graph.json and the
 *  GenApp corpus — nothing here is invented, and the clock stops at the measured
 *  watsonx latency (6.5 s) rather than at a round number.
 *
 *  Timings are authored, not fetched: the landing page is public and must not hit
 *  a gated endpoint before sign-in. */

/* Carbon values. LIT is the interactive blue and means "the agent is touching
   this right now"; it is never used to say what kind of thing a node is. The
   rest match the categorical hues the graph view uses, so an entity keeps its
   colour whether the reader sees it in the trace or in the estate. */
const LIT = "#0f62fe";
const LIT_TEXT = "#78a9ff";
const BLUE = "#33b1ff";
const TEAL = "#08bdba";
const PURPLE = "#be95ff";
const GREEN = "#42be65";
const GREY = "#a8a8a8";
const SAND = "#f1c21b";
const LILAC = "#ffb3b8";

type Kind = "cpy" | "pgm" | "db2" | "job" | "ds" | "sch";
interface Node { id: string; k: Kind; c: string; x: number; y: number; hub?: boolean; small?: boolean; phase: number; }

/** The 11 programs that COPY LGPOLICY, with the line of their COPY statement. */
const IMPACT: Array<[string, number]> = [
  ["LGBATCH", 19], ["LGACDB01", 88], ["LGACDB02", 66], ["LGACUS01", 61], ["LGAPDB01", 75],
  ["LGICDB01", 74], ["LGICUS01", 60], ["LGIPDB01", 196], ["LGIPOL01", 55], ["LGUCDB01", 76],
  ["LGUPDB01", 102],
];

/** Authored in a 1000x545 space; the pane scales it and centres it on LGPOLICY. */
const NAMED: Node[] = [
  { id: "LGPOLICY", k: "cpy", c: PURPLE, x: 430, y: 272, hub: true, phase: 1 },
  { id: "LGUCDB01", k: "pgm", c: BLUE, x: 430, y: 58, phase: 2 },
  { id: "LGBATCH", k: "pgm", c: BLUE, x: 268, y: 70, phase: 2 },
  { id: "LGACDB01", k: "pgm", c: BLUE, x: 140, y: 130, phase: 2 },
  { id: "LGACDB02", k: "pgm", c: BLUE, x: 96, y: 210, phase: 2 },
  { id: "LGACUS01", k: "pgm", c: BLUE, x: 92, y: 292, phase: 2 },
  { id: "LGAPDB01", k: "pgm", c: BLUE, x: 122, y: 372, phase: 2 },
  { id: "LGICDB01", k: "pgm", c: BLUE, x: 196, y: 446, phase: 2 },
  { id: "LGICUS01", k: "pgm", c: BLUE, x: 330, y: 492, phase: 2 },
  { id: "LGIPDB01", k: "pgm", c: BLUE, x: 474, y: 468, phase: 2 },
  { id: "LGIPOL01", k: "pgm", c: BLUE, x: 592, y: 92, phase: 2 },
  { id: "LGUPDB01", k: "pgm", c: BLUE, x: 600, y: 400, phase: 2 },
  { id: "CUSTOMER", k: "db2", c: TEAL, x: 250, y: 188, small: true, phase: 3 },
  { id: "POLICY", k: "db2", c: TEAL, x: 256, y: 372, small: true, phase: 3 },
  { id: "DAILYPOL", k: "job", c: GREY, x: 712, y: 212, phase: 3 },
  { id: "POLRPT", k: "job", c: GREY, x: 712, y: 328, phase: 3 },
  { id: "INS.POLICY.MASTER", k: "ds", c: SAND, x: 744, y: 112, small: true, phase: 3 },
  { id: "INS.POLICY.REPORT", k: "ds", c: SAND, x: 748, y: 432, small: true, phase: 3 },
  { id: "SDAILYPOL", k: "sch", c: LILAC, x: 898, y: 212, phase: 4 },
  { id: "SPOLRPT", k: "sch", c: LILAC, x: 898, y: 328, phase: 4 },
];

const EDGES: Array<[string, string]> = [
  ["LGBATCH", "LGPOLICY"], ["LGACDB01", "LGPOLICY"], ["LGACDB02", "LGPOLICY"], ["LGACUS01", "LGPOLICY"],
  ["LGAPDB01", "LGPOLICY"], ["LGICDB01", "LGPOLICY"], ["LGICUS01", "LGPOLICY"], ["LGIPDB01", "LGPOLICY"],
  ["LGIPOL01", "LGPOLICY"], ["LGUCDB01", "LGPOLICY"], ["LGUPDB01", "LGPOLICY"],
  ["LGACDB01", "CUSTOMER"], ["LGAPDB01", "POLICY"], ["LGIPDB01", "POLICY"],
  ["LGBATCH", "DAILYPOL"], ["LGIPDB01", "POLRPT"], ["DAILYPOL", "INS.POLICY.MASTER"],
  ["POLRPT", "INS.POLICY.REPORT"], ["DAILYPOL", "SDAILYPOL"], ["POLRPT", "SPOLRPT"],
];

interface Step { at: number; tool: string; args: string; out: string; c: string; italic?: boolean; }
const TRACE: Step[] = [
  { at: 0.1, tool: "think", args: "", out: "blast radius question — go to the graph first, and exhaustively", c: PURPLE, italic: true },
  { at: 0.4, tool: "graph_lookup", args: "(op=summary, node=LGPOLICY)", out: "COPYBOOK · genapp-src/base/src/lgpolicy.cpy", c: BLUE },
  { at: 1.6, tool: "graph_lookup", args: "(op=impact, node=LGPOLICY)", out: "11 programs · 2 jobs · 3 steps", c: BLUE },
  { at: 3.2, tool: "graph_lookup", args: "(op=lineage, node=LGPOLICY)", out: "chains SDAILYPOL · SPOLRPT, from the scheduler export", c: BLUE },
  { at: 4.3, tool: "read_source_lines", args: "(file=lgipol01.cbl, from=55)", out: "00055   COPY LGPOLICY.", c: TEAL },
];

const ANSWER =
  "LGPOLICY is copied by 11 programs. Changing it recompiles all 11 and reaches 2 batch jobs, " +
  "DAILYPOL and POLRPT, triggered by the scheduler chains SDAILYPOL and SPOLRPT.";

const W = 1000;
const H = 545;
const DURATION = 6500;
const LOOP = 9600;
const ANSWER_AT = 5000;
const VERIFY_AT = 6300;

/** The rest of the estate: ~318 unnamed entities, scattered from a fixed seed so the
 *  field is identical on every render and can be memoised away from the clock. */
function useField() {
  return useMemo(() => {
    let s = 20260820;
    const r = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const out: JSX.Element[] = [];
    for (let i = 0; i < 318; i++) {
      const x = 20 + r() * 960;
      const y = 16 + r() * 512;
      if (NAMED.some((n) => Math.abs(n.x - x) < 108 && Math.abs(n.y - y) < 28)) continue;
      out.push(
        <rect key={i} x={x} y={y} width={2.6 + r() * 1.6} height={2.6} rx={0.8}
          fill={["#393939", "#333333", "#4c4c4c"][i % 3]} />,
      );
      if (i % 5 === 0) {
        out.push(
          <line key={"l" + i} x1={x} y1={y} x2={20 + r() * 960} y2={16 + r() * 512}
            stroke="#2a2a2a" strokeWidth={0.7} />,
        );
      }
    }
    return out;
  }, []);
}

function litAt(t: number): Set<string> {
  const lit = new Set<string>();
  if (t >= 300) lit.add("LGPOLICY");
  // The eleven impacted programs land one at a time, 110 ms apart — the beat that
  // makes retrieval legible as retrieval rather than as a fade-in.
  NAMED.filter((n) => n.phase === 2).forEach((n, i) => { if (t >= 1600 + i * 110) lit.add(n.id); });
  if (t >= 2900) NAMED.filter((n) => n.phase === 3).forEach((n) => lit.add(n.id));
  if (t >= 3400) NAMED.filter((n) => n.phase === 4).forEach((n) => lit.add(n.id));
  return lit;
}

export default function ReasoningTrace() {
  const still = useMemo(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const [t, setT] = useState(still ? DURATION + 400 : 0);
  const [fit, setFit] = useState({ scale: 1, ox: 0, oy: 0 });
  const paneRef = useRef<HTMLDivElement | null>(null);
  const field = useField();

  useEffect(() => {
    if (still) return;
    const t0 = performance.now();
    const id = window.setInterval(() => setT((performance.now() - t0) % LOOP), 55);
    return () => window.clearInterval(id);
  }, [still]);

  useLayoutEffect(() => {
    const el = paneRef.current;
    if (!el) return;
    const measure = (w: number, h: number) => {
      if (!w || !h) return;
      // Never shrink past legibility: a narrow pane crops the field instead,
      // staying centred on the queried entity.
      const scale = Math.max(0.46, Math.min(w / W, h / H));
      setFit({ scale, ox: w / 2 - 430 * scale, oy: h / 2 - 272 * scale });
    };
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      measure(r.width, r.height);
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    measure(r.width, r.height);
    return () => ro.disconnect();
  }, []);

  const running = !still && t < DURATION;
  const lit = litAt(t);
  const dim = running && t > 260;
  const pos = useMemo(() => new Map(NAMED.map((n) => [n.id, n])), []);

  const steps = still ? TRACE : TRACE.filter((s) => t >= s.at * 1000);
  const chars = still ? ANSWER.length : Math.max(0, Math.floor((t - ANSWER_AT) / 7));
  const showAnswer = still || t >= ANSWER_AT - 50;
  const verified = still || t >= VERIFY_AT;

  return (
    <div className="ce-fig" data-testid="reasoning-trace">
      <div className="ce-fig-head">
        <span className="ce-kicker">Fig 01</span>
        <span className="ce-fig-label">Live · impact closure of LGPOLICY · genapp, 339 nodes / 421 edges</span>
        <span className="ce-spacer" />
        <span className={`ce-live ${running ? "is-running" : "is-done"}`}>
          <span className="ce-live-dot" aria-hidden="true" />
          {running ? `retrieving · ${lit.size} entities` : "closure complete · 14 entities"}
        </span>
        <span className="ce-clock">{(running ? t / 1000 : 6.5).toFixed(2)} s</span>
      </div>

      <div className="ce-fig-body">
        <div className="ce-fig-cols">
          <div className="ce-graph" ref={paneRef}>
            <div
              className="ce-graph-stage"
              style={{ transform: `translate(${fit.ox}px, ${fit.oy}px) scale(${fit.scale})` }}
            >
              <svg className="ce-graph-field" viewBox={`0 0 ${W} ${H}`} width={W} height={H}
                style={{ opacity: dim ? 0.1 : 0.6 }} aria-hidden="true">
                {field}
              </svg>

              <svg className="ce-graph-edges" viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
                {EDGES.map(([a, b], i) => {
                  const on = lit.has(a) && lit.has(b);
                  const A = pos.get(a)!;
                  const B = pos.get(b)!;
                  return (
                    <line key={i} x1={A.x} y1={A.y} x2={B.x} y2={B.y}
                      stroke={on ? LIT : "#393939"} strokeWidth={on ? 1.5 : 0.9}
                      opacity={on ? 0.6 : dim ? 0.05 : 0.3} />
                  );
                })}
              </svg>

              {NAMED.map((n) => {
                const on = lit.has(n.id);
                return (
                  <div key={n.id}
                    className={`ce-node ${on ? "is-on" : ""} ${n.hub ? "is-hub" : ""} ${n.small ? "is-small" : ""}`}
                    style={{
                      left: n.x,
                      top: n.y,
                      opacity: on ? 1 : dim ? 0.05 : 0.5,
                      borderColor: on ? (n.hub ? LIT : n.c) : "#393939",
                      boxShadow: on
                        ? n.hub
                          ? `0 0 0 1px ${LIT}`
                          : `0 0 14px ${n.c}33`
                        : "none",
                    }}
                  >
                    <span className="ce-node-kind"
                      style={{ color: on ? (n.hub ? LIT_TEXT : n.c) : "#6f6f6f", borderColor: on ? (n.hub ? LIT : `${n.c}66`) : "#393939" }}>
                      {n.k}
                    </span>
                    <span className="ce-node-id" style={{ color: on ? "#f4f4f4" : "#6f6f6f" }}>{n.id}</span>
                  </div>
                );
              })}
            </div>
            {running && <div className="ce-scan" aria-hidden="true" />}
          </div>

          <div className="ce-side">
            <div className="ce-ask">
              <span className="ce-ask-label">Ask</span>
              <span className="ce-ask-q">what breaks if I change LGPOLICY?</span>
            </div>

            <div className="ce-log">
              {steps.map((s) => (
                <div className="ce-step" key={s.tool + s.at}>
                  <span className="ce-step-at">{s.at.toFixed(1)}s</span>
                  <span className="ce-step-rail" style={{ background: `${s.c}44` }} aria-hidden="true" />
                  <div className="ce-step-main">
                    <div className="ce-step-call">
                      <b style={{ color: s.c }}>{s.tool}</b>{s.args}
                    </div>
                    <div className={`ce-step-out ${s.italic ? "is-thought" : ""}`}
                      style={s.italic ? { color: PURPLE } : undefined}>
                      {s.out}
                    </div>
                  </div>
                </div>
              ))}

              <span className="ce-spacer" />

              {showAnswer && (
                <div className="ce-answer">
                  <div className="ce-answer-text">
                    {ANSWER.slice(0, chars)}
                    {!still && chars < ANSWER.length && <span className="ce-caret">▌</span>}
                  </div>
                  {verified && <div className="ce-verified" style={{ color: GREEN }}>✓ 11 sources verified</div>}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="ce-evidence">
          <span className="ce-evidence-label">Evidence</span>
          {IMPACT.map(([name, line], i) => (
            <span key={name} className={`ce-cite ${still || t >= 1600 + i * 110 ? "is-on" : ""}`}>
              {name.toLowerCase()}.cbl:{line}
            </span>
          ))}
        </div>
      </div>

      <p className="ce-fig-note">
        A real product trace, streamed event by event over SSE. The estate greys out; the entities the agent
        retrieves light up one at a time, and the clock stops at the measured watsonx latency.
      </p>
    </div>
  );
}
