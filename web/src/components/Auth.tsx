import { useState } from "react";
import { login, signup } from "../api";
import { saveSession, type Identity } from "../identity";

export type AuthMode = "login" | "signup";

const ROLE_HINT: Record<string, string> = {
  dev: "read · propose · merge",
  architect: "read · propose · merge",
  risk: "read · propose, no merge",
  compliance: "read · comment · audit",
  auditor: "read · audit only",
};

/** Sign-in and sign-up share one panel: same fields, same errors, one extra row.
 *  The role is picked here but decided server-side — it comes back inside the
 *  signed token, so the workshop trusts the token and never this form. */
export default function Auth({
  mode, roles, onMode, onDone, onClose,
}: {
  mode: AuthMode;
  roles: string[];
  onMode: (m: AuthMode) => void;
  onDone: (id: Identity) => void;
  onClose?: () => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [display, setDisplay] = useState("");
  const [role, setRole] = useState(roles[0] || "dev");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isSignup = mode === "signup";

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const r = isSignup
        ? await signup(username.trim(), password, display.trim(), role)
        : await login(username.trim(), password);
      saveSession({ name: r.name, role: r.role }, r.token);
      onDone({ name: r.name, role: r.role });
    } catch (e: any) {
      setError(e?.message || "authentication failed");
    } finally {
      setBusy(false);
    }
  };

  const swap = (m: AuthMode) => { setError(""); onMode(m); };

  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal" style={{ width: 420 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ width: 16, height: 16, borderRadius: 4, background: "var(--amber)" }} />
          <span style={{ font: "600 13px var(--s)", color: "var(--tx)" }}>COBOL Explorer</span>
        </div>

        <div style={{ display: "flex", gap: 4, marginBottom: 18, borderBottom: "1px solid var(--line)" }}>
          {(["login", "signup"] as AuthMode[]).map((m) => (
            <span key={m} data-testid={`tab-${m}`} onClick={() => swap(m)}
              style={{
                padding: "7px 12px", cursor: "pointer", font: "600 12px var(--s)",
                color: mode === m ? "var(--amber)" : "var(--dim)",
                borderBottom: `2px solid ${mode === m ? "var(--amber)" : "transparent"}`, marginBottom: -1,
              }}>
              {m === "login" ? "Sign in" : "Create account"}
            </span>
          ))}
        </div>

        <p style={{ font: "400 12px/1.6 var(--s)", color: "var(--dim)", margin: "0 0 16px" }}>
          Your role travels inside a signed token: it decides what you may read, propose and merge —
          and every action is written to the tamper-evident audit trail under your name.
        </p>

        <div className="klabel" style={{ marginBottom: 7 }}>User</div>
        <input className="inp" style={{ marginBottom: 13 }} value={username} autoFocus data-testid="auth-user"
          onChange={(e) => setUsername(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />

        {isSignup && (
          <>
            <div className="klabel" style={{ marginBottom: 7 }}>Display name</div>
            <input className="inp" style={{ marginBottom: 13 }} value={display} data-testid="auth-display"
              placeholder="shown on your versions and audit lines"
              onChange={(e) => setDisplay(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
          </>
        )}

        <div className="klabel" style={{ marginBottom: 7 }}>Password</div>
        <input className="inp" style={{ marginBottom: isSignup ? 13 : 16 }} type="password" value={password}
          data-testid="auth-password" placeholder={isSignup ? "8 characters minimum" : ""}
          onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />

        {isSignup && (
          <>
            <div className="klabel" style={{ marginBottom: 8 }}>Role</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
              {roles.map((r) => (
                <span key={r} className="btn" data-testid={`role-${r}`} onClick={() => setRole(r)}
                  style={role === r ? { borderColor: "var(--amber-d)", color: "var(--amber)", background: "rgba(255,176,32,.08)" } : {}}>
                  {r}
                </span>
              ))}
            </div>
            <div style={{ font: "400 10.5px var(--m)", color: "var(--faint)", marginBottom: 16 }}>
              {ROLE_HINT[role] || "read"}
            </div>
          </>
        )}

        {error && (
          <div data-testid="auth-error" style={{ font: "400 12px/1.5 var(--s)", color: "var(--red)", marginBottom: 14 }}>{error}</div>
        )}

        <button className="btn-pri" data-testid="auth-submit" onClick={submit} disabled={busy}
          style={{ width: "100%", justifyContent: "center", font: "600 12.5px var(--s)", padding: 11, borderRadius: 6, border: "none" }}>
          {busy ? "…" : isSignup ? "Create account →" : "Sign in →"}
        </button>

        <div style={{ textAlign: "center", marginTop: 14, font: "400 11.5px var(--s)", color: "var(--faint)" }}>
          {isSignup ? (
            <>Already have an account? <u style={{ cursor: "pointer", color: "var(--dim)" }} onClick={() => swap("login")}>Sign in</u></>
          ) : (
            <>Demo accounts: <code style={{ font: "11px var(--m)", color: "var(--dim)" }}>amine</code> ·{" "}
              <code style={{ font: "11px var(--m)", color: "var(--dim)" }}>marc</code> — password{" "}
              <code style={{ font: "11px var(--m)", color: "var(--dim)" }}>demo</code></>
          )}
        </div>
      </div>
    </div>
  );
}
