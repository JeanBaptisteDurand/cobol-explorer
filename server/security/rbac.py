"""Role-based access control for the two gestures (comprendre vs modifier).

Roles map to the mainframe org: dev (change), risk/compliance (read + govern),
auditor (read + audit). Enforcement is opt-in via ``COBOL_EXPLORER_AUTH=enforce``
so the demo stays open; the policy itself is always testable.
"""
from __future__ import annotations

import unicodedata

ROLES = ("guest", "dev", "architect", "risk", "compliance", "auditor")


def _norm(s: str) -> str:
    """Lower + strip accents, so 'Risk & Conformité' and 'risk & conformite' match."""
    return "".join(c for c in unicodedata.normalize("NFD", s.strip().lower()) if unicodedata.category(c) != "Mn")

# action -> roles allowed to perform it
POLICY: dict[str, set[str]] = {
    "read": {"guest", "dev", "architect", "risk", "compliance", "auditor"},
    "ask": {"guest", "dev", "architect", "risk", "compliance", "auditor"},
    "comment": {"dev", "architect", "risk", "compliance"},
    "propose": {"dev", "architect", "risk"},   # create a version / edit a file
    "edit": {"dev", "architect", "risk"},
    "merge": {"dev", "architect"},             # apply a change to the patrimony
    "audit": {"compliance", "auditor"},
}

# Free-text UI role labels -> canonical role (keys are accent-stripped / lowercased).
_ALIASES = {
    "developpeur": "dev", "developer": "dev", "dev": "dev",
    "architecte": "architect", "architecte de modernisation": "architect", "architect": "architect",
    "risque": "risk", "risk": "risk", "risque & conformite": "risk", "risk & conformite": "risk",
    "risk officer": "risk", "risk.officer": "risk",
    "conformite": "compliance", "compliance": "compliance",
    "auditeur": "auditor", "auditor": "auditor",
}


def canonical(role: str | None) -> str:
    if not role:
        return "guest"
    n = _norm(role)
    return _ALIASES.get(n, n if n in ROLES else "guest")


def allowed(role: str | None, action: str) -> bool:
    return canonical(role) in POLICY.get(action, set())
