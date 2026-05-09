# X · 05 · Thread starter

Highest reach ceiling, highest effort. You write the thread once and it
pays back across replies, screenshots, quote-tweets.

## Tweet 1 / 7 (251 chars)

```
the current state of AI CAD: a thread.

I evaluated 10 agents (Zoo, Adam, Claude, GPT-5, Gemini, Trellis, Spline, DeepCAD, +human baseline) on 308 engineering prompts across 20 categories.

most of them can't make a flange.

what's actually going on ↓
```

## Tweet 2 / 7 (236 chars)

```
1/ "good at CAD" is 5 orthogonal capabilities — not one.

intent → spec
spec → BREP
engineering soundness (GD&T, fits, draft)
editability under parametric edits
reliability across seeds and paraphrases

every agent dies on a different one.
```

## Tweet 3 / 7 (245 chars)

```
2/ scoring as a single number lies.

CADBench reports four side-by-side:
- mean composite (with bootstrap CI)
- IRT 2PL ability θ — calibrated against task difficulty
- p5 worst-case (the bad-day score)
- $/task Pareto frontier

different agents win different views.
```

## Tweet 4 / 7 (267 chars)

```
3/ the BREP barrier.

mesh-only models (Trellis, Spline) generate beautiful parts that fail STEP round-trip + manufacturing analysis by construction.

native-BREP agents (Zoo, Adam) win on geometry but lose on parametric editability.

LLM+CadQuery wins on editing, loses on raw quality.
```

## Tweet 5 / 7 (262 chars)

```
4/ the flange problem.

a flange — 30 mm hub, 100 mm plate, 6 bolt holes on a PCD — is the most common production CAD prompt anywhere.

8/10 agents in CADBench produced a topologically broken flange on at least one of 5 seeds.

Zoo got it right 5/5. Everyone else: shaky.
```

## Tweet 6 / 7 (241 chars)

```
5/ the real bottleneck isn't generation. it's evaluation.

the field has shipped a dozen text-to-CAD tools and zero shared benchmarks. demos cherry-pick prompts; users discover failure modes the hard way.

CADBench is a swing at fixing the eval gap.
```

## Tweet 7 / 7 (197 chars)

```
6/ open-source. you can swap in your own agent in one TypeScript adapter, run it through 308 prompts, and post your own scorecard.

repo + methodology in the next reply.

let me know what I should add to v0.6.
```

## Final reply

```
github.com/RyanRana/ai-cad-evals
```

## Why this works

- Threads convert better than single posts on X right now.
- Each tweet is screenshot-able as standalone insight, which doubles the
  surface area for quote-tweets.
- The "X / 7" numbering trains the reader to scroll all the way down.
- Every tweet has its own contrarian punch — five surprises, not one.
