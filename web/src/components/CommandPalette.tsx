import { useEffect, useMemo, useRef, useState } from "react";
import { getSearch } from "../api";
import type { Graph } from "../types";
import { Icon } from "./Icons";

interface SemHit { id: string; label: string; file: string; score: number; }

const TAG: Record<string, string> = {
  PGM: "pgm", COPYBOOK: "cpy", CICS_TXN: "cic", CICS_FILE: "vsa", BMS_MAP: "bms",
  DB2_TABLE: "db2", DOMAIN: "dom", JOB: "job", SCHED_JOB: "sch", CMD: "›",
};

// Cheap fuzzy score: prefix > substring > subsequence, shorter is better.
function score(q: string, t: string): number {
  if (!q) return 1;
  q = q.toLowerCase();
  t = t.toLowerCase();
  if (t.startsWith(q)) return 1000 - t.length;
  const idx = t.indexOf(q);
  if (idx >= 0) return 700 - idx - t.length * 0.1;
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) if (t[i] === q[qi]) qi++;
  return qi === q.length ? 300 - t.length : -1;
}

interface Item { id: string; label: string; kind: string; hint: string; }

export default function CommandPalette({ graph, onClose, onOpenNode, onCommand }: {
  graph: Graph; onClose: () => void; onOpenNode: (id: string) => void; onCommand: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [sem, setSem] = useState<SemHit[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);

  // Semantic search (IBM Granite embeddings) - concept search, complements the fuzzy label match.
  useEffect(() => {
    if (q.trim().length < 3) { setSem([]); return; }
    let alive = true; // ignore a resolved fetch whose query is already stale
    const t = setTimeout(() => {
      getSearch(q.trim()).then((r) => { if (alive) setSem(r.results || []); }).catch(() => { if (alive) setSem([]); });
    }, 220);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);

  const items = useMemo<Item[]>(() => {
    const cmds: Item[] = [
      { id: "cmd:overview", label: "Go to Overview", kind: "CMD", hint: "view" },
      { id: "cmd:graph", label: "Open the codebase graph", kind: "CMD", hint: "view" },
      { id: "cmd:agent", label: "Query the agent", kind: "CMD", hint: "action" },
      { id: "cmd:version", label: "New version (edit)", kind: "CMD", hint: "action" },
    ];
    const nodes: Item[] = graph.nodes
      .filter((n) => n.kind !== "PARAGRAPH")
      .map((n) => ({ id: n.id, label: n.label, kind: n.kind, hint: TAG[n.kind] || n.kind.toLowerCase() }));
    return [...cmds, ...nodes]
      .map((it) => ({ it, s: score(q, it.label) }))
      .filter((x) => x.s > -1)
      .sort((a, b) => b.s - a.s)
      .slice(0, 40)
      .map((x) => x.it);
  }, [q, graph]);

  useEffect(() => setSel(0), [q]);
  const activate = (it: Item) => { it.id.startsWith("cmd:") ? onCommand(it.id) : onOpenNode(it.id); onClose(); };

  return (
    <div className="scrim" onClick={onClose} style={{ alignItems: "flex-start", paddingTop: "12vh" }}>
      <div className="palette" onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
          else if (e.key === "Enter") { e.preventDefault(); if (items[sel]) activate(items[sel]); }
          else if (e.key === "Escape") onClose();
        }}>
        <div className="palette-in">
          <Icon name="search" size={15} color="var(--text-helper)" />
          <input ref={inputRef} data-testid="palette-input" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Go to a program, a table, a transaction, a command…" />
          <span className="kbd">esc</span>
        </div>
        <div className="palette-list sb">
          {items.map((it, i) => (
            <div key={it.id} className={`palette-row ${i === sel ? "sel" : ""}`} data-testid="palette-row"
              onMouseEnter={() => setSel(i)} onClick={() => activate(it)}>
              <span className="tag" style={{ width: 24, textAlign: "center" }}>{TAG[it.kind] || "·"}</span>
              <span style={{ flex: 1, color: "var(--text-primary)", font: "500 12.5px var(--s)" }}>{it.label}</span>
              <span style={{ color: "var(--text-helper)", font: "400 10px var(--m)" }}>{it.hint}</span>
            </div>
          ))}
          {sem.length > 0 && (
            <>
              <div className="palette-sec"><Icon name="spark" size={11} color="var(--interactive)" />Semantic search · Granite</div>
              {sem.map((r) => (
                <div key={"sem:" + r.id} className="palette-row" data-testid="palette-sem"
                  onClick={() => { onOpenNode(r.id); onClose(); }}>
                  <span className="tag" style={{ width: 24, textAlign: "center" }}>{({ pgm: "pgm", copy: "cpy" } as Record<string, string>)[r.id.split(":")[0]] || "·"}</span>
                  <span style={{ flex: 1, color: "var(--text-primary)", font: "500 12.5px var(--s)" }}>{r.label}</span>
                  <span style={{ color: "var(--text-helper)", font: "400 10px var(--m)" }}>{r.file} · {r.score}</span>
                </div>
              ))}
            </>
          )}
          {!items.length && sem.length === 0 && <div style={{ padding: 16, color: "var(--text-helper)", font: "400 12px var(--s)" }}>No result.</div>}
        </div>
      </div>
    </div>
  );
}
