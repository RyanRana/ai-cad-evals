// Type definitions for the CAD-Bench eval suite.
// These mirror the JSON schemas published in /methodology so external
// labs can reproduce the harness against their own agents.

export type Runtime = "API" | "LLM+OpenSCAD" | "LLM+CadQuery" | "LLM+JSCAD" | "Diffusion-3D" | "Human";

export type License = "proprietary" | "open" | "research";

export interface Agent {
  id: string;
  name: string;
  vendor: string;
  runtime: Runtime;
  representation: "BREP" | "Mesh" | "SDF" | "OpenSCAD" | "CadQuery";
  releaseDate: string; // ISO yyyy-mm-dd
  version: string;
  paramsB?: number; // approx model params for LLM-backed
  contextWindow?: number;
  costPer1kTok?: { input: number; output: number };
  notes: string;
  license: License;
  available: boolean; // whether currently reachable in our harness
}

export type CategoryId =
  | "primitives"
  | "boolean_robustness"
  | "parametric_mech"
  | "assembly_mating"
  | "dfm_compliance"
  | "brep_fidelity"
  | "constraint_solving"
  | "reverse_eng"
  | "sketch_constraints"
  | "freeform_surfaces";

export interface Category {
  id: CategoryId;
  name: string;
  description: string;
  weight: number; // contribution to composite CAD-Bench score (sum=1.0)
  primaryMetrics: MetricId[];
  taskCount: number;
}

export type MetricId =
  | "vol_iou"
  | "chamfer"
  | "hausdorff"
  | "normal_consistency"
  | "watertight"
  | "manifold"
  | "euler_compliance"
  | "step_roundtrip"
  | "dfm_score"
  | "param_edit_acc"
  | "constraint_solve_rate"
  | "mating_clearance"
  | "feature_recall"
  | "pass_at_1"
  | "pass_at_5"
  | "latency_p50"
  | "latency_p95"
  | "cost_per_task";

export interface MetricDef {
  id: MetricId;
  name: string;
  unit: string;
  higherIsBetter: boolean;
  formula: string; // human-readable formal definition
  reference?: string; // citation
}

export interface Task {
  id: string;
  category: CategoryId;
  title: string;
  prompt: string; // verbatim prompt sent to agent
  spec: TaskSpec;
  difficulty: 1 | 2 | 3 | 4 | 5;
  groundTruthHash: string; // sha256 of canonical reference STEP
  referenceMesh?: string; // /public path
  notes?: string;
}

export interface TaskSpec {
  // numerical ground-truth quantities used in scoring
  volumeMm3?: number;
  surfaceAreaMm2?: number;
  centerOfMassMm?: [number, number, number];
  boundingBoxMm?: [number, number, number];
  shellCount?: number;
  euler?: number; // V - E + F
  genus?: number;
  watertight?: boolean;
  manifold?: boolean;
  features?: string[]; // expected named features (e.g. "M6_thru_hole","fillet_R2")
  toleranceMm?: number; // acceptance tolerance for geometric metrics
  // parametric edits used in constraint-solving tasks
  edits?: { param: string; from: number; to: number; expectedDeltaVolMm3: number }[];
  // mating constraints used in assembly tasks
  matingPart?: string; // /public path
  expectedClearanceMm?: { min: number; max: number };
}

export interface RunResult {
  agentId: string;
  taskId: string;
  seed: number;
  timestamp: string;
  // per-metric scores (only those applicable to the category appear)
  metrics: Partial<Record<MetricId, number | boolean | null>>;
  outputArtifact?: string; // /public path to STL/STEP
  outputFormat?: "STL" | "STEP" | "GLB" | "OpenSCAD" | "CadQuery";
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
  latencyMs: number;
  error?: string; // populated when run failed (counts as 0 score)
  judgedBy?: "automatic" | "human-mechE";
}

export interface AggregateScore {
  agentId: string;
  category: CategoryId | "overall";
  // bootstrapped 95% CI on the composite score
  meanScore: number; // 0..100 normalized
  ciLow: number;
  ciHigh: number;
  n: number;
  metricMeans: Partial<Record<MetricId, number>>;
}
