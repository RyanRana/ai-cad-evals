import type { ShapeDesc } from "@/components/CadViewer";

// Procedural ground-truth shapes used by the in-browser CAD viewer.
// Visualisation-only; scoring uses the canonical reference STEP files.
export const TASK_SHAPES: Record<string, ShapeDesc> = {
  // ---- L1 ----
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
  "BREP-004": { type: "goblet", cupR: 30, cupH: 60, stemR: 5, stemH: 50, baseR: 35, baseT: 5 },
  "SURF-002": { type: "blade", chord: 60, span: 80, twist: 12, thickness: 5 },

  // ---- L2 ----
  "MECH-014": { type: "L_bracket", legA: 60, legB: 40, thickness: 5, holeD: 6.6, slotW: 8, slotL: 16 },
  "MECH-022": { type: "stepped_shaft", segments: [{ d: 20, l: 30 }, { d: 16, l: 25 }, { d: 12, l: 20 }] },
  "MECH-027": {
    type: "carrier_plate",
    r: 40, thickness: 8,
    bores: [
      { r: 6, n: 1, pcd: 0 },
      { r: 3, n: 3, pcd: 30 },
      { r: 1.5, n: 6, pcd: 60, phase: Math.PI / 6 },
    ],
  },
  "ASM-005": { type: "pin", d: 10, l: 40, chamfer: 1 },
  "ASM-011": { type: "dovetail", baseW: 50, topW: 32.7, height: 30, length: 100 },
  "STD-002": { type: "stepped_shaft", segments: [{ d: 13, l: 8 }, { d: 8, l: 30 }] },
  "SHEET-003": { type: "enclosure_half", w: 80, h: 25, d: 30, wall: 1.5, bossR: 2.75 },
  "SEAL-001": {
    type: "carrier_plate",
    r: 40, thickness: 6,
    bores: [{ r: 1.77, n: 1, pcd: 50 }],
  },
  "KIN-002": {
    type: "csg_union",
    a: { type: "stepped_shaft", segments: [{ d: 4, l: 80 }] },
    b: { type: "stepped_shaft", segments: [{ d: 4, l: 60 }] },
    offsetA: [0, 30, 0],
    offsetB: [0, 0, 0],
  },

  // ---- L3 ----
  "DFMCNC-002": { type: "enclosure_half", w: 80, h: 40, d: 60, wall: 5, bossR: 3 },
  "DFMMOLD-002": { type: "enclosure_half", w: 120, h: 25, d: 60, wall: 2.0, bossR: 2.0 },
  "DFMFDM-008": { type: "hinge", w: 80, h: 30, t: 6, web: 0.5 },
  "CAM-001": { type: "enclosure_half", w: 100, h: 12, d: 60, wall: 6, bossR: 1.6 },

  // ---- L4 ----
  "PARAM-006": { type: "flange", hubR: 15, hubH: 20, plateR: 50, plateT: 8, pcd: 80, boltR: 3.5 },
  "PARAM-013": { type: "L_bracket", legA: 78, legB: 40, thickness: 5, holeD: 9, slotW: 8, slotL: 16 },
  "REVENG-002": { type: "L_bracket", legA: 60, legB: 40, thickness: 5, holeD: 6.6, slotW: 8, slotL: 16 },
  "REVENG-009": { type: "enclosure_half", w: 80, h: 40, d: 60, wall: 2.5, bossR: 2 },
  "SKETCH-003": { type: "box", size: [70, 70, 2] },
  "FUNC-001": { type: "L_bracket", legA: 80, legB: 50, thickness: 6, holeD: 6.6, slotW: 6, slotL: 12 },
  "FUNC-007": {
    type: "carrier_plate",
    r: 30, thickness: 35,
    bores: Array.from({ length: 6 }, (_, i) => ({ r: 0.6, n: 12, pcd: 18 + i * 1.8 })),
  },
  "PARA-001": { type: "L_bracket", legA: 60, legB: 40, thickness: 5, holeD: 6.6, slotW: 8, slotL: 16 },
  "CAL-003": {
    type: "carrier_plate",
    r: 40, thickness: 8,
    bores: [
      { r: 6, n: 1, pcd: 0 },
      { r: 3, n: 3, pcd: 30 },
      { r: 1.5, n: 6, pcd: 60, phase: Math.PI / 6 },
    ],
  },
};
