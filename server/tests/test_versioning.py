"""Versioning / change-set flow, incl. the 'insurance value moves' scenario."""
import json
import re

from agent.tools import GraphTools
from run_ingest import ingest
from versioning.changeset import VersionStore


def _setup(tmp_path):
    graph = tmp_path / "g.json"
    ingest("corpora", str(graph))
    store = VersionStore(root=str(tmp_path / "versions"), corpus_root="corpora")
    tools = GraphTools(str(graph), "corpora")
    return store, tools


def test_create_edit_diff_and_impact(tmp_path):
    store, tools = _setup(tmp_path)
    cs = store.create("Hausse valeur assurance auto", author="risk.officer")
    assert cs.id == "hausse-valeur-assurance-auto"
    assert cs.status == "draft"

    rel = "genapp-src/base/src/lgpolicy.cpy"
    original = store.read_effective(cs.id, rel)
    # simulate an insurance-value change: bump the motor field length +65 -> +72
    edited = re.sub(r"(WS-MOTOR-LEN\s+PIC S9\(4\) COMP VALUE \+)65", r"\g<1>72", original, count=1)
    assert edited != original, "expected the copybook to contain the WS-MOTOR-LEN line"
    store.add_edit(cs.id, rel, edited, note="valeur moteur +65 -> +72")

    diff = store.diff(cs.id, rel)
    assert "+65" in diff and "+72" in diff

    impact = store.compute_impact(cs.id, tools)
    assert len(impact["programs"]) >= 3  # LGPOLICY change hits several programs
    assert impact["chains"]  # and a batch chain


def test_collaboration_comments_and_status(tmp_path):
    store, _ = _setup(tmp_path)
    cs = store.create("Test collaboration", author="alice")
    store.add_comment(cs.id, "bob", "Attention au batch de nuit.")
    store.set_status(cs.id, "proposed")
    reloaded = store.get(cs.id)
    assert reloaded.status == "proposed"
    assert reloaded.comments[0]["author"] == "bob"


def test_list_changesets(tmp_path):
    store, _ = _setup(tmp_path)
    store.create("V1", author="a")
    store.create("V2", author="b")
    ids = {c.id for c in store.list()}
    assert {"v1", "v2"} <= ids


def test_impact_of_a_jcl_edit_names_the_programs_it_runs(tmp_path):
    """Editing a .jcl used to resolve to a phantom ``pgm:`` node and report nothing.

    The graph knows the file belongs to a JOB, and a job's blast radius is what its
    steps execute - so the panel must name programs, not stay silent.
    """
    s, gt = _setup(tmp_path)
    jcl = next(
        (n["attrs"]["path"] for n in json.load(open(gt.graph_path))["nodes"]
         if n["kind"] == "JOB" and (n.get("attrs") or {}).get("path")),
        None,
    )
    assert jcl, "the corpus must expose at least one JOB with a source file"

    cs = s.create("edit a batch job", "tester")
    s.add_edit(cs.id, jcl, s.read_effective(cs.id, jcl) + "\n//* touched\n", "note")
    impact = s.compute_impact(cs.id, gt)

    assert impact["by_file"][0]["node"].startswith("job:")
    assert impact["programs"], "a JCL change must surface the programs the job runs"
