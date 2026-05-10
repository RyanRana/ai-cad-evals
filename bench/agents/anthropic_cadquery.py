"""Claude as CadQuery emitter."""
from __future__ import annotations
import time
from pathlib import Path

from .base import AgentResult
from ._cadquery_runner import CADQUERY_PROMPT, extract_python, execute_cadquery_script


class AnthropicCadQuery:
    id = "claude-opus-4-7-cadquery"
    name = "Claude Opus 4.7 + build123d"
    runtime = "LLM+CadQuery"
    model = "claude-sonnet-4-5"  # cheap default; override via $BENCH_ANTHROPIC_MODEL or subclass
    # Cost per 1k tokens (approx, USD); update as Anthropic publishes.
    in_per_1k = 0.003
    out_per_1k = 0.015

    def run(self, task_id: str, prompt: str, seed: int, out_dir: Path) -> AgentResult:
        import os
        from ..config import ANTHROPIC_API_KEY
        from anthropic import Anthropic
        client = Anthropic(api_key=ANTHROPIC_API_KEY)
        body = CADQUERY_PROMPT.format(prompt=prompt)
        model = os.environ.get("BENCH_ANTHROPIC_MODEL", self.model)
        t0 = time.time()
        try:
            resp = client.messages.create(
                model=model,
                max_tokens=2048,
                temperature=0.0,
                messages=[{"role": "user", "content": body}],
            )
        except Exception as e:
            return AgentResult(self.id, task_id, seed, None, int((time.time()-t0)*1000), 0.0, error=str(e)[:300])
        latency = int((time.time()-t0)*1000)
        usage = getattr(resp, "usage", None)
        cost = 0.0
        if usage:
            cost = (usage.input_tokens/1000)*self.in_per_1k + (usage.output_tokens/1000)*self.out_per_1k
        text = "".join(b.text for b in resp.content if getattr(b, "type", None) == "text")
        script = extract_python(text)
        step, err = execute_cadquery_script(script, out_dir)
        return AgentResult(self.id, task_id, seed, step, latency, cost, raw_output=text, error=err or None)
