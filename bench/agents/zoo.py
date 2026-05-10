"""Zoo Text-to-CAD adapter (https://zoo.dev/text-to-cad).

Submits a prompt, polls for completion, downloads STEP.

Endpoint reference (subject to change — confirm against current Zoo docs):
  POST   https://api.zoo.dev/ai/text-to-cad/{output_format}
  GET    https://api.zoo.dev/user/text-to-cad/{id}
Auth: Bearer ZOO_API_KEY
"""
from __future__ import annotations
import time
from pathlib import Path
import httpx

from .base import AgentResult


class ZooTextToCAD:
    id = "zoo-text-to-cad-2.4"
    name = "Zoo Text-to-CAD 2.4"
    runtime = "API"
    base = "https://api.zoo.dev"

    def run(self, task_id: str, prompt: str, seed: int, out_dir: Path) -> AgentResult:
        from ..config import ZOO_API_KEY
        headers = {"Authorization": f"Bearer {ZOO_API_KEY}"}
        t0 = time.time()
        try:
            with httpx.Client(timeout=60) as cli:
                r = cli.post(
                    f"{self.base}/ai/text-to-cad/step",
                    headers=headers,
                    json={"prompt": prompt, "kcl": False},
                )
                r.raise_for_status()
                job = r.json()
                job_id = job.get("id") or job.get("uuid")
                # poll
                deadline = time.time() + 240
                status = "queued"
                while time.time() < deadline and status not in ("completed", "failed"):
                    time.sleep(3)
                    p = cli.get(f"{self.base}/user/text-to-cad/{job_id}", headers=headers)
                    p.raise_for_status()
                    job = p.json()
                    status = job.get("status", "queued")
                if status != "completed":
                    return AgentResult(self.id, task_id, seed, None, int((time.time()-t0)*1000), 0.0, error=f"job {status}")
                # outputs is { "source.step": "<base64>" } or a signed URL
                outputs = job.get("outputs") or {}
                step_blob = outputs.get("source.step") or outputs.get("output.step")
                if step_blob and isinstance(step_blob, str) and step_blob.startswith("http"):
                    data = cli.get(step_blob).content
                elif step_blob:
                    import base64
                    data = base64.b64decode(step_blob)
                else:
                    return AgentResult(self.id, task_id, seed, None, int((time.time()-t0)*1000), 0.0, error="no step in outputs")
        except Exception as e:
            return AgentResult(self.id, task_id, seed, None, int((time.time()-t0)*1000), 0.0, error=str(e)[:300])
        target = out_dir / f"{int(time.time()*1000)}.step"
        target.write_bytes(data)
        latency = int((time.time()-t0)*1000)
        return AgentResult(self.id, task_id, seed, target, latency, 0.10)  # ~$0.10/gen retail
