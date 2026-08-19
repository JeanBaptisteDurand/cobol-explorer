export interface Identity {
  name: string;
  role: string;
}

const KEY = "cobol-explorer-identity";
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
