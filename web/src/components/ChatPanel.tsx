import { useEffect, useRef, useState } from "react";
import { ask } from "../api";
import { parseSource } from "../model";
import type { TraceStep } from "../types";
import { Icon } from "./Icons";
import Markdown from "./Markdown";

interface Verify { count: number; all_grounded: boolean; grounded?: boolean; }
interface Msg { role: "user" | "ai"; text: string; trace?: TraceStep[]; loading?: boolean; error?: boolean; verify?: Verify; }
const fmt = (o: any) => (o ? Object.entries(o).map(([k, v]) => `${k}=${v}`).join(",") : "");
const SUGGESTED = ["What does program LGIPOL01 do?", "Where is the premium calculated?", "Impact of a change to LGPOLICY?"];
const FOLLOWUPS = ["Which programs are impacted?", "Show me the source line", "Who calls this program?"];

interface Props {
  seed?: { q: string; nonce: number };
  onCite?: (file: string, line?: number) => void;
  onOpenNode?: (id: string) => void;
  onQueryStart?: (question: string) => void;
  onTrace?: (step: TraceStep) => void;
  onQueryEnd?: () => void;
}

export default function ChatPanel({ seed, onCite, onOpenNode, onQueryStart, onTrace, onQueryEnd }: Props) {
  // A clicked source opens the cited line, reveals the entity, or follows the link.
  const openSource = (src: string) => {
    const s = parseSource(src);
    if (s.kind === "citation") onCite?.(s.file, s.line);
    else if (s.kind === "node") onOpenNode?.(s.id);
    else window.open(s.url, "_blank", "noopener");
  };

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [openTrace, setOpenTrace] = useState<Record<number, boolean>>({});
  const bodyRef = useRef<HTMLDivElement>(null);
  const lastNonce = useRef(-1);

  async function send(q?: string) {
    const question = (q ?? input).trim();
    if (!question || busy) return;
    // Recent turns for conversation memory (so "sur quelle ligne ?" keeps context).
    const history = msgs.filter((m) => m.text).slice(-4).map((m) => ({ role: m.role === "user" ? "user" : "ai", text: m.text }));
    setInput(""); setBusy(true);
    setMsgs((m) => [...m, { role: "user", text: question }, { role: "ai", text: "", trace: [], loading: true }]);
    const trace: TraceStep[] = [];
    onQueryStart?.(question);
    try {
      await ask(question, history, (type, data) => {
        if (type === "trace") {
          trace.push(data); onTrace?.(data);
          setMsgs((m) => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], trace: [...trace] }; return c; });
        } else if (type === "answer") {
          setMsgs((m) => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], text: data.text, loading: false }; return c; });
        } else if (type === "verify") {
          setMsgs((m) => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], verify: data }; return c; });
        } else if (type === "error") {
          setMsgs((m) => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], text: "Error: " + (data?.message || data), loading: false, error: true }; return c; });
        }
      });
    } catch (e) {
      setMsgs((m) => { const c = [...m]; c[c.length - 1] = { role: "ai", text: "Error: " + e, loading: false, error: true }; return c; });
    }
    // Guarantee the spinner never hangs, even if the stream ended without an answer.
    setMsgs((m) => {
      const c = [...m]; const last = c[c.length - 1];
      if (last?.role === "ai" && last.loading) c[c.length - 1] = { ...last, loading: false, text: last.text || "The agent returned no answer. Try again or rephrase.", error: !last.text };
      return c;
    });
    onQueryEnd?.();
    setBusy(false);
  }

  useEffect(() => { if (seed && seed.nonce !== lastNonce.current) { lastNonce.current = seed.nonce; send(seed.q); } }, [seed?.nonce]);
  useEffect(() => { bodyRef.current?.scrollTo(0, bodyRef.current.scrollHeight); }, [msgs]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {msgs.length === 0 ? (
        <div className="emptypane">
          <Icon name="spark" size={26} color="var(--amber)" />
          <div className="t">Query the estate</div>
          <div className="d">The agent reads the code read-only and <b style={{ color: "var(--tx)", fontWeight: 600 }}>always cites the source line</b>. The graph lights up as it reasons.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", marginTop: 4 }}>
            {SUGGESTED.map((s) => <button key={s} className="btn" style={{ justifyContent: "flex-start" }} onClick={() => send(s)}>{s}</button>)}
          </div>
        </div>
      ) : (
        <div ref={bodyRef} className="sb" style={{ flex: 1, overflow: "auto", padding: 15, display: "flex", flexDirection: "column", gap: 15 }}>
          {msgs.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="msg-user">{m.text}</div>
            ) : (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div className="agent-lbl"><Icon name="spark" size={13} color="var(--amber)" />Agent</div>
                {m.trace && m.trace.length > 0 && (
                  <div className="trace" data-testid="trace">
                    <div className="trace-head" onClick={() => setOpenTrace((o) => ({ ...o, [i]: !(o[i] ?? true) }))}>
                      <Icon name="chev" size={11} color="var(--faint)" style={{ transform: (openTrace[i] ?? true) ? "rotate(90deg)" : undefined, transition: "transform .12s" }} />
                      {m.trace.length} tool call{m.trace.length > 1 ? "s" : ""} · traceable
                    </div>
                    {(openTrace[i] ?? true) && m.trace.map((s, j) => s.tool === "think" ? (
                      <div key={j} className="l think">💭 {s.output_summary}</div>
                    ) : (
                      <div key={j} className="l"><b>{s.tool}</b>({fmt(s.input)}) <span style={{ color: "var(--faint)" }}>→ {s.output_summary}</span>
                        {s.sources?.map((src, k) => <u key={k} onClick={() => openSource(src)}> {src}</u>)}
                      </div>
                    ))}
                  </div>
                )}
                <div className={`msg-ai ${m.error ? "err" : ""}`}>
                  {m.loading && !m.text ? <span className="spin" /> : <Markdown text={m.text} onCite={onCite} />}
                </div>
                {m.verify && m.verify.count > 0 && (
                  <div className={`grounded ${m.verify.all_grounded ? "ok" : "warn"}`} data-testid="grounded">
                    {m.verify.all_grounded ? "✓" : "⚠"} {m.verify.count} source{m.verify.count > 1 ? "s" : ""} {m.verify.all_grounded ? "verified" : "— a citation does not resolve"}
                  </div>
                )}
                {m.verify && m.verify.count === 0 && !m.loading && !m.error && (
                  <div className="grounded warn" data-testid="grounded-none" title="A reliable answer must rely on a precise line of code.">
                    ⚠ unsourced answer — ask « which line? »
                  </div>
                )}
                {!m.loading && !m.error && i === msgs.length - 1 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
                    {FOLLOWUPS.map((f) => <button key={f} className="chip" onClick={() => send(f)}>{f}</button>)}
                  </div>
                )}
              </div>
            )
          )}
        </div>
      )}
      <div style={{ borderTop: "1px solid var(--line)", padding: 12, flex: "none" }}>
        <div style={{ position: "relative" }}>
          <textarea className="inp" style={{ resize: "none", height: 60, paddingRight: 40 }} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask the agent…" data-testid="chat-input"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <button className="btn-pri" style={{ position: "absolute", right: 8, bottom: 8, padding: "6px 9px", border: "none" }} onClick={() => send()} disabled={busy} data-testid="chat-send">
            {busy ? <span className="spin" /> : <Icon name="send" size={15} />}
          </button>
        </div>
      </div>
    </div>
  );
}
