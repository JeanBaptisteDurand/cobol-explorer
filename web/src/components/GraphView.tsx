import { useEffect, useMemo, useState } from "react";
import ReactFlow, { Background, Controls, Handle, MiniMap, Position, useReactFlow } from "reactflow";
import { getImpact } from "../api";
import { computeLayout } from "../layout";
import { nodeIndex } from "../model";
import type { Graph } from "../types";
import Help from "./Help";
import { Icon } from "./Icons";

const IMPACT_COLOR = "#fa4d56";

const NT: Record<string, string> = {
  DOMAIN: "dom", PGM: "pgm", COPYBOOK: "cpy", DB2_TABLE: "db2", CICS_TXN: "cic", CICS_FILE: "vsa",
  BMS_MAP: "bms", JOB: "job", SCHED_JOB: "sch", STEP: "stp", PROC: "prc", DATASET: "ds", PARAGRAPH: "par",
};
const KIND_LABEL: Record<string, string> = {
  DOMAIN: "Domains", PGM: "Programs", COPYBOOK: "Copybooks", DB2_TABLE: "DB2 tables", CICS_TXN: "CICS transactions",
  CICS_FILE: "VSAM files", BMS_MAP: "BMS screens", JOB: "Jobs", SCHED_JOB: "Scheduler", STEP: "Steps",
  PROC: "Procedures", DATASET: "Datasets", PARAGRAPH: "Paragraphs",
};
// Carbon's categorical hues, one per entity family. The interactive blue is
// absent on purpose: it means selection here, never a kind of thing.
const KIND_COLOR: Record<string, string> = {
  PGM: "#33b1ff", COPYBOOK: "#be95ff", DB2_TABLE: "#08bdba", CICS_TXN: "#42be65", CICS_FILE: "#6fdc8c",
  BMS_MAP: "#78a9ff", JOB: "#ff832b", SCHED_JOB: "#ffb3b8", STEP: "#a8a8a8", PROC: "#a8a8a8",
  DATASET: "#f1c21b", PARAGRAPH: "#6f6f6f", DOMAIN: "#ff7eb6",
};
const kColor = (k: string) => KIND_COLOR[k] || "#8d8d8d";

const SELECTED = "#0f62fe";
const NEUTRAL = "#525252";
const DASHED = new Set([
  "PGM_COPIES", "PGM_USES_MAP", "PGM_SQL_READS", "PGM_SQL_WRITES", "PGM_READS_FILE", "PGM_WRITES_FILE", "STEP_USES_DD", "SCHED_RUNS",
]);
const ACCENT = new Set(["PGM_CALLS", "TXN_INVOKES", "SCHED_TRIGGERS"]);

function NodeBox({ data, selected }: any) {
  const dom = data.kind === "DOMAIN";
  const c = kColor(data.kind);
  const style = data.impacted
    ? { borderColor: IMPACT_COLOR, boxShadow: `0 0 0 1px ${IMPACT_COLOR}`, borderLeft: `3px solid ${IMPACT_COLOR}` }
    : selected ? undefined : { borderLeft: `3px solid ${c}` };
  return (
    <div className={`rf-node ${dom ? "dom" : ""} ${selected ? "sel" : ""} ${data.agentLit ? "lit" : ""} ${data.agentDim ? "dim" : ""}`} style={style}>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <span className="nt" style={{ color: c, borderColor: c }}>{NT[data.kind] || "?"}</span>
      {data.label}
      {data.hasPath && (
        <span className="rf-open" title="Open source code" data-testid="graph-open"
          onClick={(e) => { e.stopPropagation(); data.onOpen(); }}>
          <Icon name="split" size={11} />
        </span>
      )}
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
}
const nodeTypes = { m: NodeBox };

// Smoothly re-frames the viewport, optionally zooming to a specific set of nodes.
function Fitter({ dep, nodeIds }: { dep: string; nodeIds?: string[] }) {
  const rf = useReactFlow();
  useEffect(() => {
    const t = setTimeout(() => {
      const opts: any = { duration: 500, padding: 0.25 };
      if (nodeIds && nodeIds.length) opts.nodes = nodeIds.map((id) => ({ id }));
      rf.fitView(opts);
    }, 60);
    return () => clearTimeout(t);
  }, [dep, rf]);
  return null;
}

export default function GraphView({ graph, visibleKinds, onSelect, onOpen, selectedId, agentActive, litNodes, focus = false, onFocusChange, agentPrimaryLabel, onFocusPrimary, impactReq }: { graph: Graph; visibleKinds: Set<string>; onSelect: (id: string) => void; onOpen: (id: string) => void; selectedId: string | null; agentActive?: boolean; litNodes?: Set<string>; focus?: boolean; onFocusChange?: (v: boolean) => void; agentPrimaryLabel?: string; onFocusPrimary?: () => void; impactReq?: { id: string; label: string; nonce: number } | null }) {
  const pos = useMemo(() => computeLayout(graph), [graph]);
  const idx = useMemo(() => nodeIndex(graph), [graph]);
  const [vis, setVis] = useState<Set<string>>(new Set(visibleKinds));
  // Focus mode is controlled by App so the sidebar / inspector can "reveal in graph".
  const setFocus = (v: boolean) => onFocusChange?.(v);
  const [impact, setImpact] = useState<{ set: Set<string>; count: number } | null>(null);
  useEffect(() => setVis(new Set(visibleKinds)), [visibleKinds]);
  useEffect(() => setImpact(null), [selectedId]);
  // External impact request (Overview hero CTA): runs AFTER the selectedId reset above
  // (declared later), so the red ripple lands and isn't cleared by the selection change.
  useEffect(() => {
    if (impactReq) showImpact({ id: impactReq.id, label: impactReq.label });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [impactReq?.nonce]);

  async function showImpact(node: { id: string; label: string }) {
    try {
      const r = await getImpact(node.label);
      const imp = r?.impact ?? {};
      const ids = new Set<string>([node.id]);
      (imp.programs ?? []).forEach((p: any) => ids.add(typeof p === "string" ? p : p.id));
      (imp.jobs ?? []).forEach((j: string) => ids.add(j));
      (imp.chains ?? []).forEach((c: string) => ids.add(c));
      setImpact({ set: ids, count: (imp.programs ?? []).length });
    } catch { /* impact fetch failed — keep the current graph, no crash */ }
  }

  const kindsPresent = useMemo(() => {
    const have = new Set(graph.nodes.map((n) => n.kind));
    return Object.keys(KIND_LABEL).filter((k) => have.has(k));
  }, [graph]);

  // Focus mode: keep only the selected node and its direct neighbours.
  const focusSet = useMemo(() => {
    if (!focus || !selectedId) return null;
    const s = new Set<string>([selectedId]);
    for (const e of graph.edges) {
      if (e.src === selectedId) s.add(e.dst);
      if (e.dst === selectedId) s.add(e.src);
    }
    return s;
  }, [focus, selectedId, graph]);

  // Dimming/illumination kicks in only once nodes actually light up. During the
  // agent's initial "thinking" (query sent, no trace yet — up to ~30s with an
  // on-prem LLM) the graph stays fully readable, so the wait never looks like a
  // frozen, greyed-out screen. `agentActive` alone drives the spinner label.
  const live = !!(litNodes && litNodes.size > 0);

  const { nodes, edges } = useMemo(() => {
    const impSet = impact?.set ?? null;
    const lit = litNodes ?? null;
    // In live (agent) mode we show the whole visible landscape so greying reads;
    // otherwise impacted/focused sets drive visibility.
    const shown = new Set(
      graph.nodes.filter((n) => {
        if (lit?.has(n.id) || impSet?.has(n.id)) return true;
        // Focus reveals the FULL neighbourhood regardless of kind filters — so
        // focusing a batch job shows its steps/datasets even when those kinds
        // are hidden in the default landscape.
        if (!live && focusSet) return focusSet.has(n.id);
        return vis.has(n.kind);
      }).map((n) => n.id)
    );
    const nodes = graph.nodes.filter((n) => shown.has(n.id)).map((n) => ({
      id: n.id, type: "m", position: pos[n.id] || { x: 0, y: 0 },
      data: {
        kind: n.kind, label: n.label, hasPath: !!n.attrs?.path, onOpen: () => onOpen(n.id),
        impacted: impSet?.has(n.id) && n.id !== selectedId,
        agentLit: live && !!lit?.has(n.id),
        agentDim: live && !lit?.has(n.id),
      },
      selected: n.id === selectedId,
    }));
    const edges = graph.edges.filter((e) => shown.has(e.src) && shown.has(e.dst)).map((e, i) => {
      const bothLit = live && lit?.has(e.src) && lit?.has(e.dst);
      const inImpact = impSet && impSet.has(e.src) && impSet.has(e.dst);
      const touchesSel = selectedId && (e.src === selectedId || e.dst === selectedId);
      const stroke = bothLit ? SELECTED : inImpact ? IMPACT_COLOR : touchesSel ? SELECTED : ACCENT.has(e.kind) ? "#6f6f6f" : NEUTRAL;
      const dimLive = live && !bothLit;
      return {
        id: `e${i}`, source: e.src, target: e.dst, type: "default",
        style: {
          stroke, strokeWidth: bothLit || inImpact ? 2.1 : touchesSel ? 1.7 : 1.2,
          strokeDasharray: DASHED.has(e.kind) ? "2 4" : undefined,
          opacity: dimLive ? 0.05 : inImpact || touchesSel || bothLit || !selectedId ? 1 : 0.5,
        },
        animated: !!bothLit,
      };
    });
    return { nodes, edges };
  }, [graph, vis, selectedId, pos, onOpen, focusSet, impact, live, litNodes]);

  const sel = selectedId ? idx.get(selectedId) : null;
  const toggle = (k: string) => setVis((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const fitKey = live ? `live:${litNodes?.size ?? 0}` : focus && selectedId ? `focus:${selectedId}` : `all:${vis.size}`;
  const fitNodeIds = live ? [...(litNodes ?? [])] : focus && focusSet ? [...focusSet] : undefined;

  return (
    <div style={{ position: "relative", height: "100%" }}>
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView minZoom={0.1} nodesConnectable={false}
        onNodeClick={(_, n) => onSelect(n.id)} onNodeDoubleClick={(_, n) => onOpen(n.id)} proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: "default" }}>
        <Fitter dep={fitKey} nodeIds={fitNodeIds} />
        <Background color="#232529" gap={44} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable nodeColor={(n: any) => (n.id === selectedId ? SELECTED : kColor(n.data?.kind))} maskColor="rgba(22,22,22,.7)" style={{ background: "var(--layer-01)", border: "1px solid var(--border-subtle)" }} />
      </ReactFlow>

      {/* Floating tool panel: legend, focus, kind filters, selected-node quick actions. */}
      <div style={{ position: "absolute", top: 14, left: 14, width: 252, padding: 13, pointerEvents: "auto", background: "var(--layer-01)", border: "1px solid var(--border-subtle)", borderRadius: 0, boxShadow: "0 6px 22px rgba(8,9,11,.5)" }}>
        <div className="ov-h1" style={{ fontSize: 12.5, marginBottom: 2 }}>Estate graph</div>
        {(agentActive || live) ? (
          <div style={{ margin: "6px 0 11px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, font: "500 11px var(--s)", color: "var(--link)" }}>
              <span className="spin" />{live ? `Agent path · ${litNodes?.size ?? 0} entities` : "The agent is thinking… (~30 s, on-prem Granite)"}
            </div>
            {/* Collapse the whole reasoning trail down to just the asked entity + neighbours. */}
            {live && agentPrimaryLabel && onFocusPrimary && (
              <button className="btn" style={{ fontSize: 10.5, padding: "4px 9px", marginTop: 8, width: "100%", justifyContent: "center" }}
                onClick={onFocusPrimary} data-testid="focus-primary"
                title={`Keep only ${agentPrimaryLabel} and its direct neighbors (hide the rest of the reasoning)`}>
                <Icon name="graph" size={12} color="var(--interactive)" />Show {agentPrimaryLabel} + neighbors only
              </button>
            )}
          </div>
        ) : (
          <div style={{ font: "400 10.5px/1.5 var(--s)", color: "var(--text-secondary)", marginBottom: 11 }}>
            Click: select · double-click or <Icon name="split" size={10} color="var(--text-secondary)" /> : open code
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 11 }}>
          <span className="klabel" style={{ margin: 0 }}>Neighborhood focus<Help text="Shows only the selected entity and its direct neighbors — the rest of the estate is hidden. Ideal for answering 'what does this entity depend on, who uses it?'." /></span>
          <button className={focus ? "btn-pri" : "btn"} style={{ fontSize: 10.5, padding: "3px 9px", border: focus ? "none" : undefined }}
            data-testid="graph-focus" onClick={() => setFocus(!focus)} disabled={!selectedId && !focus}>
            {focus ? "enabled" : "enable"}
          </button>
        </div>

        <div className="klabel" style={{ marginBottom: 7 }}>Filter by type<Help text="Click a type to show or hide it in the graph. The dot colors match the node colors." /></div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: sel ? 13 : 0 }}>
          {kindsPresent.map((k) => (
            <span key={k} className="tag" data-testid="graph-filter"
              style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, opacity: vis.has(k) ? 1 : 0.4, borderColor: vis.has(k) ? "var(--border-subtle)" : "var(--border-subtle)", color: vis.has(k) ? "var(--text-primary)" : "var(--text-helper)" }}
              onClick={() => toggle(k)}>
              <span style={{ width: 7, height: 7, borderRadius: 0, background: kColor(k), flex: "none" }} />{KIND_LABEL[k]}</span>
          ))}
        </div>

        {sel && (
          <div className="card" style={{ padding: 11, marginTop: 2 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 9 }}>
              <span className="tag">{NT[sel.kind] || "?"}</span>
              <span style={{ font: "600 12px var(--m)", color: "var(--text-primary)" }}>{sel.label}</span>
            </div>
            {sel.attrs?.path ? (
              <button className="btn-pri" style={{ width: "100%", justifyContent: "center", fontSize: 11, padding: "7px 0", border: "none" }}
                data-testid="graph-open-code" onClick={() => onOpen(sel.id)}>
                <Icon name="split" size={12} />Open source code
              </button>
            ) : (
              <div style={{ font: "400 10.5px/1.5 var(--s)", color: "var(--text-helper)" }}>
                Entity with no source file — see dependencies in the inspector.
              </div>
            )}
            {(sel.kind === "COPYBOOK" || sel.kind === "DB2_TABLE") && (
              <button className="btn" style={{ width: "100%", justifyContent: "center", fontSize: 11, padding: "7px 0", marginTop: 7, borderColor: impact ? IMPACT_COLOR : undefined, color: impact ? IMPACT_COLOR : undefined }}
                data-testid="graph-impact" onClick={() => (impact ? setImpact(null) : showImpact(sel))}>
                <Icon name="graph" size={12} color={impact ? IMPACT_COLOR : "var(--interactive)"} />
                {impact ? `${impact.count} impacted — clear` : "See change impact"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
