import { useState } from "react";
import { ROLES, saveIdentity, type Identity } from "../identity";

/** First-run welcome, and the profile panel behind the user badge.
 *
 *  Two very different regimes share this dialog:
 *
 *  · open mode (local demo) — the visitor declares a name and a role, and the
 *    server takes their word for it. The picker below is the real thing.
 *  · jwt mode (the public deployment) — the role travels INSIDE the signed
 *    token; nothing chosen here can change what the server enforces. The
 *    picker used to render anyway, so someone set their profile to Auditor,
 *    opened the audit panel, and was refused by a server that still saw their
 *    account's real role. The UI was offering a control it did not have.
 *    In that regime this dialog is read-only about the facts, and the one
 *    honest control is signing out to switch accounts.
 */
export default function Onboarding({ initial, locked, onDone, onSignOut }: {
  initial: Identity | null;
  /** True when a signed session decides the role (jwt/enforce) — the picker would lie. */
  locked?: boolean;
  onDone: (id: Identity) => void;
  onSignOut?: () => void;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [role, setRole] = useState(initial?.role || ROLES[1]);
  const start = () => { const id = { name: name.trim() || "guest", role }; saveIdentity(id); onDone(id); };

  return (
    <div className="scrim">
      <div className="modal" style={{ width: 470 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 15 }}>
          <div style={{ width: 16, height: 16, borderRadius: 0, background: "var(--interactive)" }} />
          <span style={{ font: "600 13px var(--s)", color: "var(--text-primary)" }}>
            {locked ? "Your session" : "Welcome to COBOL Explorer"}
          </span>
        </div>
        <p style={{ font: "400 12.5px/1.65 var(--s)", color: "var(--text-secondary)", margin: "0 0 18px" }}>
          Two gestures, kept separate. <b style={{ color: "var(--text-primary)" }}>Understand</b> — browse and query the codebase
          read-only; the agent cites its source. <b style={{ color: "var(--interactive)" }}>Change</b> — every change lives in an
          isolated version, reviewed then approved.
        </p>

        {locked ? (
          <>
            <div className="klabel" style={{ marginBottom: 7 }}>Signed in as</div>
            <div className="card" style={{ padding: "10px 13px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ font: "600 12.5px var(--s)", color: "var(--text-primary)" }}>{initial?.name}</span>
              <span className="tag">{initial?.role}</span>
            </div>
            <p style={{ font: "400 11.5px/1.6 var(--s)", color: "var(--text-helper)", margin: "0 0 18px" }} data-testid="onb-locked-note">
              Your role is part of your signed account — it decides what the server lets you read,
              propose and merge, and it cannot be changed from here. To act as another role
              (an auditor reading the trail, a developer merging), sign out and use an account
              that holds it.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" style={{ flex: 1, justifyContent: "center", padding: 10 }}
                onClick={onSignOut} data-testid="onb-signout">Sign out</button>
              <button className="btn-pri" style={{ flex: 1, justifyContent: "center", font: "600 12.5px var(--s)", padding: 10, borderRadius: 0, border: "none" }}
                onClick={() => onDone(initial!)} data-testid="onb-start">Back to the workshop</button>
            </div>
          </>
        ) : (
          <>
            <div className="klabel" style={{ marginBottom: 7 }}>Your name</div>
            <input className="inp" style={{ marginBottom: 16 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Amine" autoFocus data-testid="onb-name" onKeyDown={(e) => e.key === "Enter" && start()} />
            <div className="klabel" style={{ marginBottom: 8 }}>Role</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
              {ROLES.map((r) => (
                <span key={r} className="btn" style={role === r ? { borderColor: "var(--interactive)", color: "var(--interactive)", background: "rgba(15, 98, 254, .16)" } : {}} onClick={() => setRole(r)}>{r}</span>
              ))}
            </div>
            <button className="btn-pri" style={{ width: "100%", justifyContent: "center", font: "600 12.5px var(--s)", padding: 11, borderRadius: 0, border: "none" }} onClick={start} data-testid="onb-start">Enter the workshop →</button>
          </>
        )}
      </div>
    </div>
  );
}
