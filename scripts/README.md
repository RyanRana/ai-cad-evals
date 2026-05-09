# CAD-Bench harness

A toolkit for running CAD-Bench v0.5 against any subset of the registered
agents and producing the JSONL run-sheet plus the cross-run summary that
power the site.

## Quick start

```bash
# 1. install scoring deps (Python 3.11 recommended)
pip install -r scripts/scoring/requirements.txt
# also: brew install opencascade openscad   (or apt equivalent)

# 2. set whatever provider keys you have
export ZOO_API_KEY=...            # Zoo Text-to-CAD
export ANTHROPIC_API_KEY=...      # Claude pipelines
export OPENAI_API_KEY=...         # GPT-5 pipelines
export GOOGLE_API_KEY=...         # Gemini pipeline
# adam / trellis / spline are optional

# 3. dry-run on a single task
npx tsx scripts/run-evals.ts \
  --agents zoo-text-to-cad-2.4,claude-opus-4-7-cadquery \
  --tasks PRIM-001 \
  --seeds 1 \
  --out runs/dry.jsonl

# 4. full pilot sweep
npx tsx scripts/run-evals.ts --seeds 5 --out runs/2026-04-12.jsonl
```

The runner writes:
- `runs/<sweep>.jsonl`         — one `RunResult` per (agent, task, seed/variant)
- `runs/<sweep>.summary.json`  — cross-run variance/calibration/latency

## Metric coverage

The scorer auto-activates each metric based on which fields the task spec
declares — a primitive task gets L1 only; a parametric-edit task gets L1
+ L4. Implementation lives in `scripts/scoring/`.

| Layer | Metric                    | Activation trigger                        | Module          |
|-------|---------------------------|--------------------------------------------|------------------|
| L1    | vol_iou, chamfer, hausdorff, normal_consistency | always             | score.py |
| L1    | watertight, manifold      | always                                     | score.py |
| L1    | euler_compliance          | spec.euler set                             | score.py |
| L1    | step_roundtrip            | candidate is STEP                          | score.py |
| L2    | named_dim_rmse            | spec.namedDimensions                       | score.py |
| L2    | feature_recall            | spec.features                              | score.py |
| L2    | gdt_compliance            | spec.gdtCallouts                           | score.py |
| L2    | mating_clearance          | spec.matingPart + expectedClearanceMm      | score.py |
| L2    | fits_class_compliance     | spec.fitClass                              | score.py |
| L2    | standards_compliance      | spec.standardRef + STEP candidate          | score.py |
| L3    | draft_compliance          | spec.draftMinDeg                           | score.py |
| L3    | min_wall_compliance       | spec.minWallMm                             | score.py |
| L3    | uniform_thickness         | spec.uniformThicknessMm                    | score.py |
| L3    | cam_reachable             | spec.process ∈ {cnc-3ax, cnc-5ax}          | score.py |
| L3    | support_volume_ratio      | spec.process ∈ {fdm, sla, sls, dmls}       | score.py |
| L3    | dfm_score                 | any L3 metric activated                    | score.py |
| L4    | fea_yield_pass            | spec.faeLoadN + feaMaxStressMpa            | score.py |
| L4    | param_range_integrity     | spec.paramRange + adapter has scriptPath   | param_sweep.py |
| L4    | param_edit_acc            | spec.edits + adapter has scriptPath        | param_sweep.py |
| L4    | paraphrase_iou_var        | task id ∈ PARA-* (cross-run)               | aggregate.py |
| L4    | seed_variance             | seeds ≥ 2 (cross-run)                      | aggregate.py |
| L4    | confidence_calibration    | run carries selfReportedConfidence         | aggregate.py |
| L4    | edit_latency_ratio        | both PARAM-013 and MECH-014 in sweep       | aggregate.py |
|       | latency_p50/p95           | always (cross-run)                         | aggregate.py |
|       | cost_per_task             | adapter reports costUsd                    | aggregate.py |

## Adding an agent

1. Drop a file in `scripts/adapters/<name>.ts` that exports a function
   `(prompt: string, outDir: string, seed: number) => Promise<{ artifactPath, format, scriptPath?, ...telemetry }>`.
   Return `scriptPath` when the adapter emits an editable source script
   (CadQuery .py / OpenSCAD .scad) — that unlocks parametric metrics.
2. Register the adapter in `scripts/run-evals.ts:ADAPTERS`.
3. Add a stub to `lib/data/agents.ts`.

## Reproducibility

- All sweeps with `--seeds N` use seeds 1..N. PARA-* tasks use seeds
  `100·N + variant_index` so the variant slot is recoverable from the
  JSONL without an extra column.
- ICP initial pose is fixed by `np.random.seed(0)` inside `score.py`.
- Voxel pitch is 1 mm; sample counts are 50 k for surface metrics and
  30 k for normal consistency. Override with env vars
  `CADBENCH_VOXEL_MM`, `CADBENCH_SURF_SAMPLES`, `CADBENCH_NORMAL_SAMPLES`.
- `--no-param-sweep` disables the parametric re-render (saves ~minutes
  per param-range task at the cost of dropping L4 columns).
- `--no-aggregate` skips the end-of-sweep summary.

## Files

```
scripts/
  run-evals.ts            # orchestrator
  adapters/               # per-agent prompt → artifact pipelines
  scoring/
    score.py              # single-artifact metrics (L1-L3 + FEA gate)
    param_sweep.py        # parametric robustness (calls back into score.py)
    aggregate.py          # cross-run variance / calibration / latency
    requirements.txt
```
