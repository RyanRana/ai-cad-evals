# CAD-Bench harness

A small toolkit for running CAD-Bench v0.4 against any subset of the
registered agents and producing the JSONL run-sheet that powers the site.

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

The scorer (`scripts/scoring/score.py`) loads `public/refs/<task>.glb` as
the held-out ground truth, runs ICP alignment, and emits the metric block
expected by `lib/types.ts:RunResult.metrics`. The runner concatenates
those onto the per-call telemetry and writes one JSON object per line.

## Adding an agent

1. Drop a file in `scripts/adapters/<name>.ts` that exports a function
   `(prompt: string, outDir: string, seed: number) => Promise<{ artifactPath, format, ...telemetry }>`.
2. Register the adapter in `scripts/run-evals.ts:ADAPTERS`.
3. Add a stub to `lib/data/agents.ts`.

## Reproducibility

- All sweeps run with `--seeds N` use seeds 1..N.
- ICP initial pose is fixed by `np.random.seed(0)` inside `score.py`.
- Voxel pitch is 1 mm; sample counts are 50 k for surface metrics and
  30 k for normal consistency. Override with env vars (see
  `scripts/scoring/score.py`).
