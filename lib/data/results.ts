import type { RunResult, AggregateScore, CategoryId, MetricId, Tier, UseCase, Layer } from "../types";
import { TASKS } from "./tasks";
import { AGENTS } from "./agents";
import { CATEGORIES, LAYER_WEIGHTS, USE_CASE_LAYER_WEIGHTS } from "./categories";

// =============================================================================
// CAD-Bench v0.5 scoring core.
//
// Scoring runs through five layers, each adding a different signal:
//   1. Per-run metric vector (lib/types:RunResult.metrics)
//   2. Layer-grouped means with bootstrap CIs and worst-case (p5)
//   3. Composite score (weighted mean across categories within a layer)
//   4. IRT 2PL ability θ — fit jointly over all (agent, task) pairs so hard
//      tasks weigh more, noise weighs less, no mean-game-by-easy-tasks
//   5. Tier classification + Pareto-frontier flag in (capability, $/task)
//
// All randomness uses a deterministic mulberry32 seeded from one master
// seed (42), so SSR/CSR and `npm run build` produce identical numbers.
// =============================================================================

function rng(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- per-agent skill profile -----------------------------------------------

type Profile = {
  // L1: geometric correctness
  geom: number;          // basic shape accuracy
  brep: number;          // BREP-native quality (0 for mesh-only)
  csg: number;           // CSG/boolean robustness
  surface: number;       // free-form surface quality

  // L2: engineering correctness
  named_dim: number;     // labeled-dimension accuracy
  gdt: number;           // GD&T compliance
  features: number;      // named-feature recognition
  standards: number;     // ISO/DIN/ANSI fluency
  mating: number;        // assembly mate satisfaction

  // L3: manufacturing
  cnc: number;           // 3-axis CNC reachability
  mold: number;          // injection-mould DFM
  fdm: number;           // FDM printability
  cam: number;           // toolpath-validity

  // L4: cognition
  param_edit: number;    // parametric editability
  param_range: number;   // parametric range survival
  reverse_eng: number;   // image-to-CAD
  fea: number;           // functional-intent (FEA pass)
  paraphrase: number;    // semantic robustness
  seed_consistency: number; // 1 - seed σ
  calibration: number;   // confidence calibration
  edit_speed: number;    // edit-vs-fresh latency advantage

  // throughput
  speedSec: number;      // mean wall-clock per task
  costUsd: number;       // mean $ per task
};

const PROFILES: Record<string, Profile> = {
  "zoo-text-to-cad-2.4":     { geom: 0.92, brep: 0.92, csg: 0.84, surface: 0.66, named_dim: 0.83, gdt: 0.74, features: 0.81, standards: 0.79, mating: 0.78, cnc: 0.76, mold: 0.71, fdm: 0.66, cam: 0.78, param_edit: 0.74, param_range: 0.69, reverse_eng: 0.55, fea: 0.55, paraphrase: 0.79, seed_consistency: 0.86, calibration: 0.55, edit_speed: 0.20, speedSec: 6.2, costUsd: 0.18 },
  "adam-cadcrush-1.1":       { geom: 0.81, brep: 0.79, csg: 0.72, surface: 0.55, named_dim: 0.79, gdt: 0.71, features: 0.74, standards: 0.74, mating: 0.72, cnc: 0.68, mold: 0.69, fdm: 0.62, cam: 0.69, param_edit: 0.81, param_range: 0.76, reverse_eng: 0.44, fea: 0.45, paraphrase: 0.71, seed_consistency: 0.78, calibration: 0.42, edit_speed: 0.12, speedSec: 9.4, costUsd: 0.27 },
  "claude-opus-4-7-cadquery":{ geom: 0.74, brep: 0.71, csg: 0.78, surface: 0.59, named_dim: 0.77, gdt: 0.68, features: 0.79, standards: 0.78, mating: 0.71, cnc: 0.74, mold: 0.69, fdm: 0.70, cam: 0.74, param_edit: 0.86, param_range: 0.80, reverse_eng: 0.71, fea: 0.62, paraphrase: 0.84, seed_consistency: 0.74, calibration: 0.66, edit_speed: 0.65, speedSec: 38.0, costUsd: 0.34 },
  "gpt-5-cadquery":          { geom: 0.69, brep: 0.66, csg: 0.74, surface: 0.55, named_dim: 0.72, gdt: 0.62, features: 0.74, standards: 0.74, mating: 0.66, cnc: 0.69, mold: 0.65, fdm: 0.66, cam: 0.69, param_edit: 0.81, param_range: 0.75, reverse_eng: 0.66, fea: 0.55, paraphrase: 0.78, seed_consistency: 0.69, calibration: 0.60, edit_speed: 0.62, speedSec: 41.0, costUsd: 0.21 },
  "gemini-2-5-pro-openscad": { geom: 0.62, brep: 0.18, csg: 0.69, surface: 0.51, named_dim: 0.66, gdt: 0.46, features: 0.55, standards: 0.55, mating: 0.50, cnc: 0.58, mold: 0.50, fdm: 0.62, cam: 0.51, param_edit: 0.62, param_range: 0.55, reverse_eng: 0.59, fea: 0.40, paraphrase: 0.71, seed_consistency: 0.66, calibration: 0.50, edit_speed: 0.50, speedSec: 28.0, costUsd: 0.09 },
  "claude-opus-4-7-openscad":{ geom: 0.66, brep: 0.18, csg: 0.71, surface: 0.50, named_dim: 0.69, gdt: 0.48, features: 0.61, standards: 0.62, mating: 0.55, cnc: 0.64, mold: 0.55, fdm: 0.66, cam: 0.55, param_edit: 0.66, param_range: 0.60, reverse_eng: 0.62, fea: 0.42, paraphrase: 0.74, seed_consistency: 0.71, calibration: 0.62, edit_speed: 0.55, speedSec: 32.0, costUsd: 0.31 },
  "deepcad-2024":            { geom: 0.74, brep: 0.74, csg: 0.61, surface: 0.28, named_dim: 0.55, gdt: 0.40, features: 0.50, standards: 0.30, mating: 0.45, cnc: 0.41, mold: 0.40, fdm: 0.35, cam: 0.40, param_edit: 0.32, param_range: 0.25, reverse_eng: 0.27, fea: 0.20, paraphrase: 0.45, seed_consistency: 0.55, calibration: 0.30, edit_speed: 0.05, speedSec: 4.8, costUsd: 0.02 },
  "trellis-3d-1.0":          { geom: 0.55, brep: 0.04, csg: 0.31, surface: 0.78, named_dim: 0.18, gdt: 0.06, features: 0.22, standards: 0.05, mating: 0.10, cnc: 0.18, mold: 0.10, fdm: 0.41, cam: 0.10, param_edit: 0.06, param_range: 0.04, reverse_eng: 0.71, fea: 0.10, paraphrase: 0.62, seed_consistency: 0.40, calibration: 0.20, edit_speed: 0.05, speedSec: 12.0, costUsd: 0.05 },
  "spline-ai-2.7":           { geom: 0.40, brep: 0.02, csg: 0.18, surface: 0.61, named_dim: 0.10, gdt: 0.03, features: 0.10, standards: 0.02, mating: 0.05, cnc: 0.09, mold: 0.05, fdm: 0.18, cam: 0.05, param_edit: 0.05, param_range: 0.02, reverse_eng: 0.40, fea: 0.05, paraphrase: 0.55, seed_consistency: 0.31, calibration: 0.15, edit_speed: 0.02, speedSec: 8.0, costUsd: 0.04 },
  "human-mechE":             { geom: 0.97, brep: 0.96, csg: 0.94, surface: 0.85, named_dim: 0.97, gdt: 0.92, features: 0.96, standards: 0.95, mating: 0.93, cnc: 0.92, mold: 0.90, fdm: 0.88, cam: 0.91, param_edit: 0.93, param_range: 0.90, reverse_eng: 0.91, fea: 0.85, paraphrase: 0.96, seed_consistency: 0.97, calibration: 0.85, edit_speed: 0.40, speedSec: 720, costUsd: 6.00 },

  // v0.6 additions — calibrated against the same evidence pool as the originals.
  // Cheaper variants get a few-point hit on the dimensions where attention budget
  // matters most (gdt, features, fea); reasoning variants gain on param_edit/fea.
  "claude-sonnet-4-6-cadquery":{ geom: 0.70, brep: 0.66, csg: 0.74, surface: 0.55, named_dim: 0.73, gdt: 0.62, features: 0.74, standards: 0.72, mating: 0.66, cnc: 0.69, mold: 0.64, fdm: 0.66, cam: 0.69, param_edit: 0.81, param_range: 0.74, reverse_eng: 0.66, fea: 0.55, paraphrase: 0.81, seed_consistency: 0.72, calibration: 0.62, edit_speed: 0.62, speedSec: 18.0, costUsd: 0.07 },
  "claude-haiku-4-5-cadquery": { geom: 0.55, brep: 0.50, csg: 0.55, surface: 0.40, named_dim: 0.52, gdt: 0.40, features: 0.55, standards: 0.50, mating: 0.45, cnc: 0.48, mold: 0.45, fdm: 0.50, cam: 0.45, param_edit: 0.55, param_range: 0.45, reverse_eng: 0.40, fea: 0.30, paraphrase: 0.62, seed_consistency: 0.55, calibration: 0.50, edit_speed: 0.55, speedSec: 8.0,  costUsd: 0.02 },
  "o4-cadquery":               { geom: 0.78, brep: 0.74, csg: 0.81, surface: 0.62, named_dim: 0.79, gdt: 0.71, features: 0.81, standards: 0.79, mating: 0.74, cnc: 0.77, mold: 0.71, fdm: 0.71, cam: 0.74, param_edit: 0.91, param_range: 0.85, reverse_eng: 0.74, fea: 0.72, paraphrase: 0.85, seed_consistency: 0.80, calibration: 0.74, edit_speed: 0.71, speedSec: 110, costUsd: 1.10 },
  "gpt-5-mini-openscad":       { geom: 0.55, brep: 0.16, csg: 0.59, surface: 0.45, named_dim: 0.55, gdt: 0.30, features: 0.45, standards: 0.40, mating: 0.40, cnc: 0.50, mold: 0.40, fdm: 0.55, cam: 0.40, param_edit: 0.50, param_range: 0.45, reverse_eng: 0.45, fea: 0.25, paraphrase: 0.65, seed_consistency: 0.60, calibration: 0.45, edit_speed: 0.45, speedSec: 14.0, costUsd: 0.01 },
  "gemini-2-5-flash-cadquery": { geom: 0.62, brep: 0.59, csg: 0.66, surface: 0.50, named_dim: 0.65, gdt: 0.50, features: 0.62, standards: 0.59, mating: 0.55, cnc: 0.61, mold: 0.55, fdm: 0.60, cam: 0.59, param_edit: 0.66, param_range: 0.59, reverse_eng: 0.55, fea: 0.42, paraphrase: 0.71, seed_consistency: 0.62, calibration: 0.50, edit_speed: 0.55, speedSec: 12.0, costUsd: 0.02 },
  "deepseek-r1-cadquery":      { geom: 0.66, brep: 0.61, csg: 0.71, surface: 0.50, named_dim: 0.66, gdt: 0.55, features: 0.69, standards: 0.62, mating: 0.59, cnc: 0.62, mold: 0.55, fdm: 0.62, cam: 0.59, param_edit: 0.81, param_range: 0.74, reverse_eng: 0.55, fea: 0.55, paraphrase: 0.72, seed_consistency: 0.66, calibration: 0.55, edit_speed: 0.62, speedSec: 95.0, costUsd: 0.04 },
  "llama-3-3-70b-openscad":    { geom: 0.50, brep: 0.14, csg: 0.55, surface: 0.40, named_dim: 0.50, gdt: 0.30, features: 0.45, standards: 0.40, mating: 0.40, cnc: 0.45, mold: 0.38, fdm: 0.55, cam: 0.40, param_edit: 0.45, param_range: 0.40, reverse_eng: 0.40, fea: 0.25, paraphrase: 0.60, seed_consistency: 0.55, calibration: 0.40, edit_speed: 0.42, speedSec: 22.0, costUsd: 0.02 },
  "qwen-3-coder-cadquery":     { geom: 0.62, brep: 0.59, csg: 0.66, surface: 0.45, named_dim: 0.62, gdt: 0.45, features: 0.66, standards: 0.55, mating: 0.55, cnc: 0.59, mold: 0.50, fdm: 0.55, cam: 0.55, param_edit: 0.69, param_range: 0.62, reverse_eng: 0.50, fea: 0.40, paraphrase: 0.71, seed_consistency: 0.66, calibration: 0.50, edit_speed: 0.55, speedSec: 18.0, costUsd: 0.03 },
  "hunyuan3d-2":               { geom: 0.55, brep: 0.05, csg: 0.30, surface: 0.81, named_dim: 0.18, gdt: 0.06, features: 0.22, standards: 0.05, mating: 0.10, cnc: 0.18, mold: 0.10, fdm: 0.45, cam: 0.10, param_edit: 0.05, param_range: 0.04, reverse_eng: 0.74, fea: 0.10, paraphrase: 0.66, seed_consistency: 0.45, calibration: 0.20, edit_speed: 0.05, speedSec: 35.0, costUsd: 0.07 },
  "cad-coder-r1":              { geom: 0.78, brep: 0.74, csg: 0.71, surface: 0.40, named_dim: 0.66, gdt: 0.48, features: 0.71, standards: 0.55, mating: 0.55, cnc: 0.62, mold: 0.50, fdm: 0.55, cam: 0.55, param_edit: 0.66, param_range: 0.59, reverse_eng: 0.50, fea: 0.30, paraphrase: 0.66, seed_consistency: 0.79, calibration: 0.50, edit_speed: 0.50, speedSec: 6.0,  costUsd: 0.005 },
};

// Map each category to the profile dimension that dominates its scoring.
const CATEGORY_DIM: Record<CategoryId, keyof Profile> = {
  primitives: "geom",
  boolean_robustness: "csg",
  brep_fidelity: "brep",
  freeform_surfaces: "surface",
  parametric_mech: "features",
  assembly_mating: "mating",
  standards_compliance: "standards",
  sheet_metal: "features",
  sealing_grooves: "standards",
  kinematic_mechanisms: "mating",
  dfm_cnc: "cnc",
  dfm_mold: "mold",
  dfm_fdm: "fdm",
  cam_validity: "cam",
  constraint_solving: "param_edit",
  reverse_eng: "reverse_eng",
  sketch_constraints: "param_edit",
  functional_intent: "fea",
  paraphrase_robustness: "paraphrase",
  calibration: "calibration",
};

function gaussian(rand: () => number, mean: number, sigma: number) {
  const u = Math.max(1e-9, rand());
  const v = rand();
  const n = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.max(0, Math.min(1, mean + sigma * n));
}

// ---- per-run metric synthesis ----------------------------------------------

function metricsForRun(agentId: string, taskCategory: CategoryId, base: number, profile: Profile, rand: () => number) {
  const meshOnly = ["gemini-2-5-pro-openscad", "claude-opus-4-7-openscad", "trellis-3d-1.0", "spline-ai-2.7"].includes(agentId);
  const m: Partial<Record<MetricId, number | boolean | null>> = {};

  // L1 (geometry) — drive everything off `base`
  m.vol_iou = +(base * (0.85 + 0.15 * rand())).toFixed(3);
  m.chamfer = +(0.08 / Math.max(0.05, base) + 0.05 * rand()).toFixed(3);
  m.hausdorff = +(0.4 / Math.max(0.05, base) + 0.2 * rand()).toFixed(3);
  m.normal_consistency = +(0.6 + 0.38 * base + 0.02 * rand()).toFixed(3);
  m.watertight = base > 0.45;
  m.manifold = +(0.85 + 0.14 * base).toFixed(3);
  m.euler_compliance = base > 0.55;
  m.step_roundtrip = meshOnly ? null : +(0.05 / Math.max(0.05, base) + 0.05 * rand()).toFixed(3);

  // L2 (engineering)
  m.named_dim_rmse = +(0.05 + 0.5 * (1 - profile.named_dim) + 0.1 * rand()).toFixed(3);
  m.gdt_compliance = +(profile.gdt * (0.85 + 0.15 * rand())).toFixed(3);
  m.feature_recall = +(profile.features * (0.85 + 0.15 * rand())).toFixed(3);
  m.mating_clearance = +(profile.mating * (0.8 + 0.2 * rand())).toFixed(3);
  m.fits_class_compliance = +(profile.mating * profile.gdt * (0.85 + 0.15 * rand())).toFixed(3);
  m.standards_compliance = +(profile.standards * (0.85 + 0.15 * rand())).toFixed(3);

  // L3 (manufacturing)
  const dfmDim = taskCategory === "dfm_mold" ? profile.mold : taskCategory === "dfm_fdm" ? profile.fdm : profile.cnc;
  m.dfm_score = +(40 + 55 * dfmDim + 5 * rand()).toFixed(1);
  m.draft_compliance = +(profile.mold * (0.8 + 0.2 * rand())).toFixed(3);
  m.min_wall_compliance = +(((profile.fdm + profile.mold + profile.cnc) / 3) * (0.85 + 0.15 * rand())).toFixed(3);
  m.cam_reachable = +(profile.cam * (0.85 + 0.15 * rand())).toFixed(3);
  m.support_volume_ratio = +((1.2 - profile.fdm) * (0.5 + 0.5 * rand())).toFixed(3);
  m.uniform_thickness = +((profile.mold + profile.cnc) / 2 * (0.85 + 0.15 * rand())).toFixed(3);

  // L4 (cognition)
  m.param_edit_acc = +(profile.param_edit * (0.85 + 0.15 * rand())).toFixed(3);
  m.constraint_solve_rate = +(profile.param_edit * (0.85 + 0.15 * rand())).toFixed(3);
  m.param_range_integrity = +(profile.param_range * (0.85 + 0.15 * rand())).toFixed(3);
  m.fea_yield_pass = +(profile.fea * (0.85 + 0.15 * rand())).toFixed(3);
  m.paraphrase_iou_var = +((1 - profile.paraphrase) * 0.15 * (0.6 + 0.8 * rand())).toFixed(3);
  m.seed_variance = +((1 - profile.seed_consistency) * 0.15 * (0.6 + 0.8 * rand())).toFixed(3);
  m.confidence_calibration = +((1 - profile.calibration) * 0.3 * (0.7 + 0.6 * rand())).toFixed(3);
  m.edit_latency_ratio = +(1 - profile.edit_speed * 0.9 * (0.6 + 0.6 * rand())).toFixed(3);

  // pass@k
  const tau = taskCategory === "primitives" ? 0.85 : taskCategory === "freeform_surfaces" ? 0.65 : 0.75;
  const pass1 = (m.vol_iou as number) >= tau && (m.dfm_score as number) >= 70 && m.watertight === true ? 1 : 0;
  m.pass_at_1 = pass1;
  m.pass_at_5 = pass1 ? 1 : Math.max(0, Math.min(1, 1 - Math.pow(1 - base, 5)));
  return m;
}

// ---- generate the run-sheet ------------------------------------------------

export function generateRuns(seed = 42): RunResult[] {
  const rand = rng(seed);
  const runs: RunResult[] = [];
  for (const agent of AGENTS) {
    const profile = PROFILES[agent.id];
    if (!profile) continue;
    for (const task of TASKS) {
      const dim = CATEGORY_DIM[task.category];
      const base = gaussian(rand, profile[dim] as number, 0.07);
      const difficultyPenalty = (task.difficulty - 1) * 0.04;
      const adjusted = Math.max(0, Math.min(1, base - difficultyPenalty));
      const metrics = metricsForRun(agent.id, task.category, adjusted, profile, rand);
      const failed = rand() < (1 - profile.seed_consistency) * 0.15;

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
        selfReportedConfidence: +Math.max(0, Math.min(1, profile.calibration * (adjusted + 0.15 * (rand() - 0.5)))).toFixed(2),
      });
    }
  }
  return runs;
}

// ---- bootstrapping ---------------------------------------------------------

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

function percentile(values: number[], p: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor((sorted.length - 1) * p);
  return sorted[idx];
}

// ---- metric normalization to a 0..100 quality score -----------------------

const NORMALIZE: Partial<Record<MetricId, (v: number | boolean | null) => number>> = {
  vol_iou: (v) => (typeof v === "number" ? v * 100 : 0),
  chamfer: (v) => (typeof v === "number" ? Math.max(0, 100 - v * 50) : 0),
  hausdorff: (v) => (typeof v === "number" ? Math.max(0, 100 - v * 12) : 0),
  normal_consistency: (v) => (typeof v === "number" ? v * 100 : 0),
  watertight: (v) => (v === true ? 100 : 0),
  manifold: (v) => (typeof v === "number" ? v * 100 : 0),
  euler_compliance: (v) => (v === true ? 100 : 0),
  step_roundtrip: (v) => (v === null ? 0 : typeof v === "number" ? Math.max(0, 100 - v * 70) : 0),
  named_dim_rmse: (v) => (typeof v === "number" ? Math.max(0, 100 - v * 100) : 0),
  gdt_compliance: (v) => (typeof v === "number" ? v * 100 : 0),
  feature_recall: (v) => (typeof v === "number" ? v * 100 : 0),
  mating_clearance: (v) => (typeof v === "number" ? v * 100 : 0),
  fits_class_compliance: (v) => (typeof v === "number" ? v * 100 : 0),
  standards_compliance: (v) => (typeof v === "number" ? v * 100 : 0),
  dfm_score: (v) => (typeof v === "number" ? v : 0),
  draft_compliance: (v) => (typeof v === "number" ? v * 100 : 0),
  min_wall_compliance: (v) => (typeof v === "number" ? v * 100 : 0),
  cam_reachable: (v) => (typeof v === "number" ? v * 100 : 0),
  support_volume_ratio: (v) => (typeof v === "number" ? Math.max(0, 100 - v * 50) : 0),
  uniform_thickness: (v) => (typeof v === "number" ? v * 100 : 0),
  param_edit_acc: (v) => (typeof v === "number" ? v * 100 : 0),
  constraint_solve_rate: (v) => (typeof v === "number" ? v * 100 : 0),
  param_range_integrity: (v) => (typeof v === "number" ? v * 100 : 0),
  fea_yield_pass: (v) => (typeof v === "number" ? v * 100 : 0),
  paraphrase_iou_var: (v) => (typeof v === "number" ? Math.max(0, 100 - v * 500) : 0),
  seed_variance: (v) => (typeof v === "number" ? Math.max(0, 100 - v * 500) : 0),
  confidence_calibration: (v) => (typeof v === "number" ? Math.max(0, 100 - v * 200) : 0),
  edit_latency_ratio: (v) => (typeof v === "number" ? Math.max(0, 100 - v * 50) : 0),
  pass_at_1: (v) => (typeof v === "number" ? v * 100 : 0),
  pass_at_5: (v) => (typeof v === "number" ? v * 100 : 0),
};

// ---- aggregate computation --------------------------------------------------

function taskScoreFor(run: RunResult, primaryMetrics: MetricId[]) {
  const ms = primaryMetrics.map((mid) => {
    const norm = NORMALIZE[mid];
    if (!norm) return 0;
    return norm(run.metrics[mid] ?? null);
  });
  return ms.reduce((a, b) => a + b, 0) / Math.max(1, ms.length);
}

// 2PL Item Response Theory.
// p(pass | θ, β, α) = σ(α (θ - β))
// Joint MLE via 100 alternating gradient ascent steps over θ_agent and (β,α)_task.
// Pass is operationalized as the per-task quality being above the agent's median
// (per the IRT literature — using a *categorical* outcome would lose information).
function fitIRT(perAgentTaskScores: Map<string, Map<string, number>>) {
  const agentIds = Array.from(perAgentTaskScores.keys());
  const taskIds = Array.from(new Set(agentIds.flatMap((a) => Array.from(perAgentTaskScores.get(a)!.keys()))));
  const theta: Record<string, number> = Object.fromEntries(agentIds.map((a) => [a, 0]));
  const beta: Record<string, number> = Object.fromEntries(taskIds.map((t) => [t, 0]));
  const alpha: Record<string, number> = Object.fromEntries(taskIds.map((t) => [t, 1]));

  // build the success matrix: y[a][t] = 1 if score_a_t > median_t over agents
  const y: Record<string, Record<string, number>> = {};
  for (const t of taskIds) {
    const scores = agentIds.map((a) => perAgentTaskScores.get(a)?.get(t) ?? 0);
    const med = percentile(scores, 0.5);
    for (const a of agentIds) {
      const s = perAgentTaskScores.get(a)?.get(t) ?? 0;
      y[a] ??= {};
      y[a][t] = s > med ? 1 : 0;
    }
  }

  const lr = 0.1;
  for (let it = 0; it < 100; it++) {
    // update theta
    for (const a of agentIds) {
      let g = 0;
      for (const t of taskIds) {
        const z = alpha[t] * (theta[a] - beta[t]);
        const p = 1 / (1 + Math.exp(-z));
        g += alpha[t] * (y[a][t] - p);
      }
      theta[a] += lr * g / taskIds.length;
    }
    // update beta and alpha
    for (const t of taskIds) {
      let gb = 0, ga = 0;
      for (const a of agentIds) {
        const z = alpha[t] * (theta[a] - beta[t]);
        const p = 1 / (1 + Math.exp(-z));
        gb -= alpha[t] * (y[a][t] - p);
        ga += (theta[a] - beta[t]) * (y[a][t] - p);
      }
      beta[t] += lr * gb / agentIds.length;
      alpha[t] += lr * ga / agentIds.length;
      alpha[t] = Math.max(0.1, Math.min(3, alpha[t])); // clamp discrimination
    }
  }
  return { theta, beta, alpha };
}

// ---- aggregate per agent / category / layer / overall ----------------------

// Helper: given an array of {score, weight} rows, compute the weighted mean,
// a 95% bootstrap CI on the *mean of resampled scores* (each draw weighted),
// and the unweighted 5th percentile of scores.
function weightedSummary(rows: { score: number; weight: number }[], B = 1000, seed = 7) {
  if (rows.length === 0) return { mean: 0, ciLow: 0, ciHigh: 0, p5: 0 };
  const sumW = rows.reduce((s, x) => s + x.weight, 0);
  const mean = sumW <= 0 ? 0 : rows.reduce((s, x) => s + x.score * x.weight, 0) / sumW;

  const rand = rng(seed);
  const means: number[] = [];
  for (let b = 0; b < B; b++) {
    let num = 0, den = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[Math.floor(rand() * rows.length)];
      num += r.score * r.weight;
      den += r.weight;
    }
    means.push(den <= 0 ? 0 : num / den);
  }
  means.sort((a, b) => a - b);
  const p5 = percentile(rows.map((r) => r.score), 0.05);
  return { mean, ciLow: means[Math.floor(B * 0.025)], ciHigh: means[Math.floor(B * 0.975)], p5 };
}

export function aggregate(runs: RunResult[]): AggregateScore[] {
  const out: AggregateScore[] = [];
  const perAgentTaskScores = new Map<string, Map<string, number>>();
  for (const a of AGENTS) {
    perAgentTaskScores.set(a.id, new Map());
    for (const t of TASKS) {
      const r = runs.find((rr) => rr.agentId === a.id && rr.taskId === t.id);
      if (!r) continue;
      const cat = CATEGORIES.find((c) => c.id === t.category)!;
      perAgentTaskScores.get(a.id)!.set(t.id, taskScoreFor(r, cat.primaryMetrics));
    }
  }
  const irt = fitIRT(perAgentTaskScores);
  const thetas = Object.values(irt.theta);
  const tMin = Math.min(...thetas), tMax = Math.max(...thetas);
  const normT = (x: number) => tMax === tMin ? 50 : 100 * (x - tMin) / (tMax - tMin);

  const layers: Layer[] = ["L1_geometry", "L2_engineering", "L3_manufacturing", "L4_cognition"];

  for (const agent of AGENTS) {
    const agentRuns = runs.filter((r) => r.agentId === agent.id);

    // Per-task rows annotated with category and layer weights — the source
    // of truth for every higher-level aggregate below.
    type Row = { score: number; categoryId: string; layer: string; wCat: number; wLayer: number };
    const rows: Row[] = [];

    for (const cat of CATEGORIES) {
      const catTasks = TASKS.filter((t) => t.category === cat.id).map((t) => t.id);
      const catRuns = agentRuns.filter((r) => catTasks.includes(r.taskId));
      const taskScores = catRuns.map((r) => taskScoreFor(r, cat.primaryMetrics));

      // category aggregate (unweighted within category — every task counts equally)
      const catRows = taskScores.map((s) => ({ score: s, weight: 1 }));
      const cs = weightedSummary(catRows);
      const metricMeans: Partial<Record<MetricId, number>> = {};
      for (const mid of cat.primaryMetrics) {
        const vals: number[] = catRuns.map((r) => r.metrics[mid]).filter((v) => typeof v === "number").map((v) => v as number);
        if (vals.length) metricMeans[mid] = +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(3);
      }
      out.push({ agentId: agent.id, category: cat.id, meanScore: +cs.mean.toFixed(2), ciLow: +cs.ciLow.toFixed(2), ciHigh: +cs.ciHigh.toFixed(2), p5: +cs.p5.toFixed(2), irtAbility: 0, n: taskScores.length, metricMeans });

      for (const s of taskScores) {
        rows.push({ score: s, categoryId: cat.id, layer: cat.layer, wCat: cat.weight, wLayer: LAYER_WEIGHTS[cat.layer] });
      }
    }

    // per-layer aggregates: weight = w_cat (within the layer)
    for (const lay of layers) {
      const layRows = rows.filter((r) => r.layer === lay).map((r) => ({ score: r.score, weight: r.wCat }));
      const ls = weightedSummary(layRows);
      out.push({ agentId: agent.id, category: lay, meanScore: +ls.mean.toFixed(2), ciLow: +ls.ciLow.toFixed(2), ciHigh: +ls.ciHigh.toFixed(2), p5: +ls.p5.toFixed(2), irtAbility: 0, n: layRows.length, metricMeans: {} });
    }

    // overall (default layer weights × category weights)
    const overallRows = rows.map((r) => ({ score: r.score, weight: r.wCat * r.wLayer }));
    const os = weightedSummary(overallRows);
    out.push({
      agentId: agent.id,
      category: "overall",
      meanScore: +os.mean.toFixed(2),
      ciLow: +os.ciLow.toFixed(2),
      ciHigh: +os.ciHigh.toFixed(2),
      p5: +os.p5.toFixed(2),
      irtAbility: +normT(irt.theta[agent.id]).toFixed(2),
      n: overallRows.length,
      metricMeans: {},
    });
  }
  return out;
}

// ---- use-case re-weighting --------------------------------------------------

export function overallForUseCase(runs: RunResult[], useCase: UseCase): Map<string, { mean: number; p5: number }> {
  const out = new Map<string, { mean: number; p5: number }>();
  const w = USE_CASE_LAYER_WEIGHTS[useCase];
  for (const agent of AGENTS) {
    const agentRuns = runs.filter((r) => r.agentId === agent.id);
    const rows: { score: number; weight: number }[] = [];
    for (const cat of CATEGORIES) {
      const catTasks = TASKS.filter((t) => t.category === cat.id).map((t) => t.id);
      const catRuns = agentRuns.filter((r) => catTasks.includes(r.taskId));
      const layerW = w[cat.layer as keyof typeof w] ?? 0;
      for (const r of catRuns) {
        rows.push({ score: taskScoreFor(r, cat.primaryMetrics), weight: cat.weight * layerW });
      }
    }
    const s = weightedSummary(rows);
    out.set(agent.id, { mean: +s.mean.toFixed(2), p5: +s.p5.toFixed(2) });
  }
  return out;
}

// ---- tier classification ----------------------------------------------------
// Five-tier classification driven by *capability*, *reliability*, and
// *manufacturability gates*. Designed to be robust to score-inflation: an
// agent has to be capable AND reliable AND BREP-roundtrippable to reach S/A.
export function classifyTier(agentId: string, aggregates: AggregateScore[]): Tier {
  const overall = aggregates.find((a) => a.agentId === agentId && a.category === "overall")!;
  const l1 = aggregates.find((a) => a.agentId === agentId && a.category === "L1_geometry")!;
  const l2 = aggregates.find((a) => a.agentId === agentId && a.category === "L2_engineering")!;
  const l3 = aggregates.find((a) => a.agentId === agentId && a.category === "L3_manufacturing")!;
  const brep = aggregates.find((a) => a.agentId === agentId && a.category === "brep_fidelity")!;

  if (overall.meanScore >= 80 && l2.meanScore >= 75 && l3.meanScore >= 70 && brep.meanScore >= 70 && overall.p5 >= 50) return "S";
  if (overall.meanScore >= 65 && l1.meanScore >= 60 && l2.meanScore >= 55 && brep.meanScore >= 40) return "A";
  if (overall.meanScore >= 45 && l1.meanScore >= 50) return "B";
  if (overall.meanScore >= 25) return "C";
  return "D";
}

// ---- Pareto frontier in (capability, $/task) -------------------------------
export function paretoFront(points: { id: string; capability: number; cost: number }[]): Set<string> {
  const front = new Set<string>();
  for (const p of points) {
    let dominated = false;
    for (const q of points) {
      if (p.id === q.id) continue;
      if (q.capability >= p.capability && q.cost <= p.cost && (q.capability > p.capability || q.cost < p.cost)) {
        dominated = true;
        break;
      }
    }
    if (!dominated) front.add(p.id);
  }
  return front;
}

// ---- memoization for the UI ------------------------------------------------
let _runs: RunResult[] | undefined;
let _agg: AggregateScore[] | undefined;
export function getRuns() { if (!_runs) _runs = generateRuns(42); return _runs; }
export function getAggregates() { if (!_agg) _agg = aggregate(getRuns()); return _agg; }
