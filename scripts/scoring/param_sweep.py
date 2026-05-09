#!/usr/bin/env python3
"""
Parametric robustness sweep for code-generating agents (OpenSCAD, CadQuery).

For tasks declaring `paramRange` (continuous sweep) or `edits` (named
discrete edits), this script re-renders the candidate's source script
with each parameter value substituted, re-scores, and reports two
metrics that catch the difference between "looks parametric" and
"actually parametric":

    param_range_integrity (0..1) : share of paramRange samples that
                                   produced a watertight, manifold solid.
    param_edit_acc        (0..1) : share of `edits` whose volume delta
                                   matched the declared `expectedDeltaVolMm3`
                                   within ±10 %.

A naive but useful approximation: we use a regex to find the parameter
assignment in the script (`<name> = <number>;` or `<name> =<number>` for
Python). Tasks whose generated script doesn't have a top-level assignment
for the named parameter are reported with `param_range_integrity = null`
rather than flagged as a false zero.

Inputs:
    --script <path>      original source emitted by the adapter
    --task-json <path>   serialized Task object
    --out <path>         JSON file to write metric results into
    --tmp-dir <path>     scratch dir for re-renders
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import shutil
import subprocess
from pathlib import Path
from typing import Any

import numpy as np
import trimesh

# Re-uses the L1 + L2 helpers from score.py without making them peers.
from score import load_candidate, watertight, manifoldness  # type: ignore


SCAD_BIN = os.environ.get("OPENSCAD_BIN", "openscad")


def _render_openscad(src: Path, out_stl: Path) -> bool:
    try:
        r = subprocess.run(
            [SCAD_BIN, "-o", str(out_stl), str(src)],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            timeout=120,
        )
        return r.returncode == 0 and out_stl.exists()
    except Exception:
        return False


def _render_cadquery(src: Path, out_step: Path) -> bool:
    """Execute the CadQuery script in a subprocess. The script is expected
    to define a top-level `result` variable; we wrap it with a small
    epilogue that exports to STEP."""
    epilogue = f"""
import cadquery as cq
try:
    from __main__ import result as _r
except Exception:
    _r = None
if _r is None:
    for _name, _val in list(globals().items()):
        if isinstance(_val, cq.Workplane):
            _r = _val
            break
if _r is None:
    raise SystemExit("no Workplane named 'result' found")
cq.exporters.export(_r, {str(out_step)!r})
"""
    runner = src.with_suffix(".runner.py")
    runner.write_text(src.read_text() + "\n" + epilogue)
    try:
        r = subprocess.run(
            ["python3", str(runner)],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            timeout=180,
        )
        return r.returncode == 0 and out_step.exists()
    except Exception:
        return False
    finally:
        runner.unlink(missing_ok=True)


def _substitute_param(src: str, name: str, value: float) -> str | None:
    """Find a top-level assignment `name = <number>` in the script and
    replace its RHS. Returns None if no clean assignment was found —
    we'd rather report `null` than silently render the unchanged file."""
    pat = re.compile(
        rf"^(\s*{re.escape(name)}\s*=\s*)([-+]?\d+(?:\.\d+)?)\s*;?\s*$",
        re.MULTILINE,
    )
    if not pat.search(src):
        return None
    return pat.sub(lambda m: f"{m.group(1)}{value}", src, count=1)


def _solid_volume(path: Path) -> float | None:
    try:
        m = load_candidate(str(path))
        if not m.is_watertight:
            return None
        return float(m.volume)
    except Exception:
        return None


def _render(src_path: Path, out_path: Path, language: str) -> bool:
    if language == "openscad":
        return _render_openscad(src_path, out_path)
    if language == "cadquery":
        return _render_cadquery(src_path, out_path)
    return False


def _detect_language(src: str, suffix: str) -> str | None:
    if suffix == ".scad" or "module " in src or "$fn" in src:
        return "openscad"
    if suffix == ".py" or "import cadquery" in src:
        return "cadquery"
    return None


def sweep(script_path: Path, task: dict, tmp_dir: Path) -> dict[str, Any]:
    spec = task.get("spec", {})
    src = script_path.read_text()
    language = _detect_language(src, script_path.suffix.lower())
    if language is None:
        return {"param_range_integrity": None, "param_edit_acc": None,
                "note": "unknown_script_language"}

    out_ext = ".stl" if language == "openscad" else ".step"
    tmp_dir.mkdir(parents=True, exist_ok=True)

    # ---- paramRange : sample integrity ----
    integrity_results: list[float] = []
    integrity_unsupported = False
    for pr in spec.get("paramRange") or []:
        name = pr["name"]; lo = float(pr["min"]); hi = float(pr["max"])
        n = max(2, int(pr.get("samples", 8)))
        ok = 0; tried = 0
        for v in np.linspace(lo, hi, n):
            patched = _substitute_param(src, name, float(v))
            if patched is None:
                integrity_unsupported = True
                break
            patched_path = tmp_dir / f"{name}_{v:.4f}{script_path.suffix}"
            patched_path.write_text(patched)
            out_path = tmp_dir / f"{name}_{v:.4f}{out_ext}"
            tried += 1
            if not _render(patched_path, out_path, language):
                continue
            try:
                m = load_candidate(str(out_path))
                if watertight(m) and manifoldness(m) >= 0.98:
                    ok += 1
            except Exception:
                continue
        if integrity_unsupported:
            break
        if tried:
            integrity_results.append(ok / tried)

    if integrity_unsupported:
        param_range_integrity = None
    elif integrity_results:
        param_range_integrity = round(float(np.mean(integrity_results)), 3)
    else:
        param_range_integrity = None

    # ---- edits : signed volume delta accuracy ----
    edit_hits = 0; edit_total = 0; edit_unsupported = False
    base_volume: float | None = None

    base_out = tmp_dir / f"baseline{out_ext}"
    if _render(script_path, base_out, language):
        base_volume = _solid_volume(base_out)

    for ed in spec.get("edits") or []:
        name = ed["param"]; new = float(ed["to"])
        expected = float(ed.get("expectedDeltaVolMm3", 0))
        patched = _substitute_param(src, name, new)
        if patched is None or base_volume is None:
            edit_unsupported = True
            break
        edit_total += 1
        patched_path = tmp_dir / f"edit_{name}_{new}{script_path.suffix}"
        patched_path.write_text(patched)
        out_path = tmp_dir / f"edit_{name}_{new}{out_ext}"
        if not _render(patched_path, out_path, language):
            continue
        v = _solid_volume(out_path)
        if v is None:
            continue
        delta = v - base_volume
        if abs(expected) < 1e-3:
            # Volume should be ~unchanged — accept ≤ 5 % drift.
            if abs(delta) <= 0.05 * base_volume:
                edit_hits += 1
        else:
            if abs(delta - expected) <= 0.10 * abs(expected):
                edit_hits += 1

    if edit_unsupported:
        param_edit_acc = None
    elif edit_total:
        param_edit_acc = round(edit_hits / edit_total, 3)
    else:
        param_edit_acc = None

    return {
        "param_range_integrity": param_range_integrity,
        "param_edit_acc": param_edit_acc,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--script", required=True)
    ap.add_argument("--task-json", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--tmp-dir", required=True)
    args = ap.parse_args()

    task = json.loads(Path(args.task_json).read_text())
    res = sweep(Path(args.script), task, Path(args.tmp_dir))
    Path(args.out).write_text(json.dumps(res))
    print(json.dumps(res))


if __name__ == "__main__":
    main()
