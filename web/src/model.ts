import type { GNode, Graph } from "./types";

export interface Dep {
  id: string;
  label: string;
  line?: number;
  kind: string;
}

export function nodeIndex(g: Graph): Map<string, GNode> {
  const m = new Map<string, GNode>();
  g.nodes.forEach((n) => m.set(n.id, n));
  return m;
}

export function domainsTree(g: Graph) {
  const domainOf = new Map<string, string>();
  g.edges.forEach((e) => {
    if (e.kind === "DOMAIN_GROUPS") domainOf.set(e.dst, e.src);
  });
  const domains = g.nodes
    .filter((n) => n.kind === "DOMAIN")
    .map((d) => ({
      id: d.id,
      label: d.label,
      programs: g.nodes
        .filter((n) => n.kind === "PGM" && domainOf.get(n.id) === d.id)
        .sort((a, b) => a.label.localeCompare(b.label)),
    }))
    .sort((a, b) => b.programs.length - a.programs.length);
  // Programs not mapped to any business domain (a system may have no domain
  // mapping at all, e.g. CardDemo). List them so the tree is never empty and no
  // program (e.g. GenApp's LGBATCH) is hidden.
  const ungrouped = g.nodes
    .filter((n) => n.kind === "PGM" && !domainOf.has(n.id) && n.attrs?.path)
    .sort((a, b) => a.label.localeCompare(b.label));
  const groups = [...domains];
  if (ungrouped.length) groups.push({ id: "ungrouped", label: domains.length ? "Autres programmes" : "Programmes", programs: ungrouped });
  return { domains, groups, ungrouped };
}

export function copybookFanIn(g: Graph) {
  const counts = new Map<string, number>();
  g.edges.forEach((e) => {
    if (e.kind === "PGM_COPIES") counts.set(e.dst, (counts.get(e.dst) || 0) + 1);
  });
  return g.nodes
    .filter((n) => n.kind === "COPYBOOK")
    .map((n) => ({ node: n, count: counts.get(n.id) || 0 }))
    .sort((a, b) => b.count - a.count);
}

export function batchChains(g: Graph) {
  const runs = g.edges.filter((e) => e.kind === "SCHED_RUNS");
  const triggers = g.edges.filter((e) => e.kind === "SCHED_TRIGGERS");
  return g.nodes
    .filter((n) => n.kind === "SCHED_JOB")
    .map((s) => ({
      id: s.id,
      label: s.label,
      jobs: runs.filter((e) => e.src === s.id).map((e) => e.dst.split(":")[1]),
      after: triggers.filter((e) => e.dst === s.id).map((e) => e.src.split(":")[1]),
    }));
}

export function outDeps(g: Graph, id: string, kinds: string[]): Dep[] {
  const idx = nodeIndex(g);
  return g.edges
    .filter((e) => e.src === id && kinds.includes(e.kind))
    .map((e) => ({ id: e.dst, label: idx.get(e.dst)?.label || e.dst, line: e.evidence?.line, kind: e.kind }));
}

export function inDeps(g: Graph, id: string, kinds: string[]): Dep[] {
  const idx = nodeIndex(g);
  return g.edges
    .filter((e) => e.dst === id && kinds.includes(e.kind))
    .map((e) => ({ id: e.src, label: idx.get(e.src)?.label || e.src, line: e.evidence?.line, kind: e.kind }));
}

export const fileOfNode = (n?: GNode): string | undefined => n?.attrs?.path as string | undefined;

/** Source file extensions a citation can point at — the single list the UI trusts. */
export const SOURCE_EXT = ["cbl", "cpy", "jcl", "bms", "csd"];
const CITATION = new RegExp(`^([\\w.-]+\\.(?:${SOURCE_EXT.join("|")}))(?::(\\d+))?$`, "i");

/** A trace step's `sources` entry is one of three things: a citation (`lgipol01.cbl:55`),
 *  a graph node id (`copy:LGPOLICY`) or a web URL. Every consumer decodes it here, so
 *  the three cases stay in sync — clicking a source used to be a silent no-op because
 *  the whole `file:line` string was handed over as a file name. */
export type Source =
  | { kind: "citation"; file: string; line?: number }
  | { kind: "node"; id: string }
  | { kind: "url"; url: string };

export function parseSource(src: string): Source {
  if (/^https?:\/\//i.test(src)) return { kind: "url", url: src };
  const m = CITATION.exec(src.trim());
  if (m) return { kind: "citation", file: m[1], line: m[2] ? Number(m[2]) : undefined };
  return { kind: "node", id: src.trim() };
}
export const kindCount = (g: Graph) => {
  const c: Record<string, number> = {};
  g.nodes.forEach((n) => (c[n.kind] = (c[n.kind] || 0) + 1));
  return c;
};
