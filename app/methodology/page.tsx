import { METRICS } from "@/lib/data/metrics";
import { CATEGORIES } from "@/lib/data/categories";

export default function Methodology() {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-3xl">
      <header className="not-prose space-y-4 mb-12 border-b pb-8">
        <div className="eyebrow">Methodology · v0.5 · 2026-04-12</div>
        <h1 className="font-serif text-[38px] md:text-[44px] leading-[1.05] tracking-tight">
          How CAD-Bench <span className="italic text-[var(--accent)]">scores</span> agents
        </h1>
        <p className="text-[var(--muted)] text-[15px] leading-[1.7] max-w-2xl">
          The harness is open-source and built to be reproducible: a single Python entry point reads
          <code className="font-mono"> tasks.jsonl</code>, dispatches each prompt to a registered agent, and writes
          a per-run record (artifact, latency, tokens, metrics) into <code className="font-mono">runs.jsonl</code>.
          The site you are reading is a static render of those records.
        </p>
      </header>

      <h2 id="dataset" className="text-base font-medium tracking-tight mt-10">Dataset</h2>
      <ul className="text-sm leading-relaxed space-y-1">
        <li><b>{CATEGORIES.reduce((s, c) => s + c.taskCount, 0)} tasks</b> across {CATEGORIES.length} categories. The pilot subset rendered on this site is a stratified sample of {CATEGORIES.length} × ~2 tasks per category.</li>
        <li>Each task ships with a <em>canonical reference</em>: an AP242 STEP file and a 200 k-vertex tessellation, sha-256 fingerprinted in the task entry.</li>
        <li>Reference parts were authored in Onshape by four mechanical engineers and reviewed by a fifth (inter-rater κ = 0.84 on the GD&amp;T sub-set).</li>
        <li>Eleven prompts are paraphrased — both originals and paraphrases are scored separately and treated as identical tasks for averaging.</li>
        <li><b>Held-out:</b> reference STEP files are signed and not exposed in the prompt context. Agents are scored against them blind.</li>
      </ul>

      <h2 className="text-base font-medium tracking-tight mt-10">Run protocol</h2>
      <ol className="text-sm leading-relaxed space-y-1 list-decimal pl-5">
        <li>Each (agent, task) pair is sampled <code className="font-mono">k = 5</code> times with seeds 1…5.</li>
        <li>The agent receives the verbatim prompt and may return either a STEP, STL, GLB, or executable source (OpenSCAD/CadQuery). Source is executed inside an isolated Vercel Sandbox with a 90 s wall-clock cap, no network, and 4 GiB memory.</li>
        <li>The output is rigidly aligned to the reference by ICP (≤ 5° rotation, ≤ 2 mm translation) before any geometric metric is computed. Misalignment that exceeds this budget counts as a hard fail.</li>
        <li>Boolean validity (watertightness, manifoldness, Euler compliance) is checked via <code className="font-mono">OpenCascade 7.8 ShapeAnalysis</code>.</li>
        <li>Latency is measured client-side, end-to-end. Cost is the verifiable invoice from the provider, not a list-price estimate.</li>
      </ol>

      <h2 className="text-base font-medium tracking-tight mt-10">Metrics</h2>
      <div className="border rounded-md bg-[var(--card)] divide-y not-prose mt-3">
        {METRICS.map((m) => (
          <div key={m.id} className="px-4 py-3">
            <div className="flex items-baseline gap-3">
              <span className="text-sm">{m.name}</span>
              <span className="text-[10px] font-mono text-[var(--muted)]">{m.unit}</span>
              <span className="text-[10px] font-mono text-[var(--muted)]">{m.higherIsBetter ? "higher = better" : "lower = better"}</span>
            </div>
            <p className="text-[12px] text-[var(--muted)] mt-1 leading-relaxed">{m.formula}</p>
            {m.reference && <p className="text-[11px] text-[var(--muted)] font-mono mt-1">{m.reference}</p>}
          </div>
        ))}
      </div>

      <h2 className="text-base font-medium tracking-tight mt-10">Composite score</h2>
      <p className="text-sm leading-relaxed">
        For category <code className="font-mono">c</code> we compute a per-task score
        <code className="font-mono"> S_c(t) = mean over c.primaryMetrics of normalize(metric)</code>, where
        <code className="font-mono"> normalize</code> maps each metric onto 0..100 with the transforms documented in
        <code className="font-mono"> lib/data/results.ts</code> (e.g. <code className="font-mono">vol_iou·100</code>,
        <code className="font-mono"> max(0, 100 − chamfer·50)</code>). A 95 % bias-corrected
        bootstrap CI over the per-task scores is reported. The composite is the category-weighted mean over all tasks
        with weights <code className="font-mono">w_c</code> in the categories table.
      </p>

      <h2 className="text-base font-medium tracking-tight mt-10">Reproducibility</h2>
      <ul className="text-sm leading-relaxed space-y-1">
        <li>All randomness (sample seeds, ICP initial poses, voxelisation orientation) is recorded.</li>
        <li>Run sheets are publishable as a single JSONL; we publish the exact one used to produce these tables.</li>
        <li>The runner ships with offline reference scoring code (<code className="font-mono">scripts/score.py</code>) so vendors can verify their numbers against ours.</li>
        <li>Adding a new agent is one TypeScript stub plus a runner adapter; see <code className="font-mono">scripts/run-evals.ts</code>.</li>
      </ul>

      <h2 className="text-base font-medium tracking-tight mt-10">Known limitations</h2>
      <ul className="text-sm leading-relaxed space-y-1">
        <li>Mesh-only agents (Trellis, Spline) cannot be scored on STEP round-trip and BREP feature recall, and therefore lose ~25 weighted points by construction.</li>
        <li>The DFM rubric encodes a particular set of manufacturing assumptions (3-axis CNC + injection moulding). FDM-only or DLP-only suites would re-weight differently.</li>
        <li>Human baseline timing is wall-clock at the bench; the harness does not yet model tool licence cost (only seat-hour rate).</li>
        <li>The pilot subset shown on this site is small enough that some category CIs span ~15 points; full-suite numbers (n=194) tighten these by ≈√(194/22) ≈ 3×.</li>
      </ul>
    </div>
  );
}
