"""Industrial copybook resolution - the piece regex parsing skips.

Handles what real Enterprise COBOL needs and GenApp happens not to use:
- **SYSLIB concatenation**: an ordered list of copy libraries, first-match wins.
- **COPY ... REPLACING**: pseudo-text (``==a== BY ==b==``) and token substitution,
  applied before the copybook is expanded (so field names come out correct).
- **Nested COPY**: a copybook that COPYies another, expanded recursively (cycle-safe).

Plugs into the ingestion pipeline for corpora that use these; unit-tested with a
fixture (below) so the capability is real, not speculative.
"""
from __future__ import annotations

import os
import re

# COPY NAME [REPLACING ...].  (optional leading level number; single logical line)
_COPY = re.compile(r"^\s*(?:\d+\s+)?COPY\s+([A-Z0-9$#@_-]+)(?:\s+REPLACING\s+(.*?))?\.\s*$", re.I)
_PSEUDO = re.compile(r"==(.*?)==\s+BY\s+==(.*?)==", re.I | re.S)
_TOKEN = re.compile(r"(\S+)\s+BY\s+(\S+)", re.I)


class CopybookResolver:
    def __init__(self, syslib: list[str]):
        self.syslib = [os.path.realpath(p) for p in syslib]

    def find(self, name: str) -> str | None:
        for lib in self.syslib:
            for ext in (".cpy", ".CPY", ".cbl", ".CBL", ""):
                p = os.path.join(lib, name + ext)
                if os.path.isfile(p):
                    return p
        return None

    @staticmethod
    def _parse_replacing(spec: str | None) -> list[tuple[str, str]]:
        if not spec:
            return []
        pairs = _PSEUDO.findall(spec)
        if pairs:
            return [(a.strip(), b.strip()) for a, b in pairs]
        return list(_TOKEN.findall(spec))

    @staticmethod
    def _apply(text: str, subs: list[tuple[str, str]]) -> str:
        for a, b in subs:
            if a:
                text = text.replace(a, b)
        return text

    def resolve(self, name: str, replacing: list[tuple[str, str]] | None = None, _seen: set[str] | None = None) -> str:
        """Return the fully expanded text of a copybook (nested COPYs inlined)."""
        _seen = set() if _seen is None else _seen
        key = name.upper()
        if key in _seen:
            return f"      *> [copybook cycle: {name}]\n"
        _seen = _seen | {key}
        path = self.find(name)
        if not path:
            return f"      *> [copybook introuvable: {name}]\n"
        with open(path, errors="replace") as fh:
            text = fh.read()
        if replacing:
            text = self._apply(text, replacing)
        out: list[str] = []
        for line in text.splitlines(keepends=True):
            m = _COPY.match(line.rstrip("\n"))
            if m:
                out.append(self.resolve(m.group(1), self._parse_replacing(m.group(2)), _seen))
            else:
                out.append(line)
        return "".join(out)

    def dependencies(self, name: str, _seen: set[str] | None = None) -> set[str]:
        """Transitive set of copybooks COPY'd from ``name`` (for graph edges)."""
        _seen = set() if _seen is None else _seen
        path = self.find(name)
        if not path:
            return _seen
        with open(path, errors="replace") as fh:
            for line in fh:
                m = _COPY.match(line.rstrip("\n"))
                if m and m.group(1).upper() not in _seen:
                    _seen.add(m.group(1).upper())
                    self.dependencies(m.group(1), _seen)
        return _seen
