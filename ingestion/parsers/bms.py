"""BMS parser: maps (DFHMDI) grouped under their mapset (DFHMSD) -> BMS_MAP nodes.

The area-A label before ``DFHMSD`` is the mapset; before ``DFHMDI`` it is a map.
COBOL programs reference maps by name via ``EXEC CICS SEND/RECEIVE MAP``.
"""
from __future__ import annotations

import os
import re

from core.schema import Node, NodeKind, nid
from parsers.base import Parser, ParsedUnit

_MSD = re.compile(r"^([A-Z0-9#@$]+)\s+DFHMSD", re.I)
_MDI = re.compile(r"^([A-Z0-9#@$]+)\s+DFHMDI", re.I)


class BmsParser(Parser):
    def parse(self, path: str) -> ParsedUnit:
        pu = ParsedUnit()
        mapset = os.path.basename(path).split(".")[0].upper()
        with open(path, errors="replace") as fh:
            for line in fh:
                m = _MSD.match(line)
                if m:
                    mapset = m.group(1).upper()
                    continue
                m = _MDI.match(line)
                if m:
                    name = m.group(1).upper()
                    pu.nodes.append(Node(nid("map", name), NodeKind.BMS_MAP, name, {"mapset": mapset}))
        return pu
