"""Scénario d'équipe complet : 3 personas travaillent EN MÊME TEMPS sur le même
programme, avec des erreurs à différents moments — le workflow git doit tenir.

Personas
- Alice  (dev)    : modifie lgpolicy.cpy, fusionne la première.
- Bob    (dev)    : modifie LE MÊME fichier (conflit à venir) ET vide un autre
                    fichier par erreur ; devra résoudre le conflit et se rattraper.
- Chloé  (risque) : propose une modification mais n'a PAS le droit de fusionner
                    (RBAC) ; un dev fusionne pour elle après revue.
"""
import shutil

import pytest

from versioning.git_store import GitVersionStore


@pytest.fixture
def store(tmp_path):
    if not shutil.which("git"):
        pytest.skip("git indisponible")
    corpus = tmp_path / "corpus"
    corpus.mkdir()
    (corpus / "lgpolicy.cpy").write_text(
        "       01 WS-POLICY.\n         05 WS-MOTOR-LEN PIC S9(4) COMP VALUE +65.\n         05 WS-HOUSE-LEN PIC S9(4) COMP VALUE +58.\n"
    )
    (corpus / "lgucdb01.cbl").write_text("       IDENTIFICATION DIVISION.\n       PROGRAM-ID. LGUCDB01.\n")
    (corpus / "regles.cpy").write_text("       01 REGLES.\n         05 TAUX PIC 9(3) VALUE 100.\n")
    return GitVersionStore(str(tmp_path / "versions"), str(corpus))


def test_trois_personas_meme_fichier_avec_erreurs(store):
    # ── t0 : chacun crée SA version (branche personnelle) ──────────────────
    alice = store.create("Hausse plafond moteur", "alice")
    bob = store.create("Refonte longueurs police", "bob")
    chloe = store.create("Ajustement taux réglementaire", "chloé")

    # ── t1 : Alice et Bob modifient LE MÊME fichier, Chloé un autre ────────
    base = store.read_effective(alice.id, "lgpolicy.cpy")
    store.add_edit(alice.id, "lgpolicy.cpy", base.replace("+65", "+72"), "moteur +65 → +72")
    store.add_edit(bob.id, "lgpolicy.cpy", base.replace("+65", "+80"), "moteur +65 → +80 (refonte)")
    store.add_edit(chloe.id, "regles.cpy", "       01 REGLES.\n         05 TAUX PIC 9(3) VALUE 110.\n", "taux 100 → 110")

    # ── t2 : ERREUR de Bob — il vide un fichier sans faire exprès ──────────
    store.add_edit(bob.id, "lgucdb01.cbl", "", "oups")
    assert store.read_effective(bob.id, "lgucdb01.cbl") == ""
    # …il s'en rend compte et RETIRE le fichier de sa version → retour à main
    store.revert_edit(bob.id, "lgucdb01.cbl")
    assert "LGUCDB01" in store.read_effective(bob.id, "lgucdb01.cbl")
    assert all(e["path"] != "lgucdb01.cbl" for e in store.get(bob.id).edits)

    # ── t3 : Alice fusionne la première — main avance ──────────────────────
    store.merge_to_main(alice.id)
    assert "+72" in store._git("show", "main:lgpolicy.cpy")

    # ── t4 : Bob veut fusionner → REFUSÉ (en retard sur main) ──────────────
    assert not store.sync_state(bob.id)["up_to_date"]
    with pytest.raises(ValueError, match="en retard"):
        store.merge_to_main(bob.id)

    # ── t5 : Bob importe main → CONFLIT (même lignes modifiées) ────────────
    with pytest.raises(ValueError, match="conflit"):
        store.sync_main(bob.id)
    # le conflit nomme le fichier pour guider la décision
    try:
        store.sync_main(bob.id)
    except ValueError as e:
        assert "lgpolicy.cpy" in str(e)

    # ── t6 : Bob tranche — il garde SES modifications (stratégie 'mine') ───
    st = store.sync_main(bob.id, strategy="mine")
    assert st["up_to_date"]
    assert "+80" in store.read_effective(bob.id, "lgpolicy.cpy")  # son choix a survécu

    # ── t7 : Bob fusionne — accepté maintenant qu'il est à jour ────────────
    store.merge_to_main(bob.id)
    assert "+80" in store._git("show", "main:lgpolicy.cpy")     # décision explicite de Bob
    assert "LGUCDB01" in store._git("show", "main:lgucdb01.cbl")  # l'erreur de Bob n'a PAS atteint main

    # ── t8 : Chloé, en retard de 2 fusions, importe main SANS conflit ──────
    st = store.sync_state(chloe.id)
    assert st["behind"] >= 2
    st = store.sync_main(chloe.id)  # pas de conflit : fichier différent
    assert st["up_to_date"]
    store.set_status(chloe.id, "proposed")  # elle propose (le RBAC interdit merge aux non-dev — testé côté API)
    store.merge_to_main(chloe.id)  # un dev fusionne pour elle après revue
    assert "110" in store._git("show", "main:regles.cpy")

    # ── bilan : main contient les 3 contributions, sans écrasement muet ────
    final = store._git("show", "main:lgpolicy.cpy")
    assert "+80" in final and "+58" in final


def test_edit_puis_retour_valeur_main_retire_le_fichier(store):
    """Éditer un fichier puis le ré-éditer à la valeur exacte de main doit le RETIRER
    de la version (pas d'entrée fantôme avec un diff vide)."""
    v = store.create("V", "alice")
    base = store.read_effective(v.id, "lgpolicy.cpy")
    store.add_edit(v.id, "lgpolicy.cpy", base.replace("+65", "+72"), "modif")
    assert any(e["path"] == "lgpolicy.cpy" for e in store.get(v.id).edits)
    # ré-édition au contenu d'origine (identique à main)
    store.add_edit(v.id, "lgpolicy.cpy", base, "retour à l'origine")
    assert all(e["path"] != "lgpolicy.cpy" for e in store.get(v.id).edits)  # plus fantôme
    assert store.diff(v.id, "lgpolicy.cpy").strip() == ""


def test_meme_titre_pas_de_collision_de_branche(store):
    a = store.create("Modification LGPOLICY", "alice")
    b = store.create("Modification LGPOLICY", "bob")
    assert a.id != b.id  # deux branches distinctes, pas d'écrasement
    store.add_edit(a.id, "regles.cpy", "A\n", "a")
    store.add_edit(b.id, "regles.cpy", "B\n", "b")
    assert store.read_effective(a.id, "regles.cpy") == "A\n"
    assert store.read_effective(b.id, "regles.cpy") == "B\n"


def test_strategie_prendre_main(store):
    """L'autre résolution : Bob abandonne ses lignes en conflit au profit de main."""
    alice = store.create("A", "alice")
    bob = store.create("B", "bob")
    base = store.read_effective(alice.id, "lgpolicy.cpy")
    store.add_edit(alice.id, "lgpolicy.cpy", base.replace("+65", "+70"), "a")
    store.add_edit(bob.id, "lgpolicy.cpy", base.replace("+65", "+90"), "b")
    store.merge_to_main(alice.id)
    st = store.sync_main(bob.id, strategy="main")
    assert st["up_to_date"]
    assert "+70" in store.read_effective(bob.id, "lgpolicy.cpy")  # main a gagné, son +90 est abandonné


def test_ecritures_concurrentes_meme_working_tree(store):
    """La garantie multi-users : deux personnes écrivant EN MÊME TEMPS sur des
    fichiers différents (donc des branches différentes, un seul working tree git).
    Le verrou partagé du store doit sérialiser les checkout — aucun commit ne doit
    atterrir sur la mauvaise branche, aucun ne doit être perdu."""
    import threading

    alice = store.create("Conc Alice", "alice")
    bob = store.create("Conc Bob", "bob")
    N = 15
    errors: list[str] = []

    def hammer(cid: str, fname: str, tag: str):
        for i in range(N):
            try:
                store.add_edit(cid, fname, f"{tag} v{i}\n", f"{tag} {i}")
            except Exception as exc:  # index.lock / checkout errors would surface here
                errors.append(f"{tag}:{exc}")

    ta = threading.Thread(target=hammer, args=(alice.id, "regles.cpy", "ALICE"))
    tb = threading.Thread(target=hammer, args=(bob.id, "lgucdb01.cbl", "BOB"))
    ta.start(); tb.start(); ta.join(); tb.join()

    assert not errors, f"écritures concurrentes en échec: {errors[:3]}"
    # Chaque branche a exactement ses N commits (rien de perdu), et le contenu final
    # de chaque fichier est bien celui écrit par le bon auteur (pas de contamination).
    assert int(store._git("rev-list", "--count", f"main..{store._branch(alice.id)}").strip()) == N
    assert int(store._git("rev-list", "--count", f"main..{store._branch(bob.id)}").strip()) == N
    assert store.read_effective(alice.id, "regles.cpy") == f"ALICE v{N-1}\n"
    assert store.read_effective(bob.id, "lgucdb01.cbl") == f"BOB v{N-1}\n"
    # Alice n'a jamais touché lgucdb01.cbl : sur sa branche il reste identique à main.
    assert "LGUCDB01" in store.read_effective(alice.id, "lgucdb01.cbl")
