"""A full team scenario: three people work on the same program AT THE SAME TIME,
making mistakes at different moments - the git workflow has to hold.

Personas
- Alice  (dev)  : edits lgpolicy.cpy and merges first.
- Bob    (dev)  : edits THE SAME file (a conflict is coming) AND empties another
                  file by mistake; he has to resolve the conflict and recover.
- Chloe  (risk) : proposes a change but is NOT allowed to merge (RBAC); a dev
                  merges on her behalf after review.
"""
import shutil

import pytest

from versioning.git_store import MergeConflict, GitVersionStore


@pytest.fixture
def store(tmp_path):
    if not shutil.which("git"):
        pytest.skip("git unavailable")
    corpus = tmp_path / "corpus"
    corpus.mkdir()
    (corpus / "lgpolicy.cpy").write_text(
        "       01 WS-POLICY.\n         05 WS-MOTOR-LEN PIC S9(4) COMP VALUE +65.\n         05 WS-HOUSE-LEN PIC S9(4) COMP VALUE +58.\n"
    )
    (corpus / "lgucdb01.cbl").write_text("       IDENTIFICATION DIVISION.\n       PROGRAM-ID. LGUCDB01.\n")
    (corpus / "regles.cpy").write_text("       01 REGLES.\n         05 TAUX PIC 9(3) VALUE 100.\n")
    return GitVersionStore(str(tmp_path / "versions"), str(corpus))


def test_three_personas_one_file_with_mistakes(store):
    # -- t0: each of them opens THEIR OWN version (a personal branch) ---------
    alice = store.create("Raise motor cap", "alice")
    bob = store.create("Rework policy lengths", "bob")
    chloe = store.create("Regulatory rate adjustment", "chloe")

    # -- t1: Alice and Bob edit THE SAME file, Chloe another one -------------
    base = store.read_effective(alice.id, "lgpolicy.cpy")
    store.add_edit(alice.id, "lgpolicy.cpy", base.replace("+65", "+72"), "motor +65 -> +72")
    store.add_edit(bob.id, "lgpolicy.cpy", base.replace("+65", "+80"), "motor +65 -> +80 (rework)")
    store.add_edit(chloe.id, "regles.cpy", "       01 REGLES.\n         05 TAUX PIC 9(3) VALUE 110.\n", "rate 100 -> 110")

    # -- t2: Bob's MISTAKE - he empties a file without meaning to ------------
    store.add_edit(bob.id, "lgucdb01.cbl", "", "oops")
    assert store.read_effective(bob.id, "lgucdb01.cbl") == ""
    # ...he notices and REMOVES the file from his version -> back to main
    store.revert_edit(bob.id, "lgucdb01.cbl")
    assert "LGUCDB01" in store.read_effective(bob.id, "lgucdb01.cbl")
    assert all(e["path"] != "lgucdb01.cbl" for e in store.get(bob.id).edits)

    # -- t3: Alice merges first - main moves on ------------------------------
    store.merge_to_main(alice.id)
    assert "+72" in store._git("show", "main:lgpolicy.cpy")

    # -- t4: Bob tries to merge -> REFUSED (he is behind main) ---------------
    assert not store.sync_state(bob.id)["up_to_date"]
    with pytest.raises(ValueError, match="behind main"):
        store.merge_to_main(bob.id)

    # -- t5: Bob imports main -> CONFLICT (the same lines changed) -----------
    with pytest.raises(MergeConflict):
        store.sync_main(bob.id)
    # the conflict names the file, so the decision has something to stand on
    try:
        store.sync_main(bob.id)
    except ValueError as e:
        assert "lgpolicy.cpy" in str(e)

    # -- t6: Bob decides - he keeps HIS changes (strategy 'mine') ------------
    st = store.sync_main(bob.id, strategy="mine")
    assert st["up_to_date"]
    assert "+80" in store.read_effective(bob.id, "lgpolicy.cpy")  # his choice survived

    # -- t7: Bob merges - accepted now that he is up to date -----------------
    store.merge_to_main(bob.id)
    assert "+80" in store._git("show", "main:lgpolicy.cpy")       # Bob's explicit decision
    assert "LGUCDB01" in store._git("show", "main:lgucdb01.cbl")  # his mistake did NOT reach main

    # -- t8: Chloe, two merges behind, imports main WITHOUT a conflict -------
    st = store.sync_state(chloe.id)
    assert st["behind"] >= 2
    st = store.sync_main(chloe.id)  # no conflict: a different file
    assert st["up_to_date"]
    store.set_status(chloe.id, "proposed")  # she proposes (RBAC denies merge to non-devs - tested at the API)
    store.merge_to_main(chloe.id)  # a dev merges for her after review
    assert "110" in store._git("show", "main:regles.cpy")

    # -- outcome: main holds all three contributions, nothing silently lost --
    final = store._git("show", "main:lgpolicy.cpy")
    assert "+80" in final and "+58" in final


def test_editing_back_to_the_main_value_drops_the_file(store):
    """Editing a file and then re-editing it to exactly main's value must REMOVE it
    from the version - no phantom entry carrying an empty diff."""
    v = store.create("V", "alice")
    base = store.read_effective(v.id, "lgpolicy.cpy")
    store.add_edit(v.id, "lgpolicy.cpy", base.replace("+65", "+72"), "change")
    assert any(e["path"] == "lgpolicy.cpy" for e in store.get(v.id).edits)
    # re-edited back to the original content (identical to main)
    store.add_edit(v.id, "lgpolicy.cpy", base, "back to the original")
    assert all(e["path"] != "lgpolicy.cpy" for e in store.get(v.id).edits)  # no phantom left
    assert store.diff(v.id, "lgpolicy.cpy").strip() == ""


def test_same_title_does_not_collide_on_a_branch(store):
    a = store.create("Change LGPOLICY", "alice")
    b = store.create("Change LGPOLICY", "bob")
    assert a.id != b.id  # two distinct branches, no overwrite
    store.add_edit(a.id, "regles.cpy", "A\n", "a")
    store.add_edit(b.id, "regles.cpy", "B\n", "b")
    assert store.read_effective(a.id, "regles.cpy") == "A\n"
    assert store.read_effective(b.id, "regles.cpy") == "B\n"


def test_strategy_take_main(store):
    """The other resolution: Bob gives up his conflicting lines in favour of main."""
    alice = store.create("A", "alice")
    bob = store.create("B", "bob")
    base = store.read_effective(alice.id, "lgpolicy.cpy")
    store.add_edit(alice.id, "lgpolicy.cpy", base.replace("+65", "+70"), "a")
    store.add_edit(bob.id, "lgpolicy.cpy", base.replace("+65", "+90"), "b")
    store.merge_to_main(alice.id)
    st = store.sync_main(bob.id, strategy="main")
    assert st["up_to_date"]
    assert "+70" in store.read_effective(bob.id, "lgpolicy.cpy")  # main won, his +90 is dropped


def test_concurrent_writes_on_one_working_tree(store):
    """The multi-user guarantee: two people writing AT THE SAME TIME to different
    files (so different branches, one single git working tree). The store's shared
    lock has to serialise the checkouts - no commit may land on the wrong branch,
    and none may be lost."""
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

    assert not errors, f"concurrent writes failed: {errors[:3]}"
    # Each branch holds exactly its N commits (nothing lost), and the final content
    # of each file is the one its own author wrote (no cross-contamination).
    assert int(store._git("rev-list", "--count", f"main..{store._branch(alice.id)}").strip()) == N
    assert int(store._git("rev-list", "--count", f"main..{store._branch(bob.id)}").strip()) == N
    assert store.read_effective(alice.id, "regles.cpy") == f"ALICE v{N-1}\n"
    assert store.read_effective(bob.id, "lgucdb01.cbl") == f"BOB v{N-1}\n"
    # Alice never touched lgucdb01.cbl: on her branch it stays identical to main.
    assert "LGUCDB01" in store.read_effective(alice.id, "lgucdb01.cbl")
