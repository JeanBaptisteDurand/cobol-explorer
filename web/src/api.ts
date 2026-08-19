import { getIdentity, getToken, type Identity } from "./identity";
import type { ChangeSet, Graph } from "./types";

const j = (r: Response) => r.json();
// Attach the caller identity so the server can audit (who) and enforce RBAC (role).
// A signed token, when we have one, is what the server actually trusts; the
// X-Cobol-* headers stay for the open demo mode (they prove nothing on their own).
const authHeaders = (): Record<string, string> => {
  const id = getIdentity();
  const token = getToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    // HTTP header values are latin-1; URL-encode so accented names/roles survive (decoded server-side).
    ...(id ? { "X-Cobol-User": encodeURIComponent(id.name), "X-Cobol-Role": encodeURIComponent(id.role) } : {}),
  };
};
const post = (url: string, body: any) =>
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  }).then(async (r) => {
    const d = await r.json();
    if (!r.ok) throw new Error(d?.detail || "erreur serveur"); // surface 409s (merge/sync refusés)
    return d;
  });

export interface SystemInfo { id: string; label: string; detail: string; nodes: number; edges: number; readonly?: boolean; }
export const getSystems = (): Promise<{ active: string; systems: SystemInfo[] }> => fetch("/api/systems").then(j);
export const setSystem = (id: string) => post("/api/system", { id });

export const getGraph = (): Promise<Graph> => fetch("/api/graph", { headers: authHeaders() }).then(j);

export interface AuthConfig { mode: string; required: boolean; roles: string[]; }
/** Does this server require a real login, or is it the open demo? Asked before anything else. */
export const getAuthConfig = (): Promise<AuthConfig> => fetch("/api/auth/config").then(j);
export const login = (username: string, password: string): Promise<Identity & { token: string }> =>
  post("/api/login", { username, password });
export const getImpact = (node: string) =>
  fetch(`/api/impact?node=${encodeURIComponent(node)}`, { headers: authHeaders() }).then(j);
export const getAudit = (n = 100) =>
  fetch(`/api/audit?n=${n}`, { headers: authHeaders() }).then(j);
export const getQuality = () => fetch("/api/quality", { headers: authHeaders() }).then(j);
export const getFields = (node: string) =>
  fetch(`/api/fields?node=${encodeURIComponent(node)}`, { headers: authHeaders() }).then(j);
export const getSearch = (q: string) =>
  fetch(`/api/search?q=${encodeURIComponent(q)}`, { headers: authHeaders() }).then(j);
export const getFileFull = (path: string) =>
  fetch(`/api/file?path=${encodeURIComponent(path)}`, { headers: authHeaders() }).then(j);

export const listChangeSets = (): Promise<ChangeSet[]> => fetch("/api/changesets", { headers: authHeaders() }).then(j);
export const createChangeSet = (title: string, author: string): Promise<ChangeSet> =>
  post("/api/changesets", { title, author });
export const getCsFile = (id: string, path: string) =>
  fetch(`/api/changesets/${id}/file?path=${encodeURIComponent(path)}`, { headers: authHeaders() }).then(j);
export const editCsFile = (id: string, path: string, content: string, note: string): Promise<ChangeSet> =>
  post(`/api/changesets/${id}/edit`, { path, content, note });
export const getCsDiff = (id: string, path: string) =>
  fetch(`/api/changesets/${id}/diff?path=${encodeURIComponent(path)}`, { headers: authHeaders() }).then(j);
export const csComment = (id: string, author: string, text: string) =>
  post(`/api/changesets/${id}/comment`, { author, text });
export const csStatus = (id: string, status: string) =>
  post(`/api/changesets/${id}/status`, { status });
export const csRevert = (id: string, path: string) =>
  post(`/api/changesets/${id}/revert`, { path });
export const csSync = (id: string, strategy?: "mine" | "main") =>
  post(`/api/changesets/${id}/sync`, { strategy: strategy ?? null });

/** POST /api/ask and stream SSE events (start/trace/answer/error/done). */
export async function ask(
  question: string,
  history: { role: string; text: string }[],
  onEvent: (type: string, data: any) => void,
) {
  const res = await fetch("/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ question, history }),
  });
  // An error response (403 RBAC / 500) is JSON, not an SSE stream — surface it
  // instead of silently parsing an empty stream and showing "no answer".
  if (!res.ok || !res.body) {
    let detail = `erreur serveur (${res.status})`;
    try { detail = (await res.json())?.detail || detail; } catch { /* not json */ }
    throw new Error(detail);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  const flush = (final: boolean) => {
    // SSE frames are separated by a blank line; sse_starlette uses CRLF.
    buf = buf.replace(/\r\n/g, "\n");
    const chunks = buf.split("\n\n");
    buf = final ? "" : chunks.pop() || "";
    for (const chunk of chunks) parseChunk(chunk, onEvent);
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      flush(true);
      break;
    }
    buf += dec.decode(value, { stream: true });
    flush(false);
  }
}

function parseChunk(chunk: string, onEvent: (type: string, data: any) => void) {
  let ev = "message";
  let data = "";
  for (const line of chunk.split("\n")) {
    if (line.startsWith("event:")) ev = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  if (data) {
    try {
      onEvent(ev, JSON.parse(data));
    } catch {
      onEvent(ev, data);
    }
  }
}
