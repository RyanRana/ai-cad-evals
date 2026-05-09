import type { Degrade } from "@/components/CadViewer";

// Visualisation profile per agent, derived from the scoring profile in
// results.ts. The numbers here are visual translations of those scores —
// they are not used for any metric — but they are picked so that what you
// see matches what the leaderboard reports: mesh-only agents look faceted
// and full of holes, near-reference agents look near-reference, and a run
// that flunked the validity gate shows a "no manifold solid produced" tile.

type AgentDegradeBase = Omit<Degrade, "seed"> & { brepFidelity: number };

const AGENT_PRESETS: Record<string, AgentDegradeBase> = {
  // --- native BREP / parametric (high-fidelity) -------------------------
  "zoo-text-to-cad-2.4": {
    brepFidelity: 0.92,
    shading: "smooth",
    nonManifold: 0.005,
    scale: [1.0, 1.0, 1.0],
    color: 0xc6c6c6,
  },
  "adam-cadcrush-1.1": {
    brepFidelity: 0.79,
    shading: "smooth",
    nonManifold: 0.01,
    scale: [1.001, 0.998, 1.0],
    color: 0xc4c4c4,
  },
  "claude-opus-4-7-cadquery": {
    brepFidelity: 0.71,
    shading: "smooth",
    nonManifold: 0.015,
    missingFeatures: 0.03,
    scale: [0.997, 1.003, 0.998],
    color: 0xc2c2c2,
  },
  "gpt-5-cadquery": {
    brepFidelity: 0.66,
    shading: "smooth",
    nonManifold: 0.025,
    missingFeatures: 0.05,
    scale: [0.99, 1.005, 1.0],
    color: 0xbcbcbc,
  },

  // --- LLM → OpenSCAD (mesh-only, CSG-faceted) --------------------------
  "gemini-2-5-pro-openscad": {
    brepFidelity: 0.18,
    shading: "csg",
    nonManifold: 0.04,
    missingFeatures: 0.10,
    scale: [0.985, 1.01, 0.995],
    color: 0xb6b8bd,
  },
  "claude-opus-4-7-openscad": {
    brepFidelity: 0.18,
    shading: "csg",
    nonManifold: 0.035,
    missingFeatures: 0.07,
    scale: [0.99, 1.005, 0.997],
    color: 0xb6b8bd,
  },

  // --- diffusion 3D / image-to-3D (mesh, low BREP) ----------------------
  "deepcad-2024": {
    brepFidelity: 0.74,
    shading: "smooth",
    nonManifold: 0.02,
    missingFeatures: 0.18,
    bboxOnly: false,
    scale: [0.95, 0.97, 0.96],
    color: 0xb0b0b0,
  },
  "trellis-3d-1.0": {
    brepFidelity: 0.04,
    shading: "facets",
    nonManifold: 0.18,
    missingFeatures: 0.25,
    scale: [0.97, 1.02, 0.98],
    color: 0xa8a4a0,
  },
  "spline-ai-2.7": {
    brepFidelity: 0.02,
    shading: "facets",
    nonManifold: 0.30,
    missingFeatures: 0.45,
    bboxOnly: false,
    scale: [0.92, 1.04, 0.95],
    color: 0xa6a6a8,
  },

  // --- v0.6 closed-source variants (LLM + CadQuery, BREP-quality output) ---
  "claude-sonnet-4-6-cadquery": {
    brepFidelity: 0.66,
    shading: "smooth",
    nonManifold: 0.025,
    missingFeatures: 0.06,
    scale: [0.996, 1.003, 0.999],
    color: 0xc0c0c0,
  },
  "claude-haiku-4-5-cadquery": {
    brepFidelity: 0.50,
    shading: "smooth",
    nonManifold: 0.05,
    missingFeatures: 0.12,
    scale: [0.99, 1.005, 0.995],
    color: 0xb8b8b8,
  },
  "o4-cadquery": {
    brepFidelity: 0.74,
    shading: "smooth",
    nonManifold: 0.012,
    missingFeatures: 0.025,
    scale: [0.999, 1.001, 0.999],
    color: 0xc4c4c4,
  },
  "gpt-5-mini-openscad": {
    brepFidelity: 0.16,
    shading: "csg",
    nonManifold: 0.06,
    missingFeatures: 0.18,
    scale: [0.985, 1.012, 0.99],
    color: 0xb2b4b8,
  },
  "gemini-2-5-flash-cadquery": {
    brepFidelity: 0.59,
    shading: "smooth",
    nonManifold: 0.03,
    missingFeatures: 0.08,
    scale: [0.992, 1.006, 0.997],
    color: 0xbcbcbe,
  },

  // --- v0.6 open-weight baselines ---------------------------------------
  "deepseek-r1-cadquery": {
    brepFidelity: 0.61,
    shading: "smooth",
    nonManifold: 0.025,
    missingFeatures: 0.07,
    scale: [0.995, 1.004, 0.998],
    color: 0xb8babb,
  },
  "llama-3-3-70b-openscad": {
    brepFidelity: 0.14,
    shading: "csg",
    nonManifold: 0.07,
    missingFeatures: 0.20,
    scale: [0.98, 1.018, 0.99],
    color: 0xafb1b3,
  },
  "qwen-3-coder-cadquery": {
    brepFidelity: 0.59,
    shading: "smooth",
    nonManifold: 0.03,
    missingFeatures: 0.10,
    scale: [0.992, 1.008, 0.996],
    color: 0xb6b8ba,
  },

  // --- v0.6 diffusion 3D --------------------------------------------------
  "hunyuan3d-2": {
    brepFidelity: 0.05,
    shading: "facets",
    nonManifold: 0.16,
    missingFeatures: 0.22,
    scale: [0.96, 1.03, 0.97],
    color: 0xa6a4a0,
  },

  // --- v0.6 specialty CAD-tuned model -------------------------------------
  "cad-coder-r1": {
    brepFidelity: 0.74,
    shading: "smooth",
    nonManifold: 0.018,
    missingFeatures: 0.05,
    scale: [0.998, 1.001, 0.999],
    color: 0xc2c2c4,
  },

  // --- human baseline ---------------------------------------------------
  "human-mechE": {
    brepFidelity: 0.96,
    shading: "smooth",
    nonManifold: 0,
    scale: [1.0, 1.0, 1.0],
    color: 0xd0d0cc,
  },
};

export function degradeForAgent(agentId: string, taskId: string, failed?: boolean): Degrade {
  const preset = AGENT_PRESETS[agentId];
  const seed = hash(`${agentId}::${taskId}`);
  if (failed || !preset) return { failed: true, seed };
  // Strip the brepFidelity field — it's only used by the score chip helper.
  const { brepFidelity: _bf, ...rest } = preset;
  void _bf;
  return { ...rest, seed };
}

export function brepFidelityForAgent(agentId: string): number | undefined {
  return AGENT_PRESETS[agentId]?.brepFidelity;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
