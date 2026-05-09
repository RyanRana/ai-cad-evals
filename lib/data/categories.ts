import type { Category } from "../types";

// 4-layer category hierarchy. Weights sum to 1.0 within each layer; the
// default composite is a weighted mean over (layer_weight × category_weight).
//
// Weights are calibrated against a prior of "what an experienced production
// mechanical engineer judges to be load-bearing" — so engineering correctness
// (L2) and manufacturability (L3) dominate the noise-floor (L1) and the
// open-ended cognition layer (L4). The use-case views on the leaderboard
// re-weight these on the fly.
export const LAYER_WEIGHTS: Record<string, number> = {
  L1_geometry: 0.20,
  L2_engineering: 0.35,
  L3_manufacturing: 0.25,
  L4_cognition: 0.20,
};

export const CATEGORIES: Category[] = [
  // ============== L1 GEOMETRY ==============
  {
    id: "primitives",
    layer: "L1_geometry",
    name: "Geometric Primitives",
    description:
      "Closed-form parametric primitives (boxes, cylinders, cones, tori, regular prisms) at exactly specified dimensions. Establishes a noise floor: agents that fail here cannot be trusted on harder tasks.",
    weight: 0.10,
    primaryMetrics: ["vol_iou", "chamfer", "watertight", "manifold"],
    taskCount: 24,
    judgingModality: "geometric",
  },
  {
    id: "boolean_robustness",
    layer: "L1_geometry",
    name: "Boolean Robustness",
    description:
      "Edge-case CSG operations: tangent fillets, coplanar faces, near-degenerate intersections, high-genus subtractions. Stresses kernel ε-tolerance handling. Patterned after the OpenCascade and ACIS robustness suites.",
    weight: 0.20,
    primaryMetrics: ["vol_iou", "manifold", "euler_compliance", "watertight"],
    taskCount: 18,
    judgingModality: "geometric",
  },
  {
    id: "brep_fidelity",
    layer: "L1_geometry",
    name: "BREP Fidelity",
    description:
      "Tests whether the agent emits a clean boundary representation (named faces, coherent edge graph, exact NURBS surfaces) versus a tessellated approximation. Round-trips through AP242 STEP.",
    weight: 0.40,
    primaryMetrics: ["step_roundtrip", "manifold", "euler_compliance", "feature_recall"],
    taskCount: 14,
    judgingModality: "geometric",
  },
  {
    id: "freeform_surfaces",
    layer: "L1_geometry",
    name: "Free-form Surfaces",
    description:
      "Class-A surfaces (G2 continuity, lofted, swept) such as turbine blades and ergonomic handles. Scored against high-density (200 k vertex) ground-truth meshes.",
    weight: 0.30,
    primaryMetrics: ["chamfer", "hausdorff", "normal_consistency"],
    taskCount: 12,
    judgingModality: "geometric",
  },

  // ============== L2 ENGINEERING ==============
  {
    id: "parametric_mech",
    layer: "L2_engineering",
    name: "Parametric Mechanical Parts",
    description:
      "Industry-grade brackets, fasteners, housings, and shafts specified with full GD&T (ISO 1101) including position, parallelism, and concentricity callouts. Volumes range 0.5 cm³ – 1.2 dm³.",
    weight: 0.25,
    primaryMetrics: ["named_dim_rmse", "gdt_compliance", "feature_recall"],
    taskCount: 30,
    judgingModality: "named-dim+GD&T",
  },
  {
    id: "assembly_mating",
    layer: "L2_engineering",
    name: "Assembly & Mating",
    description:
      "Two- and three-body assemblies with pin-in-hole, dovetail, and threaded mate constraints. Scoring requires the candidate to mate the held-out reference partner within the prescribed clearance band.",
    weight: 0.22,
    primaryMetrics: ["mating_clearance", "fits_class_compliance", "feature_recall"],
    taskCount: 16,
    judgingModality: "named-dim+GD&T",
  },
  {
    id: "standards_compliance",
    layer: "L2_engineering",
    name: "Standards Compliance",
    description:
      "Prompts cite a specific standard (ISO 4762 socket-head cap screw, DIN 471 retaining ring, AS568 O-ring, ANSI B5.50 dovetail). Score = fraction of standard-derived feature parameters matched within the standard's tolerance band.",
    weight: 0.15,
    primaryMetrics: ["standards_compliance", "gdt_compliance"],
    taskCount: 18,
    judgingModality: "named-dim+GD&T",
  },
  {
    id: "sheet_metal",
    layer: "L2_engineering",
    name: "Sheet-Metal Bodies",
    description:
      "Uniform-thickness bodies with bend specifications, k-factors, relief cuts, and unfoldable flat patterns. Tested by attempting to unfold the result and measuring the unfold error vs the spec'd flat pattern.",
    weight: 0.13,
    primaryMetrics: ["uniform_thickness", "named_dim_rmse", "feature_recall"],
    taskCount: 14,
    judgingModality: "process-analyzer",
  },
  {
    id: "sealing_grooves",
    layer: "L2_engineering",
    name: "Sealing-Groove Design",
    description:
      "O-ring grooves (AS568 / ISO 3601), face seals, and lip-seal cavities. Score depends on cross-section area, groove width, and squeeze ratio matching the relevant standard.",
    weight: 0.10,
    primaryMetrics: ["standards_compliance", "named_dim_rmse"],
    taskCount: 10,
    judgingModality: "named-dim+GD&T",
  },
  {
    id: "kinematic_mechanisms",
    layer: "L2_engineering",
    name: "Kinematic Mechanisms",
    description:
      "Four-bar linkages, cams (radial/face), gear meshes (involute, ISO 53). Scored by simulating one full kinematic cycle and measuring (a) feasibility — no body interpenetration — and (b) prescribed motion error.",
    weight: 0.15,
    primaryMetrics: ["mating_clearance", "feature_recall", "param_edit_acc"],
    taskCount: 12,
    judgingModality: "process-analyzer",
  },

  // ============== L3 MANUFACTURING ==============
  {
    id: "dfm_cnc",
    layer: "L3_manufacturing",
    name: "DFM · 3-Axis CNC",
    description:
      "Manufacturable on a 3-axis VMC with a Ø6 → Ø3 → Ø1 tool stack. Score gates on tool reachability (no closed pockets, no internal corners <tool radius), fixturable orientation, and workholding access.",
    weight: 0.30,
    primaryMetrics: ["cam_reachable", "min_wall_compliance", "dfm_score"],
    taskCount: 18,
    judgingModality: "process-analyzer",
  },
  {
    id: "dfm_mold",
    layer: "L3_manufacturing",
    name: "DFM · Injection Mould",
    description:
      "Two-plate mould tooling: parting plane, ≥1° draft on every vertical face, no closed voids, uniform wall thickness ±10 %, gate/runner accessibility. Tested by an automatic draft + thickness analyzer plus parting-line extraction.",
    weight: 0.30,
    primaryMetrics: ["draft_compliance", "uniform_thickness", "min_wall_compliance"],
    taskCount: 20,
    judgingModality: "process-analyzer",
  },
  {
    id: "dfm_fdm",
    layer: "L3_manufacturing",
    name: "DFM · FDM 3D Print",
    description:
      "FDM-printable on a 0.4 mm nozzle: overhangs ≤45° from build plate, ≥0.8 mm walls, no enclosed cavities, optimal orientation auto-selected by the analyzer.",
    weight: 0.20,
    primaryMetrics: ["support_volume_ratio", "min_wall_compliance", "dfm_score"],
    taskCount: 14,
    judgingModality: "process-analyzer",
  },
  {
    id: "cam_validity",
    layer: "L3_manufacturing",
    name: "CAM Toolpath Validity",
    description:
      "Stricter cousin of DFM-CNC: an actual 3-axis CAM postprocessor (FreeCAD-Path) must generate a collision-free G-code program at a ≤0.05 mm finish stepover. Score = fraction of part surface produced.",
    weight: 0.20,
    primaryMetrics: ["cam_reachable", "feature_recall"],
    taskCount: 12,
    judgingModality: "process-analyzer",
  },

  // ============== L4 COGNITION / ROBUSTNESS ==============
  {
    id: "constraint_solving",
    layer: "L4_cognition",
    name: "Constraint Solving & Editability",
    description:
      "Probes whether the agent exposes a working parametric graph: after the part is built we issue downstream parameter edits (length+30 %, hole diameter→M8) and re-evaluate without topological breakage.",
    weight: 0.18,
    primaryMetrics: ["param_edit_acc", "param_range_integrity", "constraint_solve_rate"],
    taskCount: 18,
    judgingModality: "variance-analysis",
  },
  {
    id: "reverse_eng",
    layer: "L4_cognition",
    name: "Reverse Engineering",
    description:
      "Multi-view orthographic drawings (front/top/side at 1:1, fully dimensioned) and product photos. The agent must reproduce the part. Adapted from the ABC dataset and a held-out subset of GrabCAD test parts.",
    weight: 0.20,
    primaryMetrics: ["vol_iou", "feature_recall", "named_dim_rmse"],
    taskCount: 22,
    judgingModality: "named-dim+GD&T",
  },
  {
    id: "sketch_constraints",
    layer: "L4_cognition",
    name: "2-D Sketch Constraints",
    description:
      "Closed planar profiles defined purely by geometric constraints (tangency, equal-length, perpendicular, coincident). Score is fraction of constraints the agent honors after sketch resolution.",
    weight: 0.10,
    primaryMetrics: ["constraint_solve_rate", "chamfer"],
    taskCount: 20,
    judgingModality: "geometric",
  },
  {
    id: "functional_intent",
    layer: "L4_cognition",
    name: "Functional Intent · FEA-Gated",
    description:
      "Prompts specify a *function* (\"hold a 250 N transverse load with a 4× safety factor in 6061-T6\") rather than a geometry. Score requires the agent's part to pass automatic linear-elastic FEA at the spec'd load with stress ≤ 0.8·σ_yield.",
    weight: 0.25,
    primaryMetrics: ["fea_yield_pass", "min_wall_compliance", "feature_recall"],
    taskCount: 16,
    judgingModality: "FEA",
  },
  {
    id: "paraphrase_robustness",
    layer: "L4_cognition",
    name: "Paraphrase Robustness",
    description:
      "Each task ships with N=5 LLM-rephrased prompts that preserve every spec quantity. We compute the std-dev of vol_iou across the paraphrase set; lower = the agent reads intent rather than surface form.",
    weight: 0.15,
    primaryMetrics: ["paraphrase_iou_var", "seed_variance"],
    taskCount: 20,
    judgingModality: "variance-analysis",
  },
  {
    id: "calibration",
    layer: "L4_cognition",
    name: "Confidence Calibration",
    description:
      "For agents that report a pre-generation confidence ∈ [0, 1], we score the Brier loss against the realized Pass@1. Agents that don't expose a confidence channel are assigned the constant prior (their global Pass@1 rate); this becomes their effective baseline.",
    weight: 0.12,
    primaryMetrics: ["confidence_calibration", "pass_at_1"],
    taskCount: 15,
    judgingModality: "rubric+pairwise",
  },
];

export const categoryById = (id: string) => CATEGORIES.find((c) => c.id === id);
export const categoriesByLayer = (layer: string) => CATEGORIES.filter((c) => c.layer === layer);

// Three pre-baked use-case views: each re-weights the layers so the same
// raw run-sheet produces a different leaderboard. Justification on /design.
export const USE_CASE_LAYER_WEIGHTS = {
  production: { L1_geometry: 0.10, L2_engineering: 0.45, L3_manufacturing: 0.35, L4_cognition: 0.10 },
  exploration: { L1_geometry: 0.20, L2_engineering: 0.20, L3_manufacturing: 0.10, L4_cognition: 0.50 },
  hobbyist: { L1_geometry: 0.25, L2_engineering: 0.15, L3_manufacturing: 0.40, L4_cognition: 0.20 },
} as const;
