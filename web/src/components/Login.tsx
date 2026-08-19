import { useState } from "react";
import { login } from "../api";
import { saveSession, type Identity } from "../identity";

/** Shown instead of the onboarding modal when the server runs with real authentication
 *  (COBOL_EXPLORER_AUTH=jwt). The role comes back inside the signed token, so it is the
 *  server — not this form — that decides what the user may do. */
export default function Login({ onDone }: { onDone: (id: Identity) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { token, name, role } = await login(username.trim(), password);
      saveSession({ name, role }, token);
      onDone({ name, role });
    } catch (e: any) {
      setError(e?.message || "identifiants invalides");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="scrim">
      <div className="modal" style={{ width: 400 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 15 }}>
          <div style={{ width: 16, height: 16, borderRadius: 4, background: "var(--amber)" }} />
          <span style={{ font: "600 13px var(--s)", color: "var(--tx)" }}>Sign in to COBOL Explorer</span>
        </div>
        <p style={{ font: "400 12.5px/1.65 var(--s)", color: "var(--dim)", margin: "0 0 18px" }}>
          Your role travels in a signed token: it decides what you can read, propose and merge — and
          every action is written to the audit trail under your name.
        </p>
        <div className="klabel" style={{ marginBottom: 7 }}>User</div>
        <input className="inp" style={{ marginBottom: 14 }} value={username} autoFocus data-testid="login-user"
          onChange={(e) => setUsername(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
        <div className="klabel" style={{ marginBottom: 7 }}>Password</div>
        <input className="inp" style={{ marginBottom: 16 }} type="password" value={password} data-testid="login-password"
          onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
        {error && (
          <div data-testid="login-error" style={{ font: "400 12px var(--s)", color: "var(--red, #ff6b6b)", marginBottom: 14 }}>{error}</div>
        )}
        <button className="btn-pri" style={{ width: "100%", justifyContent: "center", font: "600 12.5px var(--s)", padding: 11, borderRadius: 6, border: "none" }}
          onClick={submit} disabled={busy} data-testid="login-submit">
          {busy ? "Signing in…" : "Sign in →"}
        </button>
      </div>
    </div>
  );
}
