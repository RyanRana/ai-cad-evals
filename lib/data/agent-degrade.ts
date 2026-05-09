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
