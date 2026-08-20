"""Git-backed change-sets — versioning on real git instead of a hand-rolled store.

A change-set is a **git branch** off ``main``; each edit is a **commit**; the diff is
a real ``git diff``. File content and history live in git; the PR-style metadata
(title, author, status, comments, impact) stays as JSON — exactly the layer Gitea /
GitHub add on top of git. Selected with ``COBOL_EXPLORER_VCS=git``; same API as
``VersionStore`` so the API and UI are unchanged. Single-worker (dev) — production
would use per-branch worktrees or the Gitea API.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import threading

from versioning.changeset import ChangeSet, VersionStore, _now


class MergeConflict(ValueError):
    """Both sides edited the same lines. Carries the file list so the API can hand
    the UI a typed error instead of a message it would have to pattern-match."""

    def __init__(self, message: str, files: list[str] | None = None):
        super().__init__(message)
        self.files = files or []


class GitVersionStore(VersionStore):
    def __init__(self, root: str = "versions", corpus_root: str = "corpora"):
        super().__init__(root, corpus_root)
        self.repo = os.path.join(root, "repo")
        self.meta_dir = os.path.join(root, "meta")
        os.makedirs(self.meta_dir, exist_ok=True)
        self._lock = threading.Lock()
        self._ensure_repo()
        self._migrate_legacy()

    # --- git plumbing ---
    def _git(self, *args: str, check: bool = True) -> str:
        # errors="replace": mainframe source is often EBCDIC/Latin-1; a non-UTF-8 byte
        # in a file must not crash git plumbing with a UnicodeDecodeError.
        r = subprocess.run(["git", "-C", self.repo, *args], capture_output=True, text=True, errors="replace")
        if check and r.returncode != 0:
            raise RuntimeError(f"git {' '.join(args)}: {r.stderr.strip()}")
        return r.stdout

    def _ensure_repo(self) -> None:
        if os.path.isdir(os.path.join(self.repo, ".git")):
            return
        os.makedirs(self.repo, exist_ok=True)
        # seed the repo with the corpus on main (skip nested .git dirs — e.g. the
        # cloned GenApp repo — which git would otherwise treat as submodules)
        src = os.path.realpath(self.corpus_root)
        for dirpath, dirs, files in os.walk(src):
            dirs[:] = [d for d in dirs if d != ".git"]
            for f in files:
                sp = os.path.join(dirpath, f)
                rel = os.path.relpath(sp, src)
                dp = os.path.join(self.repo, rel)
                os.makedirs(os.path.dirname(dp), exist_ok=True)
                shutil.copy2(sp, dp)
        self._git("init", "-q", "-b", "main")
        self._git("config", "user.email", "explorer@cobol")
        self._git("config", "user.name", "COBOL Explorer")
        self._git("add", "-A")
        self._git("commit", "-q", "-m", "seed: corpus")

    def _branch(self, cid: str) -> str:
        return f"cs/{cid}"

    def _safe_repo_path(self, rel: str) -> str:
        """Confine a client-supplied path to the repo working tree. Without this a
        crafted ``path`` like ``../../etc/x`` would let add_edit write ANY file the
        process can reach (arbitrary file write). Rejects absolute paths & traversal."""
        if not rel or os.path.isabs(rel):
            raise ValueError(f"chemin invalide: {rel!r}")
        root = os.path.realpath(self.repo)
        full = os.path.realpath(os.path.join(root, rel))
        if full != root and not full.startswith(root + os.sep):
            raise ValueError(f"chemin hors du dépôt: {rel!r}")
        return full

    # --- metadata (JSON, like the base store but under meta/) ---
    def _meta(self, cid: str) -> str:  # override: metadata lives under meta/
        return os.path.join(self.meta_dir, f"{cid}.json")

    def _save(self, cs: ChangeSet) -> None:
        with open(self._meta(cs.id), "w") as fh:
            json.dump({k: getattr(cs, k) for k in cs.__dataclass_fields__}, fh, indent=2)

    def exists(self, cid: str) -> bool:
        return os.path.exists(self._meta(cid))

    def get(self, cid: str) -> ChangeSet:
        with open(self._meta(cid)) as fh:
            return ChangeSet(**json.load(fh))

    def list(self) -> list[ChangeSet]:
        ids = [f[:-5] for f in sorted(os.listdir(self.meta_dir)) if f.endswith(".json")]
        return [self.get(cid) for cid in ids if self.exists(cid)]

    # --- create: a real branch ---
    def create(self, title: str, author: str, base: str = "main", now: str | None = None) -> ChangeSet:
        cid = self._unique_id(title)
        cs = ChangeSet(id=cid, title=title, author=author, base=base, created_at=now or _now())
        with self._lock:
            base_ref = self._branch(base) if base != "main" else "main"
            self._git("branch", "-f", self._branch(cid), base_ref)
        self._save(cs)
        return cs

    # --- content via git ---
    def read_effective(self, cid: str, rel: str) -> str:
        try:
            return self._git("show", f"{self._branch(cid)}:{rel}")
        except RuntimeError:
            return self.read_original(rel)

    def read_original(self, rel: str) -> str:
        with open(self.original_path(rel), errors="replace") as fh:
            return fh.read()

    def add_edit(self, cid: str, rel: str, new_content: str, note: str = "") -> ChangeSet:
        cs = self.get(cid)
        with self._lock:
            branch = self._branch(cid)
            self._git("checkout", "-q", branch)
            try:
                dp = self._safe_repo_path(rel)  # confine: reject path traversal
                os.makedirs(os.path.dirname(dp), exist_ok=True)
                with open(dp, "w") as fh:
                    fh.write(new_content)
                self._git("add", "--", rel)
                # Only commit if something actually changed — saving identical content
                # is a legitimate no-op, not a 500 ("nothing to commit" exits non-zero).
                if self._git("status", "--porcelain").strip():
                    self._git("commit", "-q", "-m", note or f"edit {rel}", "--author", f"{cs.author} <{cs.author}@cobol>")
            finally:
                self._git("checkout", "-q", "main")
        # The file is part of the version iff it now differs from main. Editing a
        # file back to main's exact content must DROP it from the list (no phantom
        # entry with an empty diff) — mirror revert_edit's removal. A file absent
        # from main (brand-new in this version) always counts as differing.
        try:
            original = self.read_original(rel)
        except (FileNotFoundError, ValueError):
            original = None
        differs = original is None or self.read_effective(cid, rel) != original
        present = any(e["path"] == rel for e in cs.edits)
        if differs and not present:
            cs.edits.append({"path": rel, "note": note})
        elif not differs and present:
            cs.edits = [e for e in cs.edits if e["path"] != rel]
        self._save(cs)
        return cs

    def diff(self, cid: str, rel: str) -> str:
        return self._git("diff", "main", self._branch(cid), "--", rel).rstrip("\n")

    # --- team workflow: personal branch vs main -------------------------
    def revert_edit(self, cid: str, rel: str) -> ChangeSet:
        """Drop a file from the version: restore it from main and commit the revert
        on the personal branch. Recovers e.g. an accidentally emptied file."""
        cs = self.get(cid)
        self._safe_repo_path(rel)  # confine (defense in depth)
        with self._lock:
            branch = self._branch(cid)
            self._git("checkout", "-q", branch)
            try:
                on_main = subprocess.run(
                    ["git", "-C", self.repo, "cat-file", "-e", f"main:{rel}"], capture_output=True
                ).returncode == 0
                if on_main:
                    self._git("checkout", "main", "--", rel)  # restore main's version
                else:
                    self._git("rm", "-q", "-f", "--", rel, check=False)  # file is new here → drop it
                if self._git("status", "--porcelain").strip():
                    self._git("add", "-A", "--", rel)
                    self._git("commit", "-q", "-m", f"revert {rel} (retour à main)")
            finally:
                self._git("checkout", "-q", "main")
        cs.edits = [e for e in cs.edits if e["path"] != rel]
        self._save(cs)
        return cs

    def sync_state(self, cid: str) -> dict:
        branch = self._branch(cid)
        behind = int((self._git("rev-list", "--count", f"{branch}..main").strip() or "0"))
        ahead = int((self._git("rev-list", "--count", f"main..{branch}").strip() or "0"))
        return {"behind": behind, "ahead": ahead, "up_to_date": behind == 0}

    def sync_main(self, cid: str, strategy: str | None = None) -> dict:
        """Import the team's changes (main) into the personal branch — git merge.

        On conflict (both sides touched the same lines), no silent guess is made:
        the caller gets the conflicted file list and must choose a ``strategy`` —
        ``mine`` (keep this version's changes, git -X ours) or ``main`` (take the
        team's version, git -X theirs).
        """
        opts = {"mine": ["-X", "ours"], "main": ["-X", "theirs"]}.get(strategy or "", [])
        with self._lock:
            branch = self._branch(cid)
            self._git("checkout", "-q", branch)
            try:
                r = subprocess.run(["git", "-C", self.repo, "merge", "--no-edit", *opts, "main"], capture_output=True, text=True)
                if r.returncode != 0:
                    conflicted = self._git("diff", "--name-only", "--diff-filter=U", check=False).split()
                    subprocess.run(["git", "-C", self.repo, "merge", "--abort"], capture_output=True)
                    files = ", ".join(conflicted) or "unknown files"
                    raise MergeConflict(
                        f"you and the team changed the same lines ({files}) — "
                        "choose “keep my changes” or “take the main version”",
                        conflicted,
                    )
            finally:
                self._git("checkout", "-q", "main")
        return self.sync_state(cid)

    def merge_to_main(self, cid: str) -> ChangeSet:
        """Apply the personal branch onto main — ONLY when up to date with main,
        so nobody overwrites teammates' work. The up-to-date check runs INSIDE the
        lock: otherwise two near-simultaneous merges both pass the check before
        either advances main, and the second silently merges a now-stale branch."""
        with self._lock:
            behind = int((self._git("rev-list", "--count", f"{self._branch(cid)}..main").strip() or "0"))
            if behind:
                raise ValueError(f"version en retard de {behind} commit(s) sur main — importez main d'abord")
            self._git("checkout", "-q", "main")
            r = subprocess.run(["git", "-C", self.repo, "merge", "--no-ff", "--no-edit", self._branch(cid)], capture_output=True, text=True)
            if r.returncode != 0:
                subprocess.run(["git", "-C", self.repo, "merge", "--abort"], capture_output=True)
                raise ValueError("échec de la fusion dans main")
        return self.set_status(cid, "merged")

    def export_main(self, dest: str) -> None:
        """Write main's tracked files into ``dest`` (the served corpus), so a merge
        becomes visible to read-only browsing, /api/source, search and impact —
        not just inside the version diff. Overwrites files; never deletes."""
        with self._lock:
            archive = subprocess.run(["git", "-C", self.repo, "archive", "main"], capture_output=True)
            if archive.returncode != 0:
                raise RuntimeError(f"git archive main: {archive.stderr.decode(errors='replace').strip()}")
            os.makedirs(dest, exist_ok=True)
            tar = subprocess.run(["tar", "-x", "-C", dest], input=archive.stdout, capture_output=True)
            if tar.returncode != 0:
                raise RuntimeError(f"extract to corpus: {tar.stderr.decode(errors='replace').strip()}")

    # --- legacy migration -------------------------------------------------
    def _migrate_legacy(self) -> None:
        """Import pre-git change-sets (versions/<id>/changeset.json + files/) as
        real branches, so existing demo versions survive the switch to git."""
        if not os.path.isdir(self.root):
            return
        for cid in sorted(os.listdir(self.root)):
            legacy = os.path.join(self.root, cid, "changeset.json")
            if not os.path.isfile(legacy) or self.exists(cid):
                continue
            with open(legacy) as fh:
                cs = ChangeSet(**json.load(fh))
            with self._lock:
                self._git("branch", "-f", self._branch(cid), "main")
                files_dir = os.path.join(self.root, cid, "files")
                if os.path.isdir(files_dir) and cs.edits:
                    self._git("checkout", "-q", self._branch(cid))
                    try:
                        for e in cs.edits:
                            src = os.path.join(files_dir, e["path"].replace("/", "__"))
                            if os.path.exists(src):
                                dp = os.path.join(self.repo, e["path"])
                                os.makedirs(os.path.dirname(dp), exist_ok=True)
                                shutil.copy2(src, dp)
                        if self._git("status", "--porcelain").strip():
                            self._git("add", "-A")
                            self._git("commit", "-q", "-m", f"migration: {cs.title}")
                    finally:
                        self._git("checkout", "-q", "main")
            self._save(cs)
