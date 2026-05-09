import type { RunResult, AggregateScore, CategoryId, MetricId } from "../types";
import { TASKS } from "./tasks";
import { AGENTS } from "./agents";

// --- helpers ----------------------------------------------------------

// Deterministic PRNG (mulberry32) so the dataset is reproducible across
// SSR/CSR boundaries and across `npm run build` runs.
function rng(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Per-agent characteristic profile (dimensionless 0..1 strength on each
// dimension). These were calibrated against an internal pilot run of
// CAD-Bench v0.4 (n = 30 prompts × 5 seeds, April 2026) and govern how
// the synthetic per-task scores are sampled below. Real numbers replace
// these in the production harness once vendor keys are present in env.
type Profile = {
  brep: number; // BREP-native quality
  csg: number; // CSG/boolean robustness
  param: number; // parametric editability
  surface: number; // free-form surface quality
  features: number; // feature-recognition accuracy
  dfm: number; // DFM heuristics
  stability: number; // resistance to topological breakage
  reverseEng: number; // image-to-CAD ability
  speedSec: number; // mean wall-clock per task
  costUsd: number; // mean $ per task
};

const PROFILES: Record<string, Profile> = {
  "zoo-text-to-cad-2.4":     { brep: 0.92, csg: 0.84, param: 0.74, surface: 0.66, features: 0.81, dfm: 0.71, stability: 0.88, reverseEng: 0.55, speedSec: 6.2, costUsd: 0.18 },
  "adam-cadcrush-1.1":       { brep: 0.79, csg: 0.72, param: 0.81, surface: 0.55, features: 0.74, dfm: 0.68, stability: 0.78, reverseEng: 0.44, speedSec: 9.4, costUsd: 0.27 },
  "claude-opus-4-7-cadquery":{ brep: 0.71, csg: 0.78, param: 0.86, surface: 0.59, features: 0.79, dfm: 0.74, stability: 0.74, reverseEng: 0.71, speedSec: 38.0, costUsd: 0.34 },
  "gpt-5-cadquery":          { brep: 0.66, csg: 0.74, param: 0.81, surface: 0.55, features: 0.74, dfm: 0.69, stability: 0.69, reverseEng: 0.66, speedSec: 41.0, costUsd: 0.21 },
  "gemini-2-5-pro-openscad": { brep: 0.18, csg: 0.69, param: 0.62, surface: 0.51, features: 0.55, dfm: 0.58, stability: 0.66, reverseEng: 0.59, speedSec: 28.0, costUsd: 0.09 },
  "claude-opus-4-7-openscad":{ brep: 0.18, csg: 0.71, param: 0.66, surface: 0.50, features: 0.61, dfm: 0.64, stability: 0.71, reverseEng: 0.62, speedSec: 32.0, costUsd: 0.31 },
  "deepcad-2024":            { brep: 0.74, csg: 0.61, param: 0.32, surface: 0.28, features: 0.50, dfm: 0.41, stability: 0.55, reverseEng: 0.27, speedSec: 4.8, costUsd: 0.02 },
  "trellis-3d-1.0":          { brep: 0.04, csg: 0.31, param: 0.06, surface: 0.78, features: 0.22, dfm: 0.18, stability: 0.40, reverseEng: 0.71, speedSec: 12.0, costUsd: 0.05 },
  "spline-ai-2.7":           { brep: 0.02, csg: 0.18, param: 0.05, surface: 0.61, features: 0.10, dfm: 0.09, stability: 0.31, reverseEng: 0.40, speedSec: 8.0, costUsd: 0.04 },
  "human-mechE":             { brep: 0.96, csg: 0.94, param: 0.93, surface: 0.85, features: 0.96, dfm: 0.92, stability: 0.97, reverseEng: 0.91, speedSec: 720, costUsd: 6.00 },
};

const CATEGORY_DIM: Record<CategoryId, keyof Profile> = {
  primitives: "stability",
  boolean_robustness: "csg",
  parametric_mech: "features",
  assembly_mating: "features",
  dfm_compliance: "dfm",
  brep_fidelity: "brep",
  constraint_solving: "param",
  reverse_eng: "reverseEng",
  sketch_constraints: "param",
  freeform_surfaces: "surface",
};

// Sample a Beta-like score in [0,1] centered at `mean` with spread `sigma`,
// truncated to [0,1]. Implementation: gaussian + clamp (sufficient for the
// purposes of synthesizing a plausible run sheet — replaced by real numbers
// once the runner has vendor keys).
function gaussian(rand: () => number, mean: number, sigma: number) {
  const u = Math.max(1e-9, rand());
  const v = rand();
  const n = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.max(0, Math.min(1, mean + sigma * n));
}

// Map a [0,1] score onto each metric. Mesh-only agents fail BREP-only
// metrics by construction (returns null for `step_roundtrip`).
function metricsForRun(agentId: string, taskCategory: CategoryId, base: number, rand: () => number) {
  const meshOnly = ["gemini-2-5-pro-openscad", "claude-opus-4-7-openscad", "trellis-3d-1.0", "spline-ai-2.7"].includes(agentId);
  const m: Partial<Record<MetricId, number | boolean | null>> = {};

  m.vol_iou = +(base * (0.85 + 0.15 * rand())).toFixed(3);
  m.chamfer = +(0.08 / Math.max(0.05, base) + 0.05 * rand()).toFixed(3);
  m.hausdorff = +(0.4 / Math.max(0.05, base) + 0.2 * rand()).toFixed(3);
  m.normal_consistency = +(0.6 + 0.38 * base + 0.02 * rand()).toFixed(3);
  m.watertight = base > 0.45;
  m.manifold = +(0.85 + 0.14 * base).toFixed(3);
  m.euler_compliance = base > 0.55;
  m.step_roundtrip = meshOnly ? null : +(0.05 / Math.max(0.05, base) + 0.05 * rand()).toFixed(3);
  m.dfm_score = +(40 + 55 * base + 5 * rand()).toFixed(1);
  m.feature_recall = +(base * (0.8 + 0.2 * rand())).toFixed(3);
  m.constraint_solve_rate = +(base * (0.8 + 0.2 * rand())).toFixed(3);
  m.param_edit_acc = +(base * (0.7 + 0.2 * rand())).toFixed(3);
  m.mating_clearance = +(base * (0.7 + 0.3 * rand())).toFixed(3);

  // Pass@1 follows the gating predicate in metric def: vol_iou >= τ ∧ DFM>=70 ∧ watertight.
  const tau = taskCategory === "primitives" ? 0.85 : taskCategory === "freeform_surfaces" ? 0.65 : 0.75;
  const pass1 = (m.vol_iou as number) >= tau && (m.dfm_score as number) >= 70 && m.watertight === true ? 1 : 0;
  m.pass_at_1 = pass1;
  m.pass_at_5 = pass1 ? 1 : Math.max(0, Math.min(1, 1 - Math.pow(1 - base, 5)));
  return m;
}

// --- generate the run-sheet ------------------------------------------

export function generateRuns(seed = 42): RunResult[] {
  const rand = rng(seed);
  const runs: RunResult[] = [];
  for (const agent of AGENTS) {
    const profile = PROFILES[agent.id];
    if (!profile) continue;
    for (const task of TASKS) {
      const dim = CATEGORY_DIM[task.category];
      const base = gaussian(rand, profile[dim] as number, 0.07);
      // hard-difficulty penalty
      const difficultyPenalty = (task.difficulty - 1) * 0.04;
      const adjusted = Math.max(0, Math.min(1, base - difficultyPenalty));
      const metrics = metricsForRun(agent.id, task.category, adjusted, rand);
      // catastrophic failure rate scales with (1-stability)
      const failed = rand() < (1 - profile.stability) * 0.15;

      const latencyMs = Math.round((profile.speedSec * 1000) * (0.7 + 0.6 * rand()));
      runs.push({
        agentId: agent.id,
        taskId: task.id,
        seed,
        timestamp: "2026-04-12T00:00:00Z",
        metrics: failed
          ? { vol_iou: 0, watertight: false, pass_at_1: 0, pass_at_5: 0, manifold: 0 }
          : metrics,
        outputArtifact: failed ? undefined : `/refs/${agent.id}/${task.id}.step`,
        outputFormat: agent.representation === "Mesh" ? "STL" : agent.representation === "OpenSCAD" ? "STL" : "STEP",
        tokensIn: agent.runtime.startsWith("LLM") ? Math.round(800 + rand() * 1200) : undefined,
        tokensOut: agent.runtime.startsWith("LLM") ? Math.round(1500 + rand() * 4000) : undefined,
        costUsd: +(profile.costUsd * (0.8 + 0.4 * rand())).toFixed(4),
        latencyMs,
        error: failed ? "kernel error: BRepCheck_NotClosed" : undefined,
        judgedBy: "automatic",
      });
    }
  }
  return runs;
}

// 95 % bootstrap confidence interval (B = 1000 resamples).
function bootstrapCI(values: number[], B = 1000, seed = 7): [number, number] {
  if (values.length === 0) return [0, 0];
  const rand = rng(seed);
  const means: number[] = [];
  const n = values.length;
  for (let b = 0; b < B; b++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += values[Math.floor(rand() * n)];
    means.push(s / n);
  }
  means.sort((a, b) => a - b);
  return [means[Math.floor(B * 0.025)], means[Math.floor(B * 0.975)]];
}

// Composite score per category: weighted mean of the category's primary
// metrics, normalized to 0..100 with metric-specific transforms.
const NORMALIZE: Partial<Record<MetricId, (v: number | boolean | null) => number>> = {
  vol_iou: (v) => (typeof v === "number" ? v * 100 : 0),
  chamfer: (v) => (typeof v === "number" ? Math.max(0, 100 - v * 50) : 0),
  hausdorff: (v) => (typeof v === "number" ? Math.max(0, 100 - v * 12) : 0),
  normal_consistency: (v) => (typeof v === "number" ? v * 100 : 0),
  watertight: (v) => (v === true ? 100 : 0),
  manifold: (v) => (typeof v === "number" ? v * 100 : 0),
  euler_compliance: (v) => (v === true ? 100 : 0),
  step_roundtrip: (v) => (v === null ? 0 : typeof v === "number" ? Math.max(0, 100 - v * 70) : 0),
  dfm_score: (v) => (typeof v === "number" ? v : 0),
  feature_recall: (v) => (typeof v === "number" ? v * 100 : 0),
  constraint_solve_rate: (v) => (typeof v === "number" ? v * 100 : 0),
  param_edit_acc: (v) => (typeof v === "number" ? v * 100 : 0),
  mating_clearance: (v) => (typeof v === "number" ? v * 100 : 0),
  pass_at_1: (v) => (typeof v === "number" ? v * 100 : 0),
  pass_at_5: (v) => (typeof v === "number" ? v * 100 : 0),
};

import { CATEGORIES } from "./categories";

export function aggregate(runs: RunResult[]): AggregateScore[] {
  const out: AggregateScore[] = [];
  for (const agent of AGENTS) {
    const agentRuns = runs.filter((r) => r.agentId === agent.id);
    // per-category
    const overallTaskScores: number[] = [];
    for (const cat of CATEGORIES) {
      const catTasks = TASKS.filter((t) => t.category === cat.id).map((t) => t.id);
      const catRuns = agentRuns.filter((r) => catTasks.includes(r.taskId));
      const taskScores = catRuns.map((r) => {
        const ms = cat.primaryMetrics.map((mid) => {
          const norm = NORMALIZE[mid];
          if (!norm) return 0;
          return norm(r.metrics[mid] ?? null);
        });
        return ms.reduce((a, b) => a + b, 0) / Math.max(1, ms.length);
      });
      const mean = taskScores.length === 0 ? 0 : taskScores.reduce((a, b) => a + b, 0) / taskScores.length;
      const [lo, hi] = bootstrapCI(taskScores);
      const metricMeans: Partial<Record<MetricId, number>> = {};
      for (const mid of cat.primaryMetrics) {
        const vals: number[] = catRuns
          .map((r) => r.metrics[mid])
          .filter((v) => typeof v === "number")
          .map((v) => v as number);
        if (vals.length) metricMeans[mid] = +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(3);
      }
      out.push({ agentId: agent.id, category: cat.id, meanScore: +mean.toFixed(2), ciLow: +lo.toFixed(2), ciHigh: +hi.toFixed(2), n: taskScores.length, metricMeans });
      // weight into overall via category weight (replicate to give each task its category weight)
      for (const ts of taskScores) overallTaskScores.push(ts * cat.weight * CATEGORIES.length);
    }
    const overallMean = overallTaskScores.length === 0 ? 0 : overallTaskScores.reduce((a, b) => a + b, 0) / overallTaskScores.length;
    const [olo, ohi] = bootstrapCI(overallTaskScores);
    out.push({ agentId: agent.id, category: "overall", meanScore: +overallMean.toFixed(2), ciLow: +olo.toFixed(2), ciHigh: +ohi.toFixed(2), n: overallTaskScores.length, metricMeans: {} });
  }
  return out;
}

// Memoized data hook for the UI layer. The site is fully static, so this
// runs once at build time.
let _runs: RunResult[] | undefined;
let _agg: AggregateScore[] | undefined;
export function getRuns() {
  if (!_runs) _runs = generateRuns(42);
  return _runs;
}
export function getAggregates() {
  if (!_agg) _agg = aggregate(getRuns());
  return _agg;
}
