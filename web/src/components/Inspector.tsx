import { useEffect, useState } from "react";
import { getFields, getImpact } from "../api";
import { inDeps, nodeIndex, outDeps, type Dep } from "../model";
import type { GNode, Graph } from "../types";
import Help from "./Help";
import { Icon } from "./Icons";

interface Field { level: number; name: string; used_by: string[]; }

const TAG: Record<string, string> = { PGM: "pgm", COPYBOOK: "cpy", CICS_TXN: "cic", CICS_FILE: "vsa", BMS_MAP: "bms", DB2_TABLE: "db2", PARAGRAPH: "par", JOB: "job", SCHED_JOB: "sch", STEP: "stp", PROC: "prc", DATASET: "ds", DOMAIN: "dom" };

export default function Inspector({ node, graph, onOpenNode, onEdit, onShowInGraph, activePath }: { node: GNode | null; graph: Graph; onOpenNode: (id: string) => void; onEdit: (node: GNode) => void; onShowInGraph: (id: string) => void; activePath?: string | null }) {
  const [impact, setImpact] = useState<any>(null);
  const [fields, setFields] = useState<Field[] | null>(null);
  const [allFields, setAllFields] = useState(false);
  useEffect(() => {
    setImpact(null); setFields(null); setAllFields(false);
    let alive = true; // guard against a slower fetch resolving after the node changed
    if (node?.kind === "COPYBOOK") getFields(node.label).then((r) => { if (alive) setFields(r.fields); }).catch(() => {});
    return () => { alive = false; };
  }, [node?.id]);
  const idx = nodeIndex(graph);

  if (!node)
    return (
      <div className="emptypane">
        <Icon name="graph" size={24} color="var(--text-helper)" />
        <div className="t">Inspector</div>
        <div className="d" style={{ textAlign: "left" }}>
          <b style={{ color: "var(--text-primary)" }}>1.</b> Click a program (Source code) or an entity (Resources) on the left.<br />
          <b style={{ color: "var(--text-primary)" }}>2.</b> Its context appears here: dependencies, uses, impact.<br />
          <b style={{ color: "var(--text-primary)" }}>3.</b> From there: view the code, view the graph, or ask the agent.
        </div>
      </div>
    );

  const editable = (node.kind === "COPYBOOK" || node.kind === "PGM") && node.attrs?.path;
  // Impact analysis is a copybook/table concept (fan-in). Programs get their full
  // dependency breakdown from the cards below, so no misleading impact button there.
  const analysable = node.kind === "COPYBOOK" || node.kind === "DB2_TABLE";
  const tagOf = (id: string) => TAG[idx.get(id)?.kind || ""] || "?";

  const Card = ({ title, deps, note }: { title: string; deps: Dep[]; note?: string }) =>
    deps.length ? (
      <div>
        <div className="klabel" style={{ marginBottom: 6 }}>{title}</div>
        <div className="card">
          {deps.map((d, i) => (
            <div key={i} className="row" style={{ borderRadius: 0, justifyContent: "space-between", padding: "7px 12px" }} onClick={() => onOpenNode(d.id)}>
              <span style={{ font: "500 11.5px var(--m)", color: "var(--text-primary)" }}>
                <span className="tag" style={{ marginRight: 8 }}>{tagOf(d.id)}</span>{d.label}
                {note ? <span style={{ color: "var(--text-helper)", fontSize: 9, marginLeft: 6 }}>{note}</span> : null}
              </span>
              {d.line ? <span style={{ font: "400 10px var(--m)", color: "var(--interactive)" }}>L.{d.line}</span> : null}
            </div>
          ))}
        </div>
      </div>
    ) : null;

  return (
    <div style={{ padding: 15, display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span className="tag" style={{ color: "var(--interactive)", borderColor: "var(--interactive)" }}>{TAG[node.kind] || node.kind}</span>
        </div>
        <div style={{ font: "600 17px var(--m)", color: "var(--text-primary)", marginTop: 8 }}>{node.label}</div>
      </div>

      {node.kind === "DB2_TABLE" && (
        <div style={{ font: "400 11px/1.55 var(--s)", color: "var(--text-secondary)", background: "var(--layer-02)", border: "1px solid var(--border-subtle)", borderRadius: 0, padding: "9px 11px" }}>
          DB2 table. Its <b style={{ color: "var(--text-primary)" }}>columns</b> are defined in the <b style={{ color: "var(--text-primary)" }}>DDL</b> (outside the COBOL corpus): what is computed here is the <b style={{ color: "var(--text-primary)" }}>programs that read and write it</b>, extracted from the <span className="mono" style={{ fontSize: 10.5 }}>EXEC SQL</span>.
        </div>
      )}
      {node.kind === "CICS_FILE" && (
        <div style={{ font: "400 11px/1.55 var(--s)", color: "var(--text-secondary)", background: "var(--layer-02)", border: "1px solid var(--border-subtle)", borderRadius: 0, padding: "9px 11px" }}>
          <b style={{ color: "var(--text-primary)" }}>VSAM</b> file (CICS). Its structure lives in the record's copybook; here the <b style={{ color: "var(--text-primary)" }}>programs that access it</b> are computed, extracted from the <span className="mono" style={{ fontSize: 10.5 }}>EXEC CICS READ/WRITE</span>.
        </div>
      )}

      {/* Actions: each button appears only when it does something, with a tooltip. */}
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
        {node.attrs?.path && activePath !== node.attrs.path && (
          <button className="btn" style={{ fontSize: 11 }} onClick={() => onOpenNode(node.id)} title="Open the source file in the editor">
            <Icon name="file" size={13} color="var(--text-helper)" />View code
          </button>
        )}
        <button className="btn" style={{ fontSize: 11 }} onClick={() => onShowInGraph(node.id)} data-testid="insp-graph"
          title="Open the graph, centered on this entity and its neighborhood">
          <Icon name="graph" size={13} color="var(--text-helper)" />Show in graph
        </button>
        {analysable && <button className="btn" style={{ fontSize: 11 }} title="What breaks if this entity is modified?" onClick={() => { const at = node.id; getImpact(node.label).then((r) => { if (node.id === at) setImpact(r); }).catch(() => setImpact({ answer: "Impact analysis unavailable." })); }}><Icon name="spark" size={13} color="var(--interactive)" />See impact</button>}
        {editable && <button className="btn-pri" style={{ fontSize: 11, padding: "6px 11px" }} onClick={() => onEdit(node)} data-testid="insp-edit"
          title="Open the file and start an edit in an isolated version">Edit…</button>}
      </div>

      {impact && (
        <div className="card" style={{ padding: "11px 13px", font: "400 11.5px/1.6 var(--s)", color: "var(--text-secondary)" }}>
          <span style={{ color: "var(--interactive)" }}>Impact</span> · {impact.answer}
        </div>
      )}

      {node.kind === "COPYBOOK" && fields && fields.length > 0 && (() => {
        const referenced = fields.filter((f) => f.used_by.length > 0);
        const shown = allFields ? fields : referenced;
        return (
          <div data-testid="field-impact">
            <div className="klabel" style={{ marginBottom: 6 }}>
              Field-level impact · {fields.length} fields, {referenced.length} referenced<Help text="For each field of the copybook: how many programs actually reference it in their code. '4 prog' = modifying this field affects 4 programs. Fields marked '·' are referenced nowhere." />
            </div>
            <div className="card">
              {shown.slice(0, 40).map((f) => (
                <div key={f.name} className="row" style={{ borderRadius: 0, justifyContent: "space-between", padding: "6px 12px", cursor: "default" }}>
                  <span style={{ font: "500 11px var(--m)", color: f.used_by.length ? "var(--text-primary)" : "var(--text-helper)" }}>
                    <span style={{ color: "var(--text-helper)", marginRight: 6 }}>{String(f.level).padStart(2, "0")}</span>{f.name}
                  </span>
                  {f.used_by.length > 0 ? (
                    <span style={{ font: "400 10px var(--m)", color: "var(--graph)" }} title={f.used_by.join(", ")}>{f.used_by.length} prog</span>
                  ) : (
                    <span style={{ font: "400 9px var(--m)", color: "var(--text-helper)" }}>·</span>
                  )}
                </div>
              ))}
            </div>
            {fields.length > referenced.length && (
              <button className="btn" style={{ fontSize: 10.5, marginTop: 7, padding: "4px 9px" }} onClick={() => setAllFields((v) => !v)}>
                {allFields ? "Show only referenced fields" : `Show all fields (${fields.length})`}
              </button>
            )}
          </div>
        );
      })()}

      <Card title="Calls (CALL / CICS)" deps={outDeps(graph, node.id, ["PGM_CALLS"])} />
      <Card title="Copybooks" deps={outDeps(graph, node.id, ["PGM_COPIES"])} />
      <Card title="DB2 tables (read)" deps={outDeps(graph, node.id, ["PGM_SQL_READS"])} />
      <Card title="DB2 tables (write)" deps={outDeps(graph, node.id, ["PGM_SQL_WRITES"])} note="write" />
      {/* Inverse view for a DB2 table node: which programs read / write IT (EXEC SQL). */}
      <Card title="Read by (programs)" deps={inDeps(graph, node.id, ["PGM_SQL_READS"])} />
      <Card title="Written by (programs)" deps={inDeps(graph, node.id, ["PGM_SQL_WRITES"])} note="write" />
      <Card title="VSAM files (read)" deps={outDeps(graph, node.id, ["PGM_READS_FILE"])} />
      <Card title="VSAM files (write)" deps={outDeps(graph, node.id, ["PGM_WRITES_FILE"])} note="write" />
      <Card title="Screens (BMS)" deps={outDeps(graph, node.id, ["PGM_USES_MAP"])} />
      <Card title="Datasets read" deps={outDeps(graph, node.id, ["PGM_READS"])} />
      <Card title="Datasets written" deps={outDeps(graph, node.id, ["PGM_WRITES"])} note="write" />
      <Card title="Written by (lineage)" deps={inDeps(graph, node.id, ["PGM_WRITES"])} />
      <Card title="Read by (lineage)" deps={inDeps(graph, node.id, ["PGM_READS"])} />
      <Card title="Used by" deps={inDeps(graph, node.id, ["PGM_COPIES"])} />
      <Card title="Called by" deps={inDeps(graph, node.id, ["PGM_CALLS"])} />
      <Card title="Entry point · transactions" deps={inDeps(graph, node.id, ["TXN_INVOKES"])} />
      <Card title="Invokes the program" deps={outDeps(graph, node.id, ["TXN_INVOKES"])} />
      <Card title="Accessed by (programs)" deps={inDeps(graph, node.id, ["PGM_READS_FILE", "PGM_WRITES_FILE"])} />
      {/* Batch / JCL drill-down: job -> steps -> program + datasets */}
      <Card title="Job steps" deps={outDeps(graph, node.id, ["JOB_CONTAINS"])} />
      <Card title="In the job" deps={inDeps(graph, node.id, ["JOB_CONTAINS"])} />
      <Card title="Runs the program" deps={outDeps(graph, node.id, ["STEP_EXECUTES"])} />
      <Card title="Executed by (batch step)" deps={inDeps(graph, node.id, ["STEP_EXECUTES"])} />
      <Card title="Datasets (DD)" deps={outDeps(graph, node.id, ["STEP_USES_DD"])} />
      <Card title="Used by (batch steps)" deps={inDeps(graph, node.id, ["STEP_USES_DD"])} />
      <Card title="Triggered by (scheduler)" deps={inDeps(graph, node.id, ["SCHED_RUNS", "SCHED_TRIGGERS"])} />
    </div>
  );
}
