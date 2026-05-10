"""Roll metric_values up into the `aggregates` table the site reads from.

Run after `bench.run`. Computes per-(agent, category) and overall:
  - n               : runs included
  - mean_score      : 100 * weighted mean of normalised metrics
  - p5              : 5th percentile of run scores
  - ci_low/ci_high  : bootstrap 95 % CI on the mean
  - metric_means    : { metric_id -> mean_over_runs }
"""
from __future__ import annotations
import json
import random
import statistics
from collections import defaultdict

from .db import conn

# Map metric_id -> normaliser (raw value -> 0..1, higher = better).
NORMALISE = {
    "vol_iou":           lambda v: float(v),
    "normal_consistency":lambda v: float(v),
    "step_roundtrip":    lambda v: float(v),
    "watertight":        lambda v: 1.0 if v else 0.0,
    "manifold":          lambda v: 1.0 if v else 0.0,
    "euler_compliance":  lambda v: 1.0 if v else 0.0,
    "pass_at_1":         lambda v: float(v),
    # distance metrics: convert to 0..1 with soft cutoff at 5 mm
    "chamfer":           lambda v: max(0.0, 1.0 - float(v) / 5.0) if v is not None else 0.0,
    "hausdorff":         lambda v: max(0.0, 1.0 - float(v) / 10.0) if v is not None else 0.0,
}
WEIGHTS = {
    "vol_iou": 0.30, "chamfer": 0.10, "hausdorff": 0.05,
    "normal_consistency": 0.10, "watertight": 0.10, "manifold": 0.10,
    "euler_compliance": 0.05, "step_roundtrip": 0.10, "pass_at_1": 0.10,
}


def _bootstrap_ci(xs: list[float], n: int = 2000, alpha: float = 0.05) -> tuple[float, float]:
    if not xs: return (0.0, 0.0)
    rng = random.Random(42)
    means = []
    for _ in range(n):
        means.append(statistics.fmean(rng.choices(xs, k=len(xs))))
    means.sort()
    lo = means[int(n * alpha / 2)]; hi = means[int(n * (1 - alpha / 2))]
    return (lo, hi)


def main():
    with conn() as c:
        cur = c.execute(
            """
            SELECT r.agent_id, r.task_id, r.id, m.metric_id, m.value_num, m.value_bool
            FROM runs r LEFT JOIN metric_values m ON m.run_id = r.id
            """
        )
        rows = cur.fetchall()
    by_run: dict[tuple[str, str, int], dict] = defaultdict(dict)
    for agent_id, task_id, rid, mid, vn, vb in rows:
        if mid is None: continue
        v = vb if vb is not None else vn
        by_run[(agent_id, task_id, rid)][mid] = v

    # collapse seeds per (agent, task), then aggregate per agent
    per_at: dict[tuple[str, str], dict[str, float]] = defaultdict(dict)
    for (a, t, _rid), mdict in by_run.items():
        for mid, v in mdict.items():
            per_at[(a, t)].setdefault(mid, []).append(v)
    per_at_mean: dict[tuple[str, str], dict[str, float]] = {}
    for k, mdict in per_at.items():
        per_at_mean[k] = {mid: statistics.fmean([NORMALISE[mid](x) for x in xs]) if mid in NORMALISE else 0.0
                          for mid, xs in mdict.items()}

    per_agent: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
    per_agent_score: dict[str, list[float]] = defaultdict(list)
    for (a, _t), mdict in per_at_mean.items():
        score = 0.0; w_total = 0.0
        for mid, w in WEIGHTS.items():
            if mid in mdict:
                score += w * mdict[mid]; w_total += w
            per_agent[a][mid].append(mdict.get(mid, 0.0))
        per_agent_score[a].append(100 * score / w_total if w_total else 0.0)

    with conn() as c:
        c.execute("DELETE FROM aggregates;")
        for agent, scores in per_agent_score.items():
            mean = statistics.fmean(scores) if scores else 0.0
            p5 = statistics.quantiles(scores, n=20)[0] if len(scores) >= 20 else min(scores) if scores else 0.0
            lo, hi = _bootstrap_ci(scores)
            metric_means = {m: statistics.fmean(v) for m, v in per_agent[agent].items()}
            c.execute(
                """INSERT INTO aggregates (agent_id, category, n, mean_score, p5, ci_low, ci_high, irt_ability, metric_means)
                   VALUES (%s, 'overall', %s, %s, %s, %s, %s, 0, %s)""",
                (agent, len(scores), mean, p5, lo, hi, json.dumps(metric_means)),
            )
        c.commit()
    print(f"aggregated {len(per_agent_score)} agents")


if __name__ == "__main__":
    main()
