export interface Identity {
  name: string;
  role: string;
}

const KEY = "cobol-explorer-identity";
const TOKEN_KEY = "cobol-explorer-token";
// Labels map (accent-insensitively) to canonical RBAC roles server-side.
export const ROLES = ["Développeur", "Architecte", "Risque", "Conformité", "Auditeur"];

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

/** The signed bearer token from /api/login — absent in the open demo mode. */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/** Persist an authenticated session: the server-issued token wins over any local role. */
export function saveSession(id: Identity, token: string) {
  localStorage.setItem(TOKEN_KEY, token);
  saveIdentity(id);
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(KEY);
}
