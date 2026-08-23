export interface GNode {
  id: string;
  kind: string;
  label: string;
  attrs: Record<string, any>;
}
export interface GEdge {
  src: string;
  dst: string;
  kind: string;
  evidence: Record<string, any>;
}
export interface Graph {
  nodes: GNode[];
  edges: GEdge[];
  stats: { nodes: number; edges: number };
}
export interface TraceStep {
  tool: string;
  input: any;
  output_summary: string;
  sources: string[];
}
export interface Comment {
  author: string;
  text: string;
  at: string;
}
export interface ChangeSet {
  /** Written record of what the version changes - {text, grounded, at}. */
  summary?: { text: string; grounded?: boolean; at?: string };
  id: string;
  title: string;
  author: string;
  base: string;
  status: string;
  created_at: string;
  edits: { path: string; note: string }[];
  comments: Comment[];
  impact: { programs?: string[]; chains?: string[]; by_file?: any[] };
  // Git sync vs main (team branch): behind/ahead commit counts.
  sync?: { behind: number; ahead: number; up_to_date: boolean } | null;
}
