import { useState } from "react";
import { Icon } from "./Icons";

export default function NewVersionModal({ defaultTitle, onCreate, onClose }: { defaultTitle: string; onCreate: (title: string) => void; onClose: () => void }) {
  const [title, setTitle] = useState(defaultTitle);
  const submit = () => title.trim() && onCreate(title.trim());

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" style={{ width: 400 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
          <Icon name="branch" size={15} color="var(--interactive)" />
          <span style={{ font: "600 12.5px var(--s)", color: "var(--text-primary)" }}>New version</span>
        </div>
        <p style={{ font: "400 12px/1.55 var(--s)", color: "var(--text-secondary)", margin: "0 0 20px" }}>
          Switch to edit mode. Nothing is applied to the codebase until the version is merged.
        </p>
        <div className="klabel" style={{ marginBottom: 7 }}>Title</div>
        <input className="inp" style={{ marginBottom: 24 }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. RISK_TIER premium increase" autoFocus data-testid="nv-title" onKeyDown={(e) => e.key === "Enter" && submit()} />
        <div style={{ display: "flex", gap: 9 }}>
          <button className="btn-pri" style={{ flex: 1, justifyContent: "center", font: "600 12px var(--s)", padding: 10, borderRadius: 0, border: "none" }} onClick={submit} data-testid="nv-create">Create version</button>
          <button className="btn" style={{ justifyContent: "center", padding: "10px 16px" }} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
