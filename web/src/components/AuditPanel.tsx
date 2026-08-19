import { useEffect, useState } from "react";
import { getAudit } from "../api";
import Help from "./Help";

interface Entry { ts: string; actor: string; role: string; action: string; target: string; result?: string; }

export default function AuditPanel() {
  const [data, setData] = useState<{ entries: Entry[]; chain_intact: boolean } | null>(null);
  const [err, setErr] = useState(false);
  // On fetch failure, DON'T fabricate "chain intact" — that would be a false
  // compliance signal. Surface the error honestly instead.
  const load = () => { setErr(false); getAudit(150).then(setData).catch(() => { setData(null); setErr(true); }); };
  useEffect(() => { load(); }, []);

  const exportCsv = () => {
    const rows = [["timestamp", "actor", "role", "action", "target", "result"],
      ...(data?.entries ?? []).map((e) => [e.ts, e.actor, e.role, e.action, e.target, e.result ?? "granted"])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "audit-log-cobol-explorer.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 15px", borderBottom: "1px solid var(--line)", flex: "none" }}>
        <span className="klabel" style={{ margin: 0 }}>Audit log<Help text="Every action (agent query, source read, change, merge — and every denial) is logged in an HMAC cryptographic chain: altering one line breaks the chain. This is the auditability proof for compliance." /></span>
        {err && <span className="grounded warn" style={{ marginLeft: "auto" }} data-testid="audit-chain">⚠ log unavailable</span>}
        {data && (
          <span className={`grounded ${data.chain_intact ? "ok" : "warn"}`} style={{ marginLeft: "auto" }} data-testid="audit-chain">
            {data.chain_intact ? "✓ chain verified" : "⚠ chain tampered"}
          </span>
        )}
        <button className="btn" style={{ fontSize: 10.5, padding: "3px 9px" }} onClick={exportCsv} disabled={!data?.entries.length}
          title="Export the audit log to CSV (for a compliance record)" data-testid="audit-export">↓ CSV</button>
        <button className="btn" style={{ fontSize: 10.5, padding: "3px 9px" }} onClick={load} title="Refresh">↻</button>
      </div>
      <div className="sb" style={{ flex: 1, overflow: "auto", padding: "6px 8px" }} data-testid="audit-list">
        {data?.entries.slice().reverse().map((e, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 6px", borderBottom: "1px solid var(--soft)", font: "400 11px var(--m)" }}>
            <span style={{ color: "var(--faint)", flex: "none", width: 52 }}>{e.ts.slice(11, 19)}</span>
            <span style={{ color: "var(--tx)", flex: "none", width: 88, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={`${e.actor} · ${e.role}`}>{e.actor}</span>
            <span className="tag" style={{ flex: "none" }}>{e.action}</span>
            <span style={{ color: "var(--dim)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={e.target}>{e.target}</span>
            {e.result && e.result !== "granted" && <span style={{ color: "var(--red)", font: "600 8.5px var(--m)", flex: "none" }}>{e.result}</span>}
          </div>
        ))}
        {err && (
          <div className="emptypane"><div className="d" style={{ color: "var(--red)" }}>Unable to load the audit log (server unreachable or access denied). The chain's integrity cannot be verified — try again.</div></div>
        )}
        {!err && (!data || !data.entries.length) && (
          <div className="emptypane"><div className="d">No action recorded. Every agent query, impact analysis and change is logged here, tamper-proof.</div></div>
        )}
      </div>
    </div>
  );
}
