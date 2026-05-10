"""GPT as CadQuery emitter."""
from __future__ import annotations
import time
from pathlib import Path

from .base import AgentResult
from ._cadquery_runner import CADQUERY_PROMPT, extract_python, execute_cadquery_script


class OpenAICadQuery:
    id = "gpt-5-cadquery"
    name = "GPT-5 + CadQuery"
    runtime = "LLM+CadQuery"
    model = "gpt-5"  # override via env if not yet GA
    in_per_1k = 0.005
    out_per_1k = 0.015

    def run(self, task_id: str, prompt: str, seed: int, out_dir: Path) -> AgentResult:
        from ..config import OPENAI_API_KEY
        from openai import OpenAI
        client = OpenAI(api_key=OPENAI_API_KEY)
        body = CADQUERY_PROMPT.format(prompt=prompt)
        t0 = time.time()
        try:
            resp = client.chat.completions.create(
                model=self.model,
                temperature=0.0,
                messages=[{"role": "user", "content": body}],
            )
        except Exception as e:
            return AgentResult(self.id, task_id, seed, None, int((time.time()-t0)*1000), 0.0, error=str(e)[:300])
        latency = int((time.time()-t0)*1000)
        usage = getattr(resp, "usage", None)
        cost = 0.0
        if usage:
            cost = (usage.prompt_tokens/1000)*self.in_per_1k + (usage.completion_tokens/1000)*self.out_per_1k
        text = resp.choices[0].message.content or ""
        script = extract_python(text)
        step, err = execute_cadquery_script(script, out_dir)
        return AgentResult(self.id, task_id, seed, step, latency, cost, raw_output=text, error=err or None)
