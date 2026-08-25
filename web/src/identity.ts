export interface Identity {
  name: string;
  role: string;
}

const KEY = "cobol-explorer-identity";
const TOKEN_KEY = "cobol-explorer-token";
// Labels map (accent-insensitively) to canonical RBAC roles server-side.
// English, and the same vocabulary the server returns from /api/auth/config -
// the two lists were drifting, one French and one not.
export const ROLES = ["Developer", "Architect", "Risk", "Compliance", "Auditor"];

export function getIdentity(): Identity | null {
  try {
    const s = localStorage.getItem(KEY);
    return s ? (JSON.parse(s) as Identity) : null;
  } catch {
    return null;
  }
}

export function saveIdentity(id: Identity) {
  localStorage.setItem(KEY, JSON.stringify(id));
}

/** The signed bearer token from /api/login - absent in the open demo mode. */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/** Persist an authenticated session: the server-issued token wins over any local role. */
export function saveSession(id: Identity, token: string) {
  localStorage.setItem(TOKEN_KEY, token);
  saveIdentity(id);
}

const HOME_KEY = "cobol-explorer-home";

/** Is this signed token still alive? Client-side read of the exp claim only -
 *  the server re-verifies the signature on every call regardless. */
function tokenAlive(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" && payload.exp * 1000 > Date.now() + 30_000;
  } catch {
    return false;
  }
}

/** Before switching to a demo account, remember the REAL session - once.
 *  Hopping between demo accounts keeps the original stash, so "back to my
 *  account" always means the account the tour of roles started from. */
export function stashHomeSession() {
  if (localStorage.getItem(HOME_KEY)) return;
  const token = getToken(); const id = getIdentity();
  if (token && id) localStorage.setItem(HOME_KEY, JSON.stringify({ token, identity: id }));
}

/** The stashed real session, if it exists and its token has not expired. */
export function getHomeSession(): { token: string; identity: Identity } | null {
  try {
    const raw = localStorage.getItem(HOME_KEY);
    if (!raw) return null;
    const home = JSON.parse(raw);
    if (!home?.token || !tokenAlive(home.token)) { localStorage.removeItem(HOME_KEY); return null; }
    return home;
  } catch {
    return null;
  }
}

export function restoreHomeSession(): Identity | null {
  const home = getHomeSession();
  if (!home) return null;
  saveSession(home.identity, home.token);
  localStorage.removeItem(HOME_KEY);
  return home.identity;
}

export function clearHomeSession() {
  localStorage.removeItem(HOME_KEY);
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(KEY);
}

/** A federated sign-in comes back as `/#token=…&name=…&role=…`. The fragment never
 *  reaches a server, so the token is not in any access log - read it once, store it,
 *  and scrub it from the address bar. */
export function consumeFragmentSession(): Identity | null {
  if (!window.location.hash.startsWith("#token=")) return null;
  const p = new URLSearchParams(window.location.hash.slice(1));
  const token = p.get("token"), name = p.get("name"), role = p.get("role");
  history.replaceState(null, "", window.location.pathname + window.location.search);
  if (!token || !name || !role) return null;
  const id = { name, role };
  saveSession(id, token);
  return id;
}
