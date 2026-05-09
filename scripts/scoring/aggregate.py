#!/usr/bin/env python3
"""
Cross-run aggregator for CAD-Bench v0.5.

`score.py` produces one metrics dict per (agent, task, seed). Some metrics
are only meaningful across many runs:

    - paraphrase_iou_var  : variance of vol_iou across paraphrase variants
                            of the same task, by agent.
    - seed_variance       : variance of vol_iou across seeds of the same
                            (agent, task), averaged over tasks.
    - confidence_calibration:
                            Brier score between selfReportedConfidence and
                            actual pass_at_1, by agent (lower = better,
                            scaled into [0,1] where 1 is perfect).
    - edit_latency_ratio  : mean(latency_edit) / mean(latency_baseline)
                            for paired (PARAM-* edit, baseline) tasks,
                            by agent.

Reads a JSONL run sheet (the same file `run-evals.ts` writes) and emits
one summary JSON per agent, keyed by metric. Designed to be invoked from
the runner at end-of-sweep:

    python3 scripts/scoring/aggregate.py --in runs/2026-04-12.jsonl \
                                         --out runs/2026-04-12.summary.json
"""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path
from statistics import mean, pstdev
from typing import Any


def _is_num(x: Any) -> bool:
    return isinstance(x, (int, float)) and not isinstance(x, bool)


def load_runs(path: Path) -> list[dict]:
    out: list[dict] = []
    with path.open() as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            out.append(json.loads(line))
    return out


def paraphrase_iou_var(runs: list[dict]) -> dict[str, float]:
    """Tasks whose id starts with "PARA-" carry paraphrase variants in
    their seed slots — variance across seeds for the same task is the
    paraphrase-induced variance. Returns {agentId: variance}."""
    by_agent: dict[str, list[float]] = defaultdict(list)
    bucket: dict[tuple[str, str], list[float]] = defaultdict(list)
    for r in runs:
        if not r.get("taskId", "").startswith("PARA-"):
            continue
        v = r.get("metrics", {}).get("vol_iou")
        if _is_num(v):
            bucket[(r["agentId"], r["taskId"])].append(float(v))
    for (agent, _task), vs in bucket.items():
        if len(vs) >= 2:
            by_agent[agent].append(pstdev(vs) ** 2)
    return {a: round(mean(vs), 4) for a, vs in by_agent.items() if vs}


def seed_variance(runs: list[dict]) -> dict[str, float]:
    """Average variance of vol_iou across seeds, per agent. Excludes
    PARA-* tasks (those are paraphrase variance, scored above)."""
    by_agent: dict[str, list[float]] = defaultdict(list)
    bucket: dict[tuple[str, str], list[float]] = defaultdict(list)
    for r in runs:
        if r.get("taskId", "").startswith("PARA-"):
            continue
        v = r.get("metrics", {}).get("vol_iou")
        if _is_num(v):
            bucket[(r["agentId"], r["taskId"])].append(float(v))
    for (agent, _task), vs in bucket.items():
        if len(vs) >= 2:
            by_agent[agent].append(pstdev(vs) ** 2)
    return {a: round(mean(vs), 4) for a, vs in by_agent.items() if vs}


def confidence_calibration(runs: list[dict]) -> dict[str, float]:
    """Brier score between self-reported confidence and observed pass_at_1.
    Scaled into [0,1] where 1 == perfect. Brier = mean((c - p)²);
    score = 1 - 4·Brier (because c, p ∈ [0,1] so Brier ≤ 0.25)."""
    by_agent: dict[str, list[float]] = defaultdict(list)
    for r in runs:
        c = r.get("selfReportedConfidence")
        p = r.get("metrics", {}).get("pass_at_1")
        if _is_num(c) and _is_num(p):
            by_agent[r["agentId"]].append((float(c) - float(p)) ** 2)
    return {a: round(max(0.0, 1.0 - 4 * mean(es)), 3) for a, es in by_agent.items() if es}


def edit_latency_ratio(runs: list[dict]) -> dict[str, float]:
    """For agents that complete both a baseline task and its parametric-edit
    counterpart (e.g. MECH-014 → PARAM-013), report
    mean(latency_edit) / mean(latency_baseline). >1 means edits cost
    more than from-scratch — a red flag for "parametric" pipelines."""
    pairs = {"PARAM-013": "MECH-014"}
    by_agent: dict[str, list[float]] = defaultdict(list)
    by_pair: dict[tuple[str, str], dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
    for r in runs:
        for edit, base in pairs.items():
            if r.get("taskId") == edit:
                by_pair[(r["agentId"], edit)]["edit"].append(r["latencyMs"])
            elif r.get("taskId") == base:
                by_pair[(r["agentId"], edit)]["base"].append(r["latencyMs"])
    for (agent, _edit), buckets in by_pair.items():
        if buckets.get("edit") and buckets.get("base"):
            ratio = mean(buckets["edit"]) / max(1, mean(buckets["base"]))
            by_agent[agent].append(ratio)
    return {a: round(mean(vs), 3) for a, vs in by_agent.items() if vs}


def latency_percentiles(runs: list[dict]) -> dict[str, dict[str, float]]:
    by_agent: dict[str, list[float]] = defaultdict(list)
    for r in runs:
        if _is_num(r.get("latencyMs")):
            by_agent[r["agentId"]].append(float(r["latencyMs"]))
    out: dict[str, dict[str, float]] = {}
    for a, vs in by_agent.items():
        vs_sorted = sorted(vs)
        if not vs_sorted:
            continue
        p50 = vs_sorted[len(vs_sorted) // 2]
        p95 = vs_sorted[max(0, int(0.95 * len(vs_sorted)) - 1)]
        out[a] = {"latency_p50": round(p50, 1), "latency_p95": round(p95, 1)}
    return out


def cost_per_task(runs: list[dict]) -> dict[str, float]:
    by_agent: dict[str, list[float]] = defaultdict(list)
    for r in runs:
        if _is_num(r.get("costUsd")):
            by_agent[r["agentId"]].append(float(r["costUsd"]))
    return {a: round(mean(vs), 4) for a, vs in by_agent.items() if vs}


def aggregate(path: Path) -> dict:
    runs = load_runs(path)
    return {
        "n_runs": len(runs),
        "paraphrase_iou_var": paraphrase_iou_var(runs),
        "seed_variance": seed_variance(runs),
        "confidence_calibration": confidence_calibration(runs),
        "edit_latency_ratio": edit_latency_ratio(runs),
        "latency": latency_percentiles(runs),
        "cost_per_task": cost_per_task(runs),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    summary = aggregate(Path(args.inp))
    Path(args.out).write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
