"""Agent adapters. Each adapter:
  - takes (task_id, prompt, seed)
  - returns AgentResult(step_path, latency_ms, cost_usd, error)

The runner doesn't care how the agent produces the STEP — only that it does.
"""
from __future__ import annotations
from .base import AgentResult, Adapter
from .anthropic_cadquery import AnthropicCadQuery
from .openai_cadquery import OpenAICadQuery
from .zoo import ZooTextToCAD

ADAPTERS: list[Adapter] = []

# Adapters self-register only if their key is present, so a partial-key
# environment yields a partial sweep instead of a crash.
def register_available() -> list[Adapter]:
    from ..config import ANTHROPIC_API_KEY, OPENAI_API_KEY, ZOO_API_KEY
    out: list[Adapter] = []
    if ANTHROPIC_API_KEY:
        out.append(AnthropicCadQuery())
    if OPENAI_API_KEY:
        out.append(OpenAICadQuery())
    if ZOO_API_KEY:
        out.append(ZooTextToCAD())
    return out
