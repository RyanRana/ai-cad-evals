"""Shared LLM->CadQuery runner.

Given a prompt, ask an LLM to emit a self-contained CadQuery script that
defines a variable `result` (a cq.Workplane) and exports it as STEP. We
execute the script in a restricted subprocess and capture the STEP file.

Sandboxing here is best-effort (subprocess + tmp cwd + timeout). For real
production sweeps run inside Vercel Sandbox or a Firecracker microVM.
"""
from __future__ import annotations
import re
import subprocess
import sys
import tempfile
import textwrap
import time
from pathlib import Path
from typing import Tuple

CADQUERY_PROMPT = """\
You are a CAD engineer. Write a single self-contained CadQuery 2 script that
satisfies the user's prompt. Hard requirements:

  1. Import cadquery as cq.
  2. Build the part as `result = ...` ending in a single `cq.Workplane` solid.
  3. Use millimetres throughout. Honour the requested origin/orientation.
  4. As the LAST line of the script, write:
        cq.exporters.export(result, "out.step")
  5. Output ONLY the python script, no prose, no fences, no markdown.

User prompt:
\"\"\"{prompt}\"\"\"
"""


def extract_python(text: str) -> str:
    """Strip code fences and extract the python block."""
    fence = re.search(r"```(?:python)?\s*\n(.*?)\n```", text, re.S)
    if fence:
        return fence.group(1)
    return text.strip()


def execute_cadquery_script(script: str, out_dir: Path, timeout_s: int = 90) -> Tuple[Path | None, str]:
    """Run the script in a subprocess, return (step_path or None, stderr)."""
    with tempfile.TemporaryDirectory() as td:
        tdp = Path(td)
        (tdp / "user.py").write_text(script)
        try:
            proc = subprocess.run(
                [sys.executable, "user.py"],
                cwd=tdp,
                capture_output=True,
                text=True,
                timeout=timeout_s,
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
