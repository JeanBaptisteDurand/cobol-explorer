import { useEffect, useState } from "react";
import { getImpact, getQuality } from "../api";
import { batchChains, copybookFanIn, kindCount } from "../model";
import type { Graph } from "../types";
import Help from "./Help";
import { Icon } from "./Icons";

export default function Overview({ graph, systemLabel, systemDetail, onOpenNode, onAsk, onShowImpact }: { graph: Graph; systemLabel?: string; systemDetail?: string; onOpenNode: (id: string) => void; onAsk: (q: string) => void; onShowImpact: (id: string) => void }) {
  const c = kindCount(graph);
  const fan = copybookFanIn(graph).slice(0, 4);
  const maxFan = fan[0]?.count || 1;
  const chains = batchChains(graph);
  const top = fan[0]; // most-critical copybook of THIS system (real fan-in)
  const [quality, setQuality] = useState<{ orphan_programs: { label: string }[]; unused_copybooks: string[] } | null>(null);
  const [impacted, setImpacted] = useState<number | null>(null);
  useEffect(() => { getQuality().then(setQuality).catch(() => {}); }, []);
  // Authoritative impacted-program count for the hero - the SAME deterministic
  // closure the graph highlights, so the headline number and the ripple agree.
  useEffect(() => {
    setImpacted(null);
    const label = top?.node.label;
    if (!label) return;
    let alive = true;
    getImpact(label).then((r: any) => { if (alive) { const n = (r?.impact?.programs ?? []).length; if (n) setImpacted(n); } }).catch(() => {});
    return () => { alive = false; };
  }, [top?.node.label]);

  // Suggested questions derived from THIS system's graph, so they always point at
  // real entities (a program, the most-copied copybook, a DB2 table).
  const aPgm = graph.nodes.find((n) => n.kind === "PGM" && n.attrs?.path)?.label;
  const aCopy = fan[0]?.node.label;
  const aTable = graph.nodes.find((n) => n.kind === "DB2_TABLE")?.label;
  const suggested = [
    aPgm && `What does program ${aPgm} do?`,
    aCopy && `Which programs break if I change copybook ${aCopy}?`,
    aTable && `Who writes to table ${aTable}?`,
  ].filter(Boolean) as string[];

  const impactN = impacted ?? top?.count ?? 0;

  return (
    <div className="overview">
      {top && top.count > 0 && (
        <div
          data-testid="impact-hero"
          style={{
            background: "linear-gradient(180deg, rgba(15, 98, 254, .16), rgba(15, 98, 254, .05))",
            border: "1px solid rgba(15, 98, 254, .35)",
            borderRadius: 0,
            padding: "18px 20px",
            display: "flex",
            alignItems: "center",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 300 }}>
            <div style={{ font: "600 10px var(--m)", letterSpacing: ".16em", textTransform: "uppercase", color: "var(--interactive)", marginBottom: 9 }}>
              Impact analysis · in 30 seconds
            </div>
            <div style={{ font: "600 20px/1.4 var(--s)", color: "var(--text-primary)" }}>
              Change <b style={{ font: "600 19px var(--m)", color: "var(--interactive)" }}>{top.node.label}</b> and you must recompile and retest{" "}
              <b style={{ color: "var(--danger)" }}>{impactN} program{impactN > 1 ? "s" : ""}</b>.
            </div>
            <div style={{ font: "400 12.5px/1.5 var(--s)", color: "var(--text-secondary)", marginTop: 7 }}>
              See exactly which ones, every dependency proven to the source line, in one click.
            </div>
          </div>
          <button
            className="btn"
            data-testid="impact-hero-cta"
            onClick={() => onShowImpact(top.node.id)}
            style={{ background: "var(--interactive)", color: "var(--text-on-color)", border: "none", font: "600 13px var(--s)", padding: "11px 16px", whiteSpace: "nowrap" }}
          >
            <Icon name="spark" size={14} color="var(--text-on-color)" />See the {impactN} impacted programs
          </button>
        </div>
      )}

      <div className="card" style={{ padding: 14 }}>
        <div className="klabel" style={{ marginBottom: 11 }}>Start with these questions</div>
        <div className="suggest">
          {suggested.map((q) => (
            <button key={q} className="btn" onClick={() => onAsk(q)}>
              <Icon name="spark" size={13} color="var(--interactive)" />{q}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h1 className="ov-h1">COBOL estate · <b>{systemLabel || "GenApp"}</b></h1>
        <p className="ov-p">
          {/* The detail comes from the estate registry and carries no final stop,
              so it needs its own sentence - concatenated it read "…claims,
              policies Read-only by default". */}
          {systemDetail || "Mainframe core"}. Read-only by default: the agent cites the source
          line. Every change lives in an isolated version, reviewed before it is applied.
        </p>
      </div>

      <div className="ov-stats">
        <div className="card stat"><div className="num">{c.PGM || 0}</div><div className="klabel" style={{ marginTop: 8 }}>Programs</div></div>
        <div className="card stat"><div className="num">{c.COPYBOOK || 0}</div><div className="klabel" style={{ marginTop: 8 }}>Copybooks</div></div>
        <div className="card stat"><div className="num">{c.DB2_TABLE || 0}</div><div className="klabel" style={{ marginTop: 8 }}>DB2 tables</div></div>
        <div className="card stat"><div className="num">{c.DOMAIN || 0}</div><div className="klabel" style={{ marginTop: 8 }}>Domains</div></div>
      </div>

      {/* Best-Use-of-Technology wedge: the product is itself an MCP server for IBM Bob. */}
      <div
        data-testid="mcp-wedge"
        style={{
          background: "linear-gradient(180deg, rgba(108,178,255,.06), rgba(108,178,255,.015))",
          border: "1px solid rgba(108,178,255,.30)",
          borderRadius: 0,
          padding: "16px 18px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 300 }}>
          <div style={{ font: "600 10px var(--m)", letterSpacing: ".16em", textTransform: "uppercase", color: "#6cb2ff", marginBottom: 7 }}>
            IBM Bob · Model Context Protocol
          </div>
          <div style={{ font: "500 13.5px/1.55 var(--s)", color: "var(--text-primary)" }}>
            Also available to <b>IBM Bob</b>. The same grounded tools:{" "}
            <b style={{ font: "500 12px var(--m)", color: "#6cb2ff" }}>graph_lookup</b>,{" "}
            <b style={{ font: "500 12px var(--m)", color: "#6cb2ff" }}>search_code</b>,{" "}
            <b style={{ font: "500 12px var(--m)", color: "#6cb2ff" }}>read_source_lines</b> are exposed as an{" "}
            <b>MCP server</b>, so Bob answers about this estate with the same source-line proof.
          </div>
        </div>
        {/* Was a decorative badge announcing a capability with no way to reach it. */}
        <a href="/presentation#connect-bob" data-testid="mcp-connect"
          title="How to connect your own Bob to this estate over MCP"
          style={{ font: "600 11px var(--m)", color: "var(--graph)", border: "1px solid var(--graph)", borderRadius: 0, padding: "6px 12px", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 7, textDecoration: "none" }}>
          <span style={{ width: 7, height: 7, borderRadius: 99, background: "var(--graph)" }} />MCP exposed · connect Bob →
        </a>
      </div>

      <div className="ov-grid">
        <div className="card">
          <div className="hd">Most critical copybooks <span className="sub">· fan-in</span><Help text="Fan-in = number of programs that COPY this copybook. The higher it is, the riskier a change: every one of those programs must be recompiled and retested." /></div>
          <div style={{ padding: "5px 0" }}>
            {fan.map(({ node, count }) => (
              <div key={node.id} className="row" style={{ borderRadius: 0, padding: "7px 14px", gap: 12 }} onClick={() => onOpenNode(node.id)} data-testid="fanin-row">
                <span style={{ font: "500 11.5px var(--m)", color: "var(--text-primary)", width: 90 }}>{node.label}</span>
                <div className="meter" style={{ flex: 1 }}><i style={{ width: `${Math.max(8, (count / maxFan) * 100)}%` }} /></div>
                <span style={{ font: "400 10.5px var(--m)", color: "var(--text-helper)", width: 28, textAlign: "right" }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="hd">Batch chains <span className="sub">· scheduler</span><Help text="The scheduler (Control-M, CA-7…) chains nightly batch jobs. A chain = an ordered sequence of jobs; each job runs programs. Changing a copybook can therefore break a whole chain." /></div>
          <div style={{ padding: "5px 0" }}>
            {chains.length === 0 && <div style={{ padding: "7px 14px", color: "var(--text-helper)", font: "400 11px var(--s)" }}>·</div>}
            {chains.map((ch) => (
              <div key={ch.id} className="row" style={{ borderRadius: 0, padding: "8px 14px", gap: 8, font: "500 11.5px var(--m)" }}>
                <span style={{ color: "var(--interactive)" }}>{ch.label}</span>
                <Icon name="chev" size={12} color="var(--text-helper)" />
                <span style={{ color: "var(--text-secondary)" }}>{ch.jobs.join(", ") || "·"}</span>
                {ch.after.length > 0 && <span style={{ marginLeft: "auto", font: "400 10px var(--s)", color: "var(--text-helper)" }}>after {ch.after.join(",")}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {quality && (
        <div className="card" style={{ padding: 14 }} data-testid="quality-card">
          <div className="hd">Estate quality <span className="sub">· dead code detected</span><Help text="Orphan program: nothing runs it (no CALL, no CICS transaction, no batch step). Unreferenced copybook: a .cpy file never COPYed by any program. Two forms of dead code, candidates for cleanup." /></div>
          <div style={{ display: "flex", gap: 30, padding: "10px 4px 4px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ font: "600 22px var(--m)", color: quality.orphan_programs.length ? "var(--danger)" : "var(--text-primary)" }}>{quality.orphan_programs.length}</span>
              <span className="klabel">orphan programs</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ font: "600 22px var(--m)", color: quality.unused_copybooks.length ? "var(--interactive)" : "var(--text-primary)" }}>{quality.unused_copybooks.length}</span>
              <span className="klabel">unreferenced copybooks</span>
            </div>
          </div>
          {quality.unused_copybooks.length > 0 && (
            <div style={{ font: "400 10.5px var(--m)", color: "var(--text-helper)", marginTop: 8 }}>
              {quality.unused_copybooks.slice(0, 10).join(" · ")}{quality.unused_copybooks.length > 10 ? " …" : ""}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
