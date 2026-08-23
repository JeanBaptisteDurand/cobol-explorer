"""A written record of what a version actually changed, and what it put at risk.

Six months after a merge, the title says "Raise motor cover limit" and the diff says
`+72` - neither tells you that eleven programs and two nightly chains were downstream.
This module writes that down at the moment it is known, so the audit trail carries the
reasoning and not just the bytes.

Two paths, one contract:

- **Grounded summary** - the model reads the real diff and the computed impact, and
  writes three sentences. It never invents a program name: the impact list is passed
  in and quoted back.
- **Deterministic summary** - when no model is reachable (offline, quota, or a
  deployment that deliberately runs without one), the facts are still written, just
  without prose. A missing LLM must degrade the wording, never the record.

The result is stored on the change-set, so it survives the process that produced it.
"""
from __future__ import annotations

import os

MAX_DIFF_CHARS = 6000


def _facts(cs, diffs: dict[str, str]) -> dict:
    """Everything true about the change, before anyone writes a sentence about it."""
    added = removed = 0
    for text in diffs.values():
        for line in text.splitlines():
            if line.startswith("+") and not line.startswith("+++"):
                added += 1
            elif line.startswith("-") and not line.startswith("---"):
                removed += 1
    impact = cs.impact or {}
    return {
        "files": [e["path"] for e in cs.edits],
        "notes": [e.get("note", "") for e in cs.edits if e.get("note")],
        "added": added,
        "removed": removed,
        "programs": [p.split(":")[-1] for p in impact.get("programs", [])],
        "chains": [c.split(":")[-1] for c in impact.get("chains", [])],
    }


def deterministic(cs, diffs: dict[str, str]) -> str:
    """The facts, in one paragraph, with no model involved."""
    f = _facts(cs, diffs)
    if not f["files"]:
        return "No file was edited in this version."

    files = ", ".join(f["files"])
    out = [f"{len(f['files'])} file(s) edited ({files}): +{f['added']} / −{f['removed']} lines."]
    if f["programs"]:
        shown = ", ".join(f["programs"][:6])
        more = f" and {len(f['programs']) - 6} more" if len(f["programs"]) > 6 else ""
        out.append(f"Impact: {len(f['programs'])} program(s): {shown}{more}.")
    if f["chains"]:
        out.append(f"Batch chains affected: {', '.join(f['chains'])}.")
    if f["notes"]:
        out.append(f"Author's note: {f['notes'][0]}")
    return " ".join(out)


def _prompt(cs, diffs: dict[str, str], f: dict) -> str:
    body = []
    for path, text in diffs.items():
        body.append(f"--- {path}\n{text[:MAX_DIFF_CHARS // max(1, len(diffs))]}")
    return (
        "You are writing the permanent record of a change to a COBOL mainframe estate.\n"
        "Write THREE short sentences, no bullet points, no preamble:\n"
        "  1. what was changed, in business terms, from the diff;\n"
        "  2. why it matters - quote the impact figures given below, never invent one;\n"
        "  3. what a reviewer should check before trusting it.\n"
        "Only use program and chain names from the IMPACT list. If the diff is unclear, "
        "say so plainly rather than guessing.\n\n"
        f"TITLE: {cs.title}\nAUTHOR: {cs.author}\n"
        f"FILES: {', '.join(f['files'])}\n"
        f"IMPACT: {len(f['programs'])} programs {f['programs'][:12]}; chains {f['chains']}\n"
        f"AUTHOR NOTES: {'; '.join(f['notes']) or '(none)'}\n\n"
        "DIFF:\n" + "\n".join(body)[:MAX_DIFF_CHARS]
    )


def summarize(cs, diffs: dict[str, str]) -> dict:
    """Return ``{"text", "grounded"}`` - grounded=False means no model was involved.

    Never raises: a summary is a nice-to-have on the merge path, and a model timeout
    must not stop a change from being applied.
    """
    facts = _facts(cs, diffs)
    if not facts["files"]:
        return {"text": deterministic(cs, diffs), "grounded": False}

    try:
        from beeai_framework.backend import ChatModel, UserMessage

        import asyncio

        model = os.environ.get("COBOL_EXPLORER_MODEL", "ollama:granite3.3:8b")

        async def _run() -> str:
            llm = ChatModel.from_name(model)
            reply = await llm.run([UserMessage(_prompt(cs, diffs, facts))])
            return reply.get_text_content().strip()

        text = asyncio.run(asyncio.wait_for(_run(), timeout=45))
        if text:
            return {"text": text, "grounded": True}
    except Exception:
        pass  # offline, no quota, or no backend - the record is still written below
    return {"text": deterministic(cs, diffs), "grounded": False}
