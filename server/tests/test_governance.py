"""Governance: RBAC policy, tamper-evident audit chain, citation guardrail."""
from agent.verify import verify_answer
from security import rbac
from security.audit import AuditLog


def test_rbac_policy():
    assert rbac.allowed("dev", "merge")
    assert not rbac.allowed("risk", "merge")     # risk proposes but cannot merge
    assert not rbac.allowed("guest", "merge")
    assert rbac.allowed("risk", "propose")
    assert rbac.allowed("auditor", "audit")
    assert not rbac.allowed("dev", "audit")
    assert rbac.canonical("Développeur") == "dev"
    assert rbac.canonical(None) == "guest"


def test_ui_role_labels_all_canonicalize():
    # Every label shipped in web/src/identity.ts must map to a real role (not guest).
    for label, want in [("Développeur", "dev"), ("Architecte", "architect"),
                        ("Risque", "risk"), ("Conformité", "compliance"), ("Auditeur", "auditor")]:
        assert rbac.canonical(label) == want, label
    # legacy label still maps
    assert rbac.canonical("Risque & Conformité") == "risk"


def test_audit_chain_is_tamper_evident(tmp_path):
    log = AuditLog(str(tmp_path / "a.jsonl"))
    log.record("alice", "dev", "ask", "q1")
    log.record("bob", "risk", "propose", "v1")
    assert len(log.recent()) == 2
    assert log.verify_chain()
    # Altering a past line must break the hash chain.
    p = tmp_path / "a.jsonl"
    p.write_text(p.read_text().replace("alice", "eve"))
    assert not log.verify_chain()


def test_citation_guardrail_flags_hallucinations():
    ok = verify_answer("preuve lgipol01.cbl:55", ["lgipol01.cbl:55"], "corpora")
    assert ok["count"] >= 1 and ok["all_grounded"]
    bad = verify_answer("d'après fantome.cbl:999", [], "corpora")
    assert not bad["all_grounded"]
