"""Tool-call trace: the grounding/auditability record shown next to answers.

Every tool the agent invokes appends a step (input, output summary, sources).
The UI renders this as a checklist so a user sees *how* the answer was reached.
"""
from __future__ import annotations

from collections.abc import Callable
from dataclasses import asdict, dataclass, field


@dataclass
class TraceStep:
    tool: str
    input: dict
    output_summary: str
    sources: list[str] = field(default_factory=list)


@dataclass
class Trace:
    steps: list[TraceStep] = field(default_factory=list)
    # Optional live sink: called with each step (as a dict) the moment it is
    # recorded, so the API can stream the tool-call trace in real time.
    on_record: Callable[[dict], None] | None = None

    def record(self, tool: str, inp: dict, output_summary: str, sources: list[str] | None = None) -> None:
        step = TraceStep(tool, inp, output_summary, sources or [])
        self.steps.append(step)
        if self.on_record is not None:
            try:
                self.on_record(asdict(step))
            except Exception:  # a broken sink must never break the agent
                pass

    def to_list(self) -> list[dict]:
        return [asdict(s) for s in self.steps]

    def render(self) -> str:
        out = []
        for i, s in enumerate(self.steps, 1):
            out.append(f"  {i}. {s.tool}({s.input}) -> {s.output_summary}")
            for src in s.sources:
                out.append(f"       ↳ {src}")
        return "\n".join(out)
