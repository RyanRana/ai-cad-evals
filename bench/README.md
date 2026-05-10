# bench/ — real CAD-Bench harness

This is the live benchmarking pipeline that produces the numbers shown on the
site. Until you provision the secrets in `.env.local`, the site renders the
deterministic synthetic generator in `lib/data/results.ts`. As soon as
`POSTGRES_URL` is set and the `aggregates` table has rows, every page swaps
over to the live data via `lib/data/results-db.ts`.

## Pipeline

```
                ┌────────────────┐
                │ bench/seed.py  │  build123d → STEP → Vercel Blob → Postgres
                │  (reference)   │
                └────────┬───────┘
                         │
        ┌────────────────┴────────────────┐
        │                                 │
┌───────▼────────┐               ┌────────▼────────┐
│ bench/run.py   │  for each      │  metric pipeline │
│  (sweep)       │──────────────▶│  trimesh/scipy/  │
│  agents × tasks│               │  build123d       │
└───────┬────────┘               └────────┬────────┘
        │                                 │
        ▼                                 ▼
   Vercel Blob                    Postgres `runs` +
  (candidate STEPs)               `metric_values` rows
                                          │
                          ┌───────────────┴───────────┐
                          ▼                           ▼
                  bench/aggregate.py           Next.js pages
                  → `aggregates` table        (ISR, 1h revalidate)
```

## Setup

```bash
# 1. Python env (local or CI)
cd bench
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 2. .env.local at repo root — see .env.example for the full list
#    Required: POSTGRES_URL, BLOB_READ_WRITE_TOKEN, ≥1 agent key
cp ../.env.example ../.env.local
# fill it in

# 3. Provision the schema
python -m bench.db_init           # or: psql $POSTGRES_URL -f bench/sql/schema.sql

# 4. Author and upload reference parts (idempotent)
python -m bench.seed              # all
python -m bench.seed PRIM-001     # one

# 5. Run the sweep
python -m bench.run                                  # everything available
python -m bench.run --tasks PRIM-001 --seeds 3
python -m bench.run --agents claude-opus-4-7-cadquery

# 6. Roll up
python -m bench.aggregate
```

After `aggregate`, the next page hit (or a `vercel deploy --prod`) will show
real data. The synthetic generator stays as the fallback; if Postgres is down
the site keeps rendering rather than 500ing.

## What's covered today

| Layer | Categories | Reference parts | Metrics |
| --- | --- | --- | --- |
| L1 geometry | primitives, boolean_robustness, brep_fidelity | 10 (PRIM-001/2/3/4/5/7/9, BOOL-003/9, BREP-004) | vol IoU, chamfer, Hausdorff p95, normal consistency, watertight, manifold, Euler compliance, STEP round-trip, pass@1 |
| L2 engineering | — | none yet | — |
| L3 manufacturing | — | none yet | — |
| L4 cognition | — | none yet | — |

L2/L3/L4 are deliberately empty pending real reference parts and analyzers
(GD&T parser, DFM rules, FEA solver). Each new category needs:
1. Authored reference part(s) in `bench/reference/`
2. Metric implementation(s) in `bench/metrics/`
3. Entry in `WEIGHTS`/`NORMALISE` in `bench/aggregate.py`

## Cost guardrails

A full L1 sweep (10 tasks × 3 agents × 1 seed) costs roughly:

- Claude Opus: 10 × ~$0.05 = $0.50
- GPT-5: 10 × ~$0.02 = $0.20
- Zoo Text-to-CAD: 10 × $0.10 = $1.00

Per refresh: **≈ $1.70**. Multiply by `--seeds`. CI cron at hourly cadence
would be ≈ $40/day; nightly is ≈ $1.70/day — pick accordingly.

## Sandbox notice

`bench/agents/_cadquery_runner.py` executes LLM-emitted Python in a
subprocess + tmp cwd + timeout. That is *not* a security boundary against
adversarial scripts. For the public benchmark, swap the subprocess for
[Vercel Sandbox](https://vercel.com/docs/sandbox) — the runner already isolates
output to a returned STEP path so the swap is local.
