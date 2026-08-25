import { useMemo, useState } from "react";
import { domainsTree } from "../model";
import type { ChangeSet, GNode, Graph } from "../types";
import { Icon } from "./Icons";

const TAG: Record<string, string> = { PGM: "pgm", COPYBOOK: "cpy", CICS_TXN: "cic", CICS_FILE: "vsa", BMS_MAP: "bms", DB2_TABLE: "db2", JOB: "job", DATASET: "ds", PROC: "prc", SCHED_JOB: "sch", STEP: "stp" };

export default function Navigator({
  graph, versions, activeVersion, readonly, onOpenFile, onOpenResource, onOpenVersion, onNewVersion, selectedPath, selectedId,
}: {
  graph: Graph; versions: ChangeSet[]; activeVersion: string | null; readonly?: boolean;
  onOpenFile: (node: GNode) => void; onOpenResource: (node: GNode) => void;
  onOpenVersion: (cs: ChangeSet) => void; onNewVersion: () => void;
  selectedPath: string | null; selectedId: string | null;
}) {
  const { groups } = useMemo(() => domainsTree(graph), [graph]);
  const byKind = (k: string) => graph.nodes.filter((n) => n.kind === k).sort((a, b) => a.label.localeCompare(b.label));
  const resources = useMemo(
    () => [
      { id: "COPYBOOK", label: "Copybooks", hint: "shared structures · opens the code", nodes: byKind("COPYBOOK") },
      { id: "CICS_TXN", label: "CICS Transactions", hint: "entry points · shows the graph", nodes: byKind("CICS_TXN") },
      { id: "CICS_FILE", label: "VSAM Files", hint: "file data · shows the graph", nodes: byKind("CICS_FILE") },
      { id: "BMS_MAP", label: "BMS Screens", hint: "3270 screens · shows the graph", nodes: byKind("BMS_MAP") },
      { id: "DB2_TABLE", label: "DB2 Tables", hint: "SQL data · shows the graph", nodes: byKind("DB2_TABLE") },
    ],
    [graph]
  );
  // Batch / scheduler layer (JCL) - its own section so jobs, datasets and procs
  // are navigable, not just hidden in the raw graph.
  const batch = useMemo(
    () => [
      { id: "JOB", label: "Batch jobs", hint: "JCL processing · shows the graph", nodes: byKind("JOB") },
      { id: "DATASET", label: "Datasets", hint: "batch files / GDG · shows the graph", nodes: byKind("DATASET") },
      { id: "PROC", label: "JCL Procedures", hint: "reusable procedures · shows the graph", nodes: byKind("PROC") },
    ],
    [graph]
  );
  const [open, setOpen] = useState<Record<string, boolean>>({ [groups[0]?.id || ""]: true });
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const FileRow = ({ n, ext }: { n: GNode; ext?: string }) => (
    <div className={`row ${selectedPath === n.attrs?.path ? "sel" : ""}`} onClick={() => onOpenFile(n)}
      title="Open source code" data-testid="tree-file">
      <Icon name="file" size={14} color="var(--text-helper)" />
      {n.label}{ext}
      <span className="tag" style={{ marginLeft: "auto" }}>{TAG[n.kind]}</span>
    </div>
  );

  return (
    <>
      {/* ── Source code, one folder per business domain ─────────────────── */}
      <div className="sidehead" style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
        <span className="klabel">Source code</span>
        {/* "with source in the corpus" is doing real work: the graph also knows
            programs that are only ever CALLed (18 of CardDemo's 62), so the
            tree count and the estate statistic legitimately differ - unstated,
            that difference read as a bug. */}
        <span className="sidehint">COBOL programs with source in the corpus, by business domain · click: opens the code</span>
      </div>

      <div style={{ padding: "0 8px 10px" }}>
        {groups.map((d) => (
          <div key={d.id}>
            <div className="row folder" onClick={() => toggle(d.id)}>
              <Icon name="chev" size={12} style={{ transform: open[d.id] ? "rotate(90deg)" : "none", transition: "transform .12s" }} color="var(--text-secondary)" />
              <Icon name="folder" size={15} color={open[d.id] ? "var(--interactive)" : "var(--text-secondary)"} />
              {d.label.toUpperCase()}
              <span className="cnt">{d.programs.length}</span>
            </div>
            {open[d.id] && (
              <div className="igd">
                {d.programs.map((p) => <FileRow key={p.id} n={p} ext=".cbl" />)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Mainframe entities referenced by the code (mostly no source) ── */}
      <div style={{ height: 1, background: "var(--border-subtle)", margin: "0 0 6px" }} />
      <div style={{ padding: "0 8px 10px" }}>
        <div style={{ padding: "4px 8px 6px", display: "flex", flexDirection: "column", gap: 2 }}>
          <span className="klabel">Mainframe resources</span>
          <span className="sidehint">what the code uses · click: context in the graph</span>
        </div>
        {resources.filter((r) => r.nodes.length).map((r) => (
          <div key={r.id}>
            <div className="row" onClick={() => toggle(r.id)} title={r.hint}>
              <Icon name="chev" size={12} style={{ transform: open[r.id] ? "rotate(90deg)" : "none", transition: "transform .12s" }} color="var(--text-helper)" />
              {r.label}
              <span className="cnt">{r.nodes.length}</span>
            </div>
            {open[r.id] && (
              <div className="igd">
                {r.nodes.map((n) => (
                  <div key={n.id} className={`row ${selectedId === n.id || (n.attrs?.path && selectedPath === n.attrs?.path) ? "sel" : ""}`}
                    onClick={() => onOpenResource(n)} data-testid="tree-file"
                    title={n.attrs?.path ? "Open source code" : "See context in the graph"}>
                    <Icon name={n.attrs?.path ? "file" : "graph"} size={12} color="var(--text-helper)" />
                    {n.label}
                    <span className="tag" style={{ marginLeft: "auto" }}>{TAG[n.kind]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Batch / scheduler (JCL) - jobs, datasets, procs ─────────────── */}
      {batch.some((b) => b.nodes.length) && (
        <>
          <div style={{ height: 1, background: "var(--border-subtle)", margin: "0 0 6px" }} />
          <div style={{ padding: "0 8px 10px" }}>
            <div style={{ padding: "4px 8px 6px", display: "flex", flexDirection: "column", gap: 2 }}>
              <span className="klabel">Batch · scheduler</span>
              <span className="sidehint">JCL processing and batch data · click: context in the graph</span>
            </div>
            {batch.filter((r) => r.nodes.length).map((r) => (
              <div key={r.id}>
                <div className="row" onClick={() => toggle(r.id)} title={r.hint}>
                  <Icon name="chev" size={12} style={{ transform: open[r.id] ? "rotate(90deg)" : "none", transition: "transform .12s" }} color="var(--text-helper)" />
                  {r.label}
                  <span className="cnt">{r.nodes.length}</span>
                </div>
                {open[r.id] && (
                  <div className="igd">
                    {r.nodes.map((n) => (
                      <div key={n.id} className={`row ${selectedId === n.id ? "sel" : ""}`}
                        onClick={() => onOpenResource(n)} data-testid="tree-file"
                        title="See context in the graph">
                        <Icon name="graph" size={12} color="var(--text-helper)" />
                        {n.label}
                        <span className="tag" style={{ marginLeft: "auto" }}>{TAG[n.kind]}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Change-sets ──────────────────────────────────────────────────── */}
      <div style={{ height: 1, background: "var(--border-subtle)", margin: "0 0 6px" }} />
      <div style={{ padding: "0 8px 12px" }} data-testid="sidebar-versions">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px" }}>
          <span className="klabel">Versions</span>
          {!readonly && <button className="btn" style={{ padding: "2px 8px", fontSize: 11 }} onClick={onNewVersion} data-testid="new-version">+ New version</button>}
        </div>
        <div className="sidehint" style={{ padding: "0 8px 6px" }}>
          {readonly ? "read-only system · versioning on the main system" : "isolated changes, reviewed before merge"}
        </div>
        {versions.length === 0 && !readonly && <div style={{ padding: "4px 8px", font: "400 11px var(--s)", color: "var(--text-helper)" }}>No version.</div>}
        {[...versions].sort((a, b) => {
          // What needs the team's attention floats up: proposed, then drafts,
          // then the merged history.
          const rank = (x: typeof a) => (x.status === "proposed" ? 0 : x.status === "draft" ? 1 : 2);
          return rank(a) - rank(b);
        }).map((v) => (
          <div key={v.id} className={`row ${activeVersion === v.id ? "sel" : ""}`}
            style={{ alignItems: "flex-start", flexDirection: "column", gap: 3, padding: "6px 8px",
              /* A proposed version is a request addressed to the team - it gets
                 the accent edge a draft or a closed version does not. */
              borderLeft: v.status === "proposed" ? "2px solid var(--interactive)" : "2px solid transparent" }}
            onClick={() => onOpenVersion(v)} data-testid="version-row">
            <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%" }}>
              <Icon name="branch" size={12} color="var(--interactive)" />
              <span style={{ font: "500 11.5px var(--m)", color: "var(--text-primary)" }}>{v.title}</span>
              <span className={`badge b-${v.status}`} style={{ marginLeft: "auto" }}>{v.status}</span>
            </div>
            <span style={{ font: "400 10px var(--s)", color: v.status === "proposed" ? "var(--link)" : "var(--text-helper)", paddingLeft: 18 }}>
              {v.status === "proposed"
                ? `${v.author} asks for review${v.impact?.programs ? ` · touches ${v.impact.programs.length}` : ""}`
                : `${v.author}${v.impact?.programs ? ` · ${v.impact.programs.length} impacted` : ""}`}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
