import { useEffect, useState } from "react";
import { getAudit } from "../api";
import Help from "./Help";

interface Entry { ts: string; actor: string; role: string; action: string; target: string; result?: string; }

export default function AuditPanel() {
  const [data, setData] = useState<{ entries: Entry[]; chain_intact: boolean } | null>(null);
  const [err, setErr] = useState<"denied" | "unreachable" | null>(null);
  // On fetch failure, DON'T fabricate "chain intact" — that would be a false
  // compliance signal. Surface the error honestly instead, and say which kind it
  // is: a refusal is the access control working, not the server being down, and
  // only one of the two is worth retrying.
  const load = () => {
    setErr(null);
    getAudit(150)
      .then(setData)
      .catch((e: any) => { setData(null); setErr(e?.status === 403 ? "denied" : "unreachable"); });
  };
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
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 15px", borderBottom: "1px solid var(--border-subtle)", flex: "none" }}>
        <span className="klabel" style={{ margin: 0 }}>Audit log<Help text="Every action (agent query, source read, change, merge — and every denial) is logged in an HMAC cryptographic chain: altering one line breaks the chain. This is the auditability proof for compliance." /></span>
        {err && <span className="grounded warn" style={{ marginLeft: "auto" }} data-testid="audit-chain">
          {err === "denied" ? "⚠ not your role" : "⚠ log unavailable"}
        </span>}
        {data && (
          <span className={`grounded ${data.chain_intact ? "ok" : "warn"}`} style={{ marginLeft: "auto" }} data-testid="audit-chain">
            {data.chain_intact ? "✓ chain verified" : "⚠ chain tampered"}
          </span>
        )}
        <button className="btn" style={{ fontSize: 10.5, padding: "3px 9px" }} onClick={exportCsv} disabled={!data?.entries?.length}
          title="Export the audit log to CSV (for a compliance record)" data-testid="audit-export">↓ CSV</button>
        <button className="btn" style={{ fontSize: 10.5, padding: "3px 9px" }} onClick={load} title="Refresh">↻</button>
      </div>
      <div className="sb" style={{ flex: 1, overflow: "auto", padding: "6px 8px" }} data-testid="audit-list">
        {data?.entries?.slice().reverse().map((e, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 6px", borderBottom: "1px solid var(--layer-02)", font: "400 11px var(--m)" }}>
            {/* The server records ISO-8601 UTC. Shown bare ("20:44:33") in an
                evidence panel, two hours off the reader's wall clock, the
                timestamp read as wrong — label the zone, carry the date in the
                tooltip. */}
            <span style={{ color: "var(--text-helper)", flex: "none", width: 74 }} title={e.ts}>
              {e.ts.slice(11, 19)} <span style={{ fontSize: 8.5 }}>UTC</span>
            </span>
            <span style={{ color: "var(--text-primary)", flex: "none", width: 88, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={`${e.actor} · ${e.role}`}>{e.actor}</span>
            <span className="tag" style={{ flex: "none" }}>{e.action}</span>
            <span style={{ color: "var(--text-secondary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={e.target}>{e.target}</span>
            {e.result && e.result !== "granted" && <span style={{ color: "var(--danger)", font: "600 8.5px var(--m)", flex: "none" }}>{e.result}</span>}
          </div>
        ))}
        {err === "denied" && (
          <div className="emptypane" data-testid="audit-denied">
            <div className="d" style={{ color: "var(--danger)" }}>
              Reading the audit log is reserved to the compliance and auditor roles. Your role may
              read the estate, ask the agent and propose changes, but not review who did what.
            </div>
            <div className="d" style={{ marginTop: 10, color: "var(--text-helper)" }}>
              This refusal was itself written to the log.
            </div>
          </div>
        )}
        {err === "unreachable" && (
          <div className="emptypane"><div className="d" style={{ color: "var(--danger)" }}>The audit log could not be reached, so the chain's integrity cannot be verified. Try again.</div></div>
        )}
        {!err && (!data || !data.entries?.length) && (
          <div className="emptypane"><div className="d">No action recorded. Every agent query, impact analysis and change is logged here, tamper-proof.</div></div>
        )}
      </div>
    </div>
  );
}
