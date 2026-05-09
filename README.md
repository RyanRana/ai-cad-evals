# CAD-Bench

A research-grade benchmark for AI CAD agents. 308 prompts across 20 categories
in four layers — geometry, engineering, manufacturing, cognition — scored with
bootstrap CIs, 2PL IRT ability θ, worst-case p5, capability tiers, and a
(capability, $/task) Pareto frontier. Live: <https://github.com/RyanRana/ai-cad-evals>.

This repo contains:

- **`app/`** — the static Next.js site (67 prerendered pages: leaderboard,
  per-agent, per-task with 3D viewer, per-category, methodology, design rationale).
- **`lib/data/`** — the canonical data: agents, categories, tasks, metrics,
  ground-truth shapes, scoring (mean / IRT / p5 / Pareto / tier).
- **`scripts/`** — the Python + TypeScript eval harness that runs real agents
  (Zoo Text-to-CAD, CADcrush Adam, Claude / GPT-5 / Gemini → CadQuery / OpenSCAD,
  DeepCAD, Trellis 3D, Spline AI) and produces the JSONL run-sheet that
  populates the site.

## Local development

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## Deploy on Vercel

The site is fully static — it can be deployed in one click and serves
without any environment variables.

```bash
# one-time
npm install -g vercel
vercel login

# deploy a preview from the current branch
vercel

# promote to production
vercel --prod
```

Project configuration lives in [`vercel.ts`](./vercel.ts) (typed
`@vercel/config` schema). Long-lived assets under `/_next/static/*` and
`/refs/*` are served `immutable`; every other route gets a strict referrer
policy.

A one-click deploy:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FRyanRana%2Fai-cad-evals)

## Running the actual benchmark

The site you see is rendered from `lib/data/results.ts`. To replace those
synthetic numbers with real ones, see [`scripts/README.md`](./scripts/README.md).
The short version:

```bash
pip install -r scripts/scoring/requirements.txt
brew install opencascade openscad      # or apt equivalent

export ZOO_API_KEY=...
export ANTHROPIC_API_KEY=...
export OPENAI_API_KEY=...
export GOOGLE_API_KEY=...

npx tsx scripts/run-evals.ts --seeds 5 --out runs/$(date +%F).jsonl
```

## Citation

```
CAD-Bench v0.5 (2026). Open evaluation harness for AI CAD agents.
https://github.com/RyanRana/ai-cad-evals
```
