"""Run the full sweep: every adapter × every task × every seed.

Usage:
    python -m bench.run                     # full sweep (with available keys)
    python -m bench.run --tasks PRIM-001    # subset
    python -m bench.run --agents zoo-text-to-cad-2.4
"""
from __future__ import annotations
import argparse
import datetime as dt
import json
import re
import subprocess
import sys
from pathlib import Path

from rich.console import Console
from rich.progress import Progress

from .config import CANDIDATES_DIR, REFERENCE_DIR, DEFAULT_SEEDS
from .reference import REFERENCES
from .agents import register_available
from .metrics import geometry, topology, step as stepm
from . import db, blob

con = Console()
TASKS_TS = Path(__file__).resolve().parents[1] / "lib" / "data" / "tasks.ts"


def load_prompts() -> dict[str, str]:
    """Parse `id` and `prompt` strings out of lib/data/tasks.ts.

    The TS file is the authoritative prompt source — keep them in one place.
    """
    src = TASKS_TS.read_text()
    out: dict[str, str] = {}
    for m in re.finditer(r'id:\s*"([A-Z]+-\d+)"[\s\S]*?prompt:\s*\n?\s*"([^"]+(?:\\"[^"]*)*)"', src):
        tid, prompt = m.group(1), m.group(2)
        out[tid] = prompt.encode().decode("unicode_escape")
    return out


def bench_version() -> str:
    try:
        out = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=Path(__file__).resolve().parents[1],
        )
        return out.decode().strip()
    except Exception:
        return "dev"


def score_run(ref_step: Path, cand_step: Path | None) -> dict:
    if cand_step is None or not cand_step.exists():
        return {"vol_iou": 0.0, "chamfer": None, "hausdorff": None,
                "normal_consistency": 0.0, "watertight": False, "manifold": False,
                "euler_compliance": False, "step_roundtrip": 0.0, "pass_at_1": 0.0}
    out = {}
    try: out["vol_iou"] = geometry.vol_iou(ref_step, cand_step)
    except Exception as e: out["vol_iou"] = 0.0; con.log(f"vol_iou err: {e}")
    try: out["chamfer"] = geometry.chamfer(ref_step, cand_step)
    except Exception: out["chamfer"] = None
    try: out["hausdorff"] = geometry.hausdorff_p95(ref_step, cand_step)
    except Exception: out["hausdorff"] = None
    try: out["normal_consistency"] = geometry.normal_consistency(ref_step, cand_step)
    except Exception: out["normal_consistency"] = 0.0
    try: out["watertight"] = topology.watertight(cand_step)
    except Exception: out["watertight"] = False
    try: out["manifold"] = topology.manifold(cand_step)
    except Exception: out["manifold"] = False
    try: out["euler_compliance"] = topology.euler_compliance(ref_step, cand_step)
    except Exception: out["euler_compliance"] = False
    try: out["step_roundtrip"] = stepm.step_roundtrip(cand_step)
    except Exception: out["step_roundtrip"] = 0.0
    out["pass_at_1"] = 1.0 if (out["vol_iou"] > 0.95 and out["watertight"] and out["manifold"]) else 0.0
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tasks", nargs="*", default=None)
    ap.add_argument("--agents", nargs="*", default=None)
    ap.add_argument("--seeds", type=int, default=DEFAULT_SEEDS)
    ap.add_argument("--no-db", action="store_true", help="skip Postgres writes")
    args = ap.parse_args()

    bv = bench_version()
    prompts = load_prompts()
    adapters = register_available()
    if args.agents:
        adapters = [a for a in adapters if a.id in set(args.agents)]
    if not adapters:
        con.print("[red]No adapters available — set ANTHROPIC_API_KEY / OPENAI_API_KEY / ZOO_API_KEY[/]")
        sys.exit(1)
    targets = args.tasks or list(REFERENCES.keys())
    targets = [t for t in targets if t in REFERENCES]

    con.print(f"[green]bench {bv}[/] · {len(adapters)} agents × {len(targets)} tasks × {args.seeds} seeds = {len(adapters)*len(targets)*args.seeds} runs")

    with Progress() as bar:
        task = bar.add_task("sweep", total=len(adapters) * len(targets) * args.seeds)
        for adapter in adapters:
            for tid in targets:
                ref_step = REFERENCE_DIR / f"{tid}.step"
                if not ref_step.exists():
                    con.print(f"[yellow]skip {tid}: reference STEP missing — run `python -m bench.seed {tid}` first[/]")
                    bar.update(task, advance=args.seeds); continue
                prompt = prompts.get(tid, "")
                if not prompt:
                    con.print(f"[yellow]skip {tid}: prompt missing in lib/data/tasks.ts[/]")
                    bar.update(task, advance=args.seeds); continue
                for seed in range(args.seeds):
                    out_dir = CANDIDATES_DIR / adapter.id / tid
                    out_dir.mkdir(parents=True, exist_ok=True)
                    started = dt.datetime.utcnow()
                    res = adapter.run(tid, prompt, seed, out_dir)
                    finished = dt.datetime.utcnow()
                    metrics = score_run(ref_step, res.step_path)
                    cand_url = None
                    if res.step_path and not args.no_db:
                        try:
                            cand_url = blob.upload(
                                res.step_path,
                                key=f"candidates/{bv}/{adapter.id}/{tid}/seed{seed}.step",
                                content_type="application/STEP",
                            )
                        except Exception as e:
                            con.log(f"blob upload failed: {e}")
                    if not args.no_db:
                        try:
                            rid = db.insert_run(
                                adapter.id, tid, seed,
                                bench_version=bv, started=started, finished=finished,
                                latency_ms=res.latency_ms, cost_usd=res.cost_usd,
                                candidate_blob=cand_url, raw_output=res.raw_output, error=res.error,
                            )
                            db.insert_metrics(rid, metrics)
                        except Exception as e:
                            con.log(f"db write failed: {e}")
                    status = "ok" if metrics["pass_at_1"] else "fail"
                    con.log(f"[{status}] {adapter.id} {tid} s{seed} vol_iou={metrics['vol_iou']:.3f} {res.error or ''}")
                    bar.update(task, advance=1)


if __name__ == "__main__":
    main()
