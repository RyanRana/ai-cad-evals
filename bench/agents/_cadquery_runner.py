"""Shared LLM->build123d runner.

We ask the model for a self-contained build123d script that defines a
variable `result` and exports it as STEP. Subprocess + tmp cwd + timeout.
For real production sweeps, swap the subprocess for Vercel Sandbox.
"""
from __future__ import annotations
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Tuple

CADQUERY_PROMPT = """\
You are a CAD engineer. Write a single self-contained Python script using the
build123d 0.7 API that satisfies the user's prompt.

Hard requirements:

  1. `from build123d import *` is allowed; import nothing else CAD-related.
  2. Build the part as `result`, a build123d Part / Compound / Solid.
  3. Use millimetres throughout. Honour the requested origin and orientation.
  4. As the LAST line of the script, write:
        from build123d import export_step
        export_step(result, "out.step")
  5. Output ONLY the python script, no prose, no fences, no markdown.

User prompt:
\"\"\"{prompt}\"\"\"
"""


def extract_python(text: str) -> str:
    """Strip code fences if present."""
    fence = re.search(r"```(?:python)?\s*\n(.*?)\n```", text, re.S)
    if fence:
        return fence.group(1)
    return text.strip()


def execute_cadquery_script(script: str, out_dir: Path, timeout_s: int = 90) -> Tuple[Path | None, str]:
    """Run the script in a subprocess; return (step_path or None, stderr/log)."""
    with tempfile.TemporaryDirectory() as td:
        tdp = Path(td)
        (tdp / "user.py").write_text(script)
        try:
            proc = subprocess.run(
                [sys.executable, "user.py"],
                cwd=tdp, capture_output=True, text=True, timeout=timeout_s,
            )
        except subprocess.TimeoutExpired:
            return None, "timeout"
        if proc.returncode != 0:
            return None, (proc.stderr or "nonzero exit")[:2000]
        step = tdp / "out.step"
        if not step.exists():
            return None, "no out.step produced"
        target = out_dir / f"{int(time.time()*1000)}.step"
        target.write_bytes(step.read_bytes())
        return target, ""
