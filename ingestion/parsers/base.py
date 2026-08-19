"""Parser abstraction: every source parser returns a ``ParsedUnit``.

Keeping one interface lets the ingestion pipeline mix a robust COBOL parser
(cobol-rekt) with a dedicated JCL parser and degrade gracefully if one
source fails on a given file.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from core.schema import Edge, Node


@dataclass
class ParsedUnit:
    nodes: list[Node] = field(default_factory=list)
    edges: list[Edge] = field(default_factory=list)
    # COBOL only: logical file name -> ddname, from SELECT ... ASSIGN TO.
    selects: dict[str, str] | None = None
    program: str | None = None


class Parser(ABC):
    @abstractmethod
    def parse(self, path: str) -> ParsedUnit:  # pragma: no cover - interface
        ...
