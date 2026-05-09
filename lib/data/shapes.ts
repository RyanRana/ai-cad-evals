import type { ShapeDesc } from "@/components/CadViewer";

// Procedural ground-truth shapes used by the in-browser CAD viewer.
// Keyed by Task.id. Visualisation-only; the canonical reference STEP files
// live alongside /public/refs and are what the harness actually scores
// against. Where a task has no convenient parametric description (e.g.
// reverse-engineering from a drawing) we omit it and the page falls back
// to the static reference image.
export const TASK_SHAPES: Record<string, ShapeDesc> = {
  "PRIM-001": { type: "hollow_cylinder", outerR: 30, innerR: 20, height: 100 },
  "PRIM-007": { type: "hex_prism", acrossFlats: 24, height: 12, filletR: 0.4 },

  "BOOL-003": {
    type: "csg_union",
    a: { type: "box", size: [20, 20, 20] },
    b: { type: "box", size: [20, 20, 20] },
    offsetA: [-10, 10, 0],
    offsetB: [10, 10, 0],
  },
  "BOOL-009": { type: "lattice_block", size: 60, n: 7, pitch: 8, holeD: 4 },

  "MECH-014": { type: "L_bracket", legA: 60, legB: 40, thickness: 5, holeD: 6.6, slotW: 8, slotL: 16 },
  "MECH-022": {
    type: "stepped_shaft",
    segments: [
      { d: 20, l: 30 },
      { d: 16, l: 25 },
      { d: 12, l: 20 },
    ],
  },
  "MECH-027": {
    type: "carrier_plate",
    r: 40,
    thickness: 8,
    bores: [
      { r: 6, n: 1, pcd: 0 },
      { r: 3, n: 3, pcd: 30 },
      { r: 1.5, n: 6, pcd: 60, phase: Math.PI / 6 },
    ],
  },

  "ASM-005": { type: "pin", d: 10, l: 40, chamfer: 1 },
  "ASM-011": { type: "dovetail", baseW: 50, topW: 32.7, height: 30, length: 100 },

  "DFM-002": { type: "enclosure_half", w: 120, h: 25, d: 60, wall: 2.0, bossR: 2.0 },
  "DFM-008": { type: "hinge", w: 80, h: 30, t: 6, web: 0.5 },

  "BREP-004": { type: "goblet", cupR: 30, cupH: 60, stemR: 5, stemH: 50, baseR: 35, baseT: 5 },

  "PARAM-006": { type: "flange", hubR: 15, hubH: 20, plateR: 50, plateT: 8, pcd: 80, boltR: 3.5 },
  "PARAM-013": { type: "L_bracket", legA: 78, legB: 40, thickness: 5, holeD: 9, slotW: 8, slotL: 16 },

  "REVENG-002": { type: "L_bracket", legA: 60, legB: 40, thickness: 5, holeD: 6.6, slotW: 8, slotL: 16 },
  "REVENG-009": { type: "enclosure_half", w: 80, h: 40, d: 60, wall: 2.5, bossR: 2 },

  "SKETCH-003": { type: "box", size: [70, 70, 2] },

  "SURF-002": { type: "blade", chord: 60, span: 80, twist: 12, thickness: 5 },
};
