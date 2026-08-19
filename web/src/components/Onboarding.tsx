import { useState } from "react";
import { ROLES, saveIdentity, type Identity } from "../identity";

export default function Onboarding({ initial, onDone }: { initial: Identity | null; onDone: (id: Identity) => void }) {
  const [name, setName] = useState(initial?.name || "");
  const [role, setRole] = useState(initial?.role || ROLES[1]);
  const start = () => { const id = { name: name.trim() || "guest", role }; saveIdentity(id); onDone(id); };

  return (
    <div className="scrim">
      <div className="modal" style={{ width: 470 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 15 }}>
          <div style={{ width: 16, height: 16, borderRadius: 4, background: "var(--amber)" }} />
          <span style={{ font: "600 13px var(--s)", color: "var(--tx)" }}>Welcome to COBOL Explorer</span>
        </div>
        <p style={{ font: "400 12.5px/1.65 var(--s)", color: "var(--dim)", margin: "0 0 18px" }}>
          Two gestures, kept separate. <b style={{ color: "var(--tx)" }}>Understand</b> — browse and query the codebase
          read-only; the agent cites its source. <b style={{ color: "var(--amber)" }}>Change</b> — every change lives in an
          isolated version, reviewed then approved.
        </p>
        <div className="klabel" style={{ marginBottom: 7 }}>Your name</div>
        <input className="inp" style={{ marginBottom: 16 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Amine" autoFocus data-testid="onb-name" onKeyDown={(e) => e.key === "Enter" && start()} />
        <div className="klabel" style={{ marginBottom: 8 }}>Role</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
          {ROLES.map((r) => (
            <span key={r} className="btn" style={role === r ? { borderColor: "var(--amber-d)", color: "var(--amber)", background: "rgba(255,176,32,.08)" } : {}} onClick={() => setRole(r)}>{r}</span>
          ))}
        </div>
        <button className="btn-pri" style={{ width: "100%", justifyContent: "center", font: "600 12.5px var(--s)", padding: 11, borderRadius: 6, border: "none" }} onClick={start} data-testid="onb-start">Enter the workshop →</button>
      </div>
    </div>
  );
}
