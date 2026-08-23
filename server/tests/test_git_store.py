"""Git-backed versioning: a change-set is a branch, an edit is a commit, the diff
is a real git diff - and main stays pristine. Skips if git is unavailable."""
import shutil

import pytest

from versioning.git_store import GitVersionStore


@pytest.fixture
def store(tmp_path):
    if not shutil.which("git"):
        pytest.skip("git indisponible")
    corpus = tmp_path / "corpus"
    corpus.mkdir()
    (corpus / "lgpolicy.cpy").write_text("       01 REC.\n         05 A PIC X.\n")
    return GitVersionStore(str(tmp_path / "versions"), str(corpus))


def test_branch_edit_diff_keeps_main_pristine(store):
    cs = store.create("modif A", "alice")
    store.add_edit(cs.id, "lgpolicy.cpy", "       01 REC.\n         05 A PIC XX.\n", "widen A")
    # effective content is the branch version
    assert "PIC XX" in store.read_effective(cs.id, "lgpolicy.cpy")
    # a REAL git diff
    d = store.diff(cs.id, "lgpolicy.cpy")
    assert d.startswith("diff --git") and "PIC XX" in d and "-" in d
    # main (the patrimony) is untouched
    assert "PIC X." in store.read_original("lgpolicy.cpy")
    assert "PIC XX" not in store.read_original("lgpolicy.cpy")


def test_revert_edit_restores_team_version(store):
    """The 'I accidentally emptied a file' scenario: revert drops the file from the version."""
    cs = store.create("oups", "alice")
    store.add_edit(cs.id, "lgpolicy.cpy", "", "file emptied by mistake")
    assert store.read_effective(cs.id, "lgpolicy.cpy") == ""
    store.revert_edit(cs.id, "lgpolicy.cpy")
    assert "PIC X." in store.read_effective(cs.id, "lgpolicy.cpy")  # back to main's content
    assert store.get(cs.id).edits == []


def test_team_workflow_merge_requires_up_to_date(store):
    """Two branches: merging the first moves main; the second is then behind and
    cannot merge until it imports main."""
    a = store.create("modif alice", "alice")
    b = store.create("modif bob", "bob")
    store.add_edit(a.id, "lgpolicy.cpy", "       01 REC.\n         05 A PIC XX.\n", "a")
    store.add_edit(b.id, "other.cpy", "       01 AUTRE PIC X.\n", "b")
    # alice merges first -> main advances
    store.merge_to_main(a.id)
    assert store.get(a.id).status == "merged"
    st = store.sync_state(b.id)
    assert st["behind"] > 0 and not st["up_to_date"]
    # bob cannot merge while behind
    import pytest as _pt
    with _pt.raises(ValueError):
        store.merge_to_main(b.id)
    # bob imports main, then merge succeeds
    st2 = store.sync_main(b.id)
    assert st2["up_to_date"]
    store.merge_to_main(b.id)
    assert store.get(b.id).status == "merged"
    # main now contains both changes
    assert "PIC XX" in store._git("show", "main:lgpolicy.cpy")
    assert "AUTRE" in store._git("show", "main:other.cpy")


def test_metadata_and_listing(store):
    cs = store.create("modif B", "bob")
    store.add_comment(cs.id, "carol", "revue OK")
    store.set_status(cs.id, "proposed")
    got = store.get(cs.id)
    assert got.status == "proposed" and got.comments and got.comments[0]["author"] == "carol"
    assert any(c.id == cs.id for c in store.list())
