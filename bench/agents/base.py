"""Adapter contract."""
from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Protocol


@dataclass
class AgentResult:
    agent_id: str
    task_id: str
    seed: int
    step_path: Optional[Path]   # None on hard failure
    latency_ms: int
    cost_usd: float
    raw_output: Optional[str] = None  # the model response, for forensics
    error: Optional[str] = None


class Adapter(Protocol):
    id: str          # short, stable id (matches lib/data/agents.ts)
    name: str
    runtime: str     # "API" / "LLM+CadQuery" / etc

    def run(self, task_id: str, prompt: str, seed: int, out_dir: Path) -> AgentResult: ...
