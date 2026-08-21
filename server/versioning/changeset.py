"""Change-sets (versions): propose edits as a new version, see impact, diff, collaborate.

A ChangeSet is a named, authored branch off ``main`` (or another change-set). It
holds file edits (e.g. modify a copybook because an insurance value changed),
the computed impact (which programs / batch chains are affected), comments (team
collaboration) and a status (draft/proposed/merged). Stored as JSON + edited
file copies under a versions dir — no database needed.

This is the "operations" layer: a risk/compliance user proposes a change, the
system shows what it breaks (via the impact engine), edits happen in an isolated
version, and teams review by diff + comments before merging.
"""
from __future__ import annotations

import datetime
import difflib
import json
import os
import re
from dataclasses import asdict, dataclass, field


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "changeset"


def _now() -> str:
    return datetime.datetime.now().isoformat(timespec="seconds")


@dataclass
class ChangeSet:
    id: str
    title: str
    author: str
    base: str = "main"
    status: str = "draft"  # draft | proposed | merged | rejected
    created_at: str = ""
    edits: list[dict] = field(default_factory=list)  # {path, note}
    comments: list[dict] = field(default_factory=list)  # {author, text, at}
    impact: dict = field(default_factory=dict)  # {programs, chains}
    # Written when the version is merged (or on demand): what changed, what it put at
    # risk, what to check. {text, grounded, at} — grounded=False means no model wrote it.
    summary: dict = field(default_factory=dict)


class VersionStore:
    """Filesystem-backed store: ``versions/<id>/changeset.json`` + ``files/``."""

    def __init__(self, root: str = "versions", corpus_root: str = "corpora"):
        self.root = root
        self.corpus_root = corpus_root
        os.makedirs(root, exist_ok=True)

    # --- paths ---
    def _dir(self, cid: str) -> str:
        return os.path.join(self.root, cid)

    def _meta(self, cid: str) -> str:
        return os.path.join(self._dir(cid), "changeset.json")

    def original_path(self, rel: str) -> str:
        from safe import safe_corpus_path

        p = safe_corpus_path(self.corpus_root, rel)
        if not p:
            raise ValueError(f"path escapes corpus: {rel!r}")
        return p

    def edited_path(self, cid: str, rel: str) -> str:
        return os.path.join(self._dir(cid), "files", rel.replace("/", "__"))

    # --- crud ---
    def _unique_id(self, title: str) -> str:
        """Slug of the title, suffixed if a version with the same slug already exists
        (two 'Modification LGPOLICY' must not share a branch)."""
        base = _slug(title)
        cid, i = base, 2
        while self.exists(cid):
            cid = f"{base}-{i}"
            i += 1
        return cid

    def create(self, title: str, author: str, base: str = "main", now: str | None = None) -> ChangeSet:
        cid = self._unique_id(title)
        cs = ChangeSet(id=cid, title=title, author=author, base=base, created_at=now or _now())
        os.makedirs(os.path.join(self._dir(cid), "files"), exist_ok=True)
        self._save(cs)
        return cs

    def _save(self, cs: ChangeSet) -> None:
        os.makedirs(self._dir(cs.id), exist_ok=True)
        with open(self._meta(cs.id), "w") as fh:
            json.dump(asdict(cs), fh, indent=2)

    def exists(self, cid: str) -> bool:
        return os.path.exists(self._meta(cid))

    def get(self, cid: str) -> ChangeSet:
        with open(self._meta(cid)) as fh:
            return ChangeSet(**json.load(fh))

    def list(self) -> list[ChangeSet]:
        if not os.path.isdir(self.root):
            return []
        return [self.get(cid) for cid in sorted(os.listdir(self.root)) if self.exists(cid)]

    # --- editing ---
    def read_effective(self, cid: str, rel: str) -> str:
        ep = self.edited_path(cid, rel)
        path = ep if os.path.exists(ep) else self.original_path(rel)
        with open(path, errors="replace") as fh:
            return fh.read()

    def add_edit(self, cid: str, rel: str, new_content: str, note: str = "") -> ChangeSet:
        cs = self.get(cid)
        ep = self.edited_path(cid, rel)
        os.makedirs(os.path.dirname(ep), exist_ok=True)
        with open(ep, "w") as fh:
            fh.write(new_content)
        if not any(e["path"] == rel for e in cs.edits):
            cs.edits.append({"path": rel, "note": note})
        self._save(cs)
        return cs

    def diff(self, cid: str, rel: str) -> str:
        with open(self.original_path(rel), errors="replace") as fh:
            orig = fh.read().splitlines()
        new = self.read_effective(cid, rel).splitlines()
        return "\n".join(
            difflib.unified_diff(orig, new, fromfile=f"a/{rel}", tofile=f"b/{rel}", lineterm="")
        )

    # --- team workflow (overridden with real git semantics in GitVersionStore) ---
    def revert_edit(self, cid: str, rel: str) -> ChangeSet:
        """Drop a file from the change-set: its content goes back to the team version."""
        cs = self.get(cid)
        ep = self.edited_path(cid, rel)
        if os.path.exists(ep):
            os.remove(ep)
        cs.edits = [e for e in cs.edits if e["path"] != rel]
        self._save(cs)
        return cs

    def sync_state(self, cid: str) -> dict:
        """How this version relates to main. The JSON store reads the live corpus,
        so it is always up to date; 'ahead' counts the edited files."""
        return {"behind": 0, "ahead": len(self.get(cid).edits), "up_to_date": True}

    def sync_main(self, cid: str, strategy: str | None = None) -> dict:
        """Import main into this version (no-op for the JSON store)."""
        return self.sync_state(cid)

    def merge_to_main(self, cid: str) -> ChangeSet:
        """Apply the version to the team branch. Real merge in the git store."""
        return self.set_status(cid, "merged")

    # --- collaboration ---
    def add_comment(self, cid: str, author: str, text: str, now: str | None = None) -> ChangeSet:
        cs = self.get(cid)
        cs.comments.append({"author": author, "text": text, "at": now or _now()})
        self._save(cs)
        return cs

    def set_summary(self, cid: str, summary: dict) -> ChangeSet:
        """Attach the written record of the change and persist it."""
        cs = self.get(cid)
        cs.summary = {**summary, "at": _now()}
        self._save(cs)
        return cs

    def set_status(self, cid: str, status: str) -> ChangeSet:
        cs = self.get(cid)
        cs.status = status
        self._save(cs)
        return cs

    # --- impact ---
    def compute_impact(self, cid: str, graphtools) -> dict:
        """Union impact of all edited files (copybook/program) via the graph."""
        cs = self.get(cid)
        programs: set[str] = set()
        chains: set[str] = set()
        details: list[dict] = []
        for e in cs.edits:
            base = os.path.basename(e["path"])
            name = base.split(".")[0].upper()
            # Ask the graph which node this file is; only fall back to the extension
            # heuristic for a file the corpus does not know (a brand-new source).
            node = graphtools.node_for_path(e["path"]) or (
                f"copy:{name}" if base.lower().endswith(".cpy") else f"pgm:{name}"
            )
            r = graphtools.graph_lookup("impact", node)
            progs = [p["id"] if isinstance(p, dict) else p for p in r.get("programs", [])]
            programs.update(progs)
            chains.update(r.get("chains", []))
            details.append({"file": e["path"], "node": node, "programs": progs, "chains": r.get("chains", [])})
        cs.impact = {"programs": sorted(programs), "chains": sorted(chains), "by_file": details}
        self._save(cs)
        return cs.impact
