# HN first comment (you, posted within 60 s of the link)

When the submission is just a link, you become the first comment to add
context. Keep it under ~1500 chars or HN truncates above the fold.

## Comment

```
Hey HN — I work in mech CAD and have been irritated for months that
every "text to CAD" demo on X handpicks the same five prompts. So I
spent two weekends building a benchmark.

CADBench v0.5 is 308 prompts across 20 categories arranged in 4 layers:

  L1 Geometry      — automatic IoU / Chamfer / BREP topology
  L2 Engineering   — named-dim RMSE, GD&T parser, ISO/DIN fits, mating
  L3 Manufacturing — DFM analyzer per process (CNC / mould / FDM),
                     CAM postprocessor reachability
  L4 Cognition     — paraphrase variance, parametric range integrity,
                     FEA-yield pass at spec'd loads, Brier calibration

Each layer has a different correct judging modality. Mixing them
obscures what an agent is actually good at — that's the v0.4 mistake I
was trying to fix.

Scoring reports four numbers side-by-side, not one: weighted mean with
bootstrap CI, 2PL IRT ability θ joint-fit over (agent, task), 5th-percentile
worst-case, and a (capability, $/task) Pareto frontier. There's also a
five-tier classification gated on capability AND reliability AND BREP
fidelity, so a mesh-only agent can't reach Tier S no matter how high
its raw IoU is.

Tested: Zoo Text-to-CAD, CADcrush Adam, Claude Opus 4.7 → CadQuery,
GPT-5 → CadQuery, Gemini 2.5 Pro → OpenSCAD, Claude → OpenSCAD,
DeepCAD, Trellis 3D, Spline AI, plus a 4-engineer human baseline.

The flange thing in the title is real. A 30 mm hub / 100 mm plate / 6
bolt holes on a PCD is the most common production CAD prompt anywhere,
and 8/10 agents produced a topologically broken result on at least one
of 5 seeds.

Open source, MIT. Adding a new agent is one TypeScript adapter. Would
love feedback on what to add to v0.6 — the obvious gaps are multi-body
assemblies (>3 parts), live FEA-in-the-loop, and a real-manufacture
checkpoint (CNC + scan + compare).
```

## After-the-comment do/don't

**Do:**
- Refresh once an hour. Reply to specific technical questions with
  specific technical answers. Link to /methodology.
- If someone says "you should also test X", thank them and add it to
  the v0.6 list. People who feel heard upvote.

**Don't:**
- Don't argue with the obligatory "but you didn't test on MY favorite
  CAD tool" comment. Just say "PR welcome — adapter is one file" and
  link to scripts/adapters/.
- Don't reply more than ~10 times. Past that you look defensive.
- Don't post to multiple news aggregators on the same day. Lobste.rs
  next day, /r/MachineLearning the day after that.
