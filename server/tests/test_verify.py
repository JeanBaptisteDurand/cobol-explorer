"""The citation guardrail: what the "sources verified" badge is allowed to claim.

These are regressions from production. The badge read "unsourced answer" under an
answer that was, in fact, fully cited — twice, for two different reasons:
  1. the model cited the entity (`LGACDB01`) or wrote the line as "(line 88)" rather
     than the `file:line` the parser expected;
  2. file lookup was case-sensitive, so `LGACDB01.cbl` resolved on macOS (where the
     filesystem is not) and resolved nowhere on the Linux host actually serving it.
"""
import pytest

from agent.verify import verify_answer

CORPUS = "corpora"


def _cites(text: str) -> dict[str, int | None]:
    return {c["file"].lower(): c["line"] for c in verify_answer(text, [], CORPUS)["citations"]}


@pytest.mark.parametrize(
    "text",
    [
        "see lgacdb01.cbl:88",
        "see LGACDB01.cbl:88",
        "see `LGACDB01.cbl` (line 88)",
        "see LGACDB01.cbl (ligne 88)",
        "see `lgacdb01.cbl` [line 88]",
    ],
)
def test_every_spelling_of_one_citation_resolves_to_the_same_fact(text):
    assert _cites(text) == {"lgacdb01.cbl": 88}


def test_an_entity_cited_by_name_is_resolved_to_its_file():
    assert _cites("impacted: `LGUPDB01` (line 102)") == {"lgupdb01.cbl": 102}


def test_a_line_past_the_end_of_the_file_is_refused():
    r = verify_answer("see `lgacdb01.cbl` (line 99999)", [], CORPUS)
    assert r["all_grounded"] is False
    assert "out of range" in r["citations"][0]["reason"]


def test_an_invented_file_is_refused():
    r = verify_answer("see ghostprogram.cbl:1", [], CORPUS)
    assert r["all_grounded"] is False and r["citations"][0]["reason"] == "file not found"


def test_a_full_production_answer_is_grounded():
    """The exact shape watsonx returns for the hero question."""
    answer = """Changing **copybook LGPOLICY** would break the following programs:

**Programs**
- `LGACDB01.cbl` (line 88)
- `LGIPOL01.cbl` (line 55)
- `LGBATCH.cbl` (line 19)
"""
    r = verify_answer(answer, [], CORPUS)
    assert r["count"] == 3
    assert r["grounded"] is True


def test_an_answer_without_any_citation_is_not_grounded():
    r = verify_answer("Eleven programs are impacted.", [], CORPUS)
    assert r["count"] == 0
    assert r["grounded"] is False  # strict: no citation, no credit
    assert r["all_grounded"] is True  # vacuous: the badge stays hidden
