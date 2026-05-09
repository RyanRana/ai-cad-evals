// Type definitions for the CAD-Bench eval suite.
// These mirror the JSON schemas published in /methodology so external
// labs can reproduce the harness against their own agents.

export type Runtime = "API" | "LLM+OpenSCAD" | "LLM+CadQuery" | "LLM+JSCAD" | "Diffusion-3D" | "Human";

export type License = "proprietary" | "open" | "research";

// Four-layer category hierarchy. See /design for the rationale: each layer
// maps to a different correct judging modality, and reporting them
// separately is a load-bearing design decision.
export type Layer =
  | "L1_geometry"        // automatic geometric metrics
  | "L2_engineering"     // named-dim, GD&T, mating sim
  | "L3_manufacturing"   // CAM/DFM analyzers, process-specific
  | "L4_cognition";      // paraphrase, edit, FEA-pass, calibration

export interface Agent {
  id: string;
  name: string;
  vendor: string;
  runtime: Runtime;
  representation: "BREP" | "Mesh" | "SDF" | "OpenSCAD" | "CadQuery";
  releaseDate: string;
  version: string;
  paramsB?: number;
  contextWindow?: number;
  costPer1kTok?: { input: number; output: number };
  notes: string;
  license: License;
  available: boolean;
}

export type CategoryId =
  | "primitives"
  | "boolean_robustness"
  | "brep_fidelity"
  | "freeform_surfaces"
  | "parametric_mech"
  | "assembly_mating"
  | "standards_compliance"
  | "sheet_metal"
  | "sealing_grooves"
  | "kinematic_mechanisms"
  | "dfm_cnc"
  | "dfm_mold"
  | "dfm_fdm"
  | "cam_validity"
  | "constraint_solving"
  | "reverse_eng"
  | "sketch_constraints"
  | "functional_intent"
  | "paraphrase_robustness"
  | "calibration";

export interface Category {
  id: CategoryId;
  name: string;
  layer: Layer;
  description: string;
  weight: number; // contribution to the default composite (sums to 1.0)
  primaryMetrics: MetricId[];
  taskCount: number;
  judgingModality: "geometric" | "named-dim+GD&T" | "process-analyzer" | "FEA" | "rubric+pairwise" | "variance-analysis";
}

export type MetricId =
  // L1
  | "vol_iou" | "chamfer" | "hausdorff" | "normal_consistency"
  | "watertight" | "manifold" | "euler_compliance" | "step_roundtrip"
  // L2
  | "named_dim_rmse" | "gdt_compliance" | "feature_recall"
  | "mating_clearance" | "fits_class_compliance" | "standards_compliance"
  // L3
  | "dfm_score" | "draft_compliance" | "min_wall_compliance"
  | "cam_reachable" | "support_volume_ratio" | "uniform_thickness"
  // L4
  | "param_edit_acc" | "constraint_solve_rate" | "param_range_integrity"
  | "fea_yield_pass" | "paraphrase_iou_var" | "seed_variance"
  | "confidence_calibration" | "edit_latency_ratio"
  // throughput / pass-rate
  | "pass_at_1" | "pass_at_5" | "latency_p50" | "latency_p95" | "cost_per_task";

export interface MetricDef {
  id: MetricId;
  layer: Layer;
  name: string;
  unit: string;
  higherIsBetter: boolean;
  formula: string;
  reference?: string;
}

export interface Task {
  id: string;
  category: CategoryId;
  title: string;
  prompt: string;
  spec: TaskSpec;
  difficulty: 1 | 2 | 3 | 4 | 5;
  groundTruthHash: string;
  referenceMesh?: string;
  notes?: string;
  // v0.6 additions:
  humanBaselineMin?: number;   // wall-clock minutes for a senior mech-E, n=4 panel.
  tags?: string[];             // domain tags: "aerospace", "automotive", "consumer",
                               // "machining-heavy", "thin-wall", "high-precision",
                               // "open-source-corpus", etc.
  sourceCorpus?: "synthetic" | "grabcad-curated" | "abc-dataset"
               | "fusion360-gallery" | "ifc-bim" | "drawn-by-panel";
}

export interface TaskSpec {
  volumeMm3?: number;
  surfaceAreaMm2?: number;
  centerOfMassMm?: [number, number, number];
  boundingBoxMm?: [number, number, number];
  shellCount?: number;
  euler?: number;
  genus?: number;
  watertight?: boolean;
  manifold?: boolean;
  features?: string[];
  toleranceMm?: number;
  edits?: { param: string; from: number; to: number; expectedDeltaVolMm3: number }[];
  matingPart?: string;
  expectedClearanceMm?: { min: number; max: number };
  // L2 extensions
  namedDimensions?: { name: string; nominalMm: number; toleranceMm: number }[];
  gdtCallouts?: { type: "position" | "parallel" | "perp" | "concentric" | "runout" | "flatness"; datum: string; toleranceMm: number }[];
  fitClass?: "H7/g6" | "H7/h6" | "H8/f7" | "H7/k6" | "H7/p6";
  standardRef?: string; // ISO 4762, DIN 471, AS568, ANSI B5.50…
  // L3 extensions
  process?: "cnc-3ax" | "cnc-5ax" | "turning" | "sheet-metal" | "injection" | "fdm" | "sla" | "sls" | "dmls" | "investment-cast";
  draftMinDeg?: number;
  minWallMm?: number;
  uniformThicknessMm?: number;
  // L4 extensions
  faeLoadN?: number; // applied load for FEA-gated functional tasks
  feaMaxStressMpa?: number; // material yield gate
  feaMaterial?: string;
  paramRange?: { name: string; min: number; max: number; samples: number }[];
  paraphrases?: string[]; // alternate phrasings for paraphrase-robustness eval
}

export interface RunResult {
  agentId: string;
  taskId: string;
  seed: number;
  timestamp: string;
  metrics: Partial<Record<MetricId, number | boolean | null>>;
  outputArtifact?: string;
  outputFormat?: "STL" | "STEP" | "GLB" | "OpenSCAD" | "CadQuery";
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
  latencyMs: number;
  error?: string;
  judgedBy?: "automatic" | "human-mechE" | "rubric-llm" | "fea-solver" | "cam-post";
  selfReportedConfidence?: number; // 0..1, used in calibration metric
}

export interface AggregateScore {
  agentId: string;
  category: CategoryId | "overall" | Layer;
  meanScore: number;       // 0..100 weighted mean
  ciLow: number;
  ciHigh: number;
  p5: number;              // worst-case (5th percentile across tasks)
  irtAbility: number;      // 2PL θ on logit scale, normalized to 0..100
  n: number;
  metricMeans: Partial<Record<MetricId, number>>;
}

export type UseCase = "production" | "exploration" | "hobbyist";

export type Tier = "S" | "A" | "B" | "C" | "D";
