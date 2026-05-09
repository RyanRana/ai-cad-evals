import type { Category } from "../types";

export const CATEGORIES: Category[] = [
  {
    id: "primitives",
    name: "Geometric Primitives",
    description:
      "Closed-form parametric primitives (boxes, cylinders, cones, tori, spheres, regular prisms) at exactly specified dimensions. Establishes a noise-floor: agents that fail here cannot be trusted on harder tasks.",
    weight: 0.05,
    primaryMetrics: ["vol_iou", "chamfer", "watertight", "manifold"],
    taskCount: 24,
  },
  {
    id: "boolean_robustness",
    name: "Boolean Robustness",
    description:
      "Edge-case CSG operations: tangent-touching fillets, coplanar faces, near-degenerate intersections, and high-genus subtractions designed to stress kernel robustness. Patterned after the OpenCascade and ACIS robustness suites.",
    weight: 0.10,
    primaryMetrics: ["vol_iou", "manifold", "euler_compliance", "watertight"],
    taskCount: 18,
  },
  {
    id: "parametric_mech",
    name: "Parametric Mechanical Parts",
    description:
      "Industry-grade brackets, fasteners, housings, and shafts specified with full GD&T (ISO 1101) including position, parallelism, and concentricity callouts. Volumes range 0.5 cm³ – 1.2 dm³.",
    weight: 0.18,
    primaryMetrics: ["vol_iou", "feature_recall", "dfm_score", "step_roundtrip"],
    taskCount: 30,
  },
  {
    id: "assembly_mating",
    name: "Assembly & Mating",
    description:
      "Two- and three-body assemblies with pin-in-hole, dovetail, and threaded-mate constraints. Scoring requires the candidate part to mate the held-out reference partner within the prescribed clearance band.",
    weight: 0.15,
    primaryMetrics: ["mating_clearance", "vol_iou", "feature_recall"],
    taskCount: 16,
  },
  {
    id: "dfm_compliance",
    name: "DFM Compliance",
    description:
      "Parts must satisfy explicit manufacturing constraints: 3-axis CNC reachability, ≥1° draft for cast/molded variants, ≥0.8 mm walls for SLS, no closed voids, no overhangs >45° for FDM.",
    weight: 0.12,
    primaryMetrics: ["dfm_score", "vol_iou", "feature_recall"],
    taskCount: 20,
  },
  {
    id: "brep_fidelity",
    name: "BREP Fidelity",
    description:
      "Tests whether the agent emits a clean boundary representation (named faces, coherent edge graph, exact NURBS surfaces) versus a tessellated approximation. Round-trips through AP242 STEP.",
    weight: 0.10,
    primaryMetrics: ["step_roundtrip", "manifold", "euler_compliance", "feature_recall"],
    taskCount: 14,
  },
  {
    id: "constraint_solving",
    name: "Constraint Solving & Editability",
    description:
      "Probes whether the model exposes a working parametric graph: after the part is built we issue downstream parameter edits (length+30 %, hole diameter→M8) and re-evaluate without topological breakage.",
    weight: 0.10,
    primaryMetrics: ["param_edit_acc", "constraint_solve_rate", "vol_iou"],
    taskCount: 18,
  },
  {
    id: "reverse_eng",
    name: "Reverse Engineering from Drawing",
    description:
      "Multi-view orthographic drawings (front/top/side at 1:1, fully dimensioned) are presented as images. The agent must reproduce the part. Adapted from the ABC dataset and a held-out subset of GrabCAD test parts.",
    weight: 0.10,
    primaryMetrics: ["vol_iou", "feature_recall", "chamfer"],
    taskCount: 22,
  },
  {
    id: "sketch_constraints",
    name: "2-D Sketch Constraints",
    description:
      "Closed planar profiles defined purely by geometric constraints (tangency, equal-length, perpendicular, coincident). Score is fraction of constraints the agent honors after sketch resolution.",
    weight: 0.05,
    primaryMetrics: ["constraint_solve_rate", "chamfer"],
    taskCount: 20,
  },
  {
    id: "freeform_surfaces",
    name: "Free-form Surfacing",
    description:
      "Class-A surfaces (G2 continuity, lofted, swept) such as turbine blades and ergonomic handles. Scored against high-density (200 k vertex) ground-truth meshes.",
    weight: 0.05,
    primaryMetrics: ["chamfer", "hausdorff", "normal_consistency"],
    taskCount: 12,
  },
];

export const categoryById = (id: string) => CATEGORIES.find((c) => c.id === id);
