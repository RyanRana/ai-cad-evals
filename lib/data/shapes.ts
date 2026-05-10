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
  "SURF-002": {
    type: "impeller",
    hubR: 14,
    hubH: 30,
    bladeCount: 7,
    chord: 36,
    span: 38,
    twist: 28,
    thickness: 4,
  },

  // ---- L2 ----
  "MECH-014": { type: "L_bracket", legA: 60, legB: 40, thickness: 5, holeD: 6.6, slotW: 8, slotL: 16 },
  "MECH-022": { type: "stepped_shaft", segments: [{ d: 20, l: 30 }, { d: 16, l: 25 }, { d: 12, l: 20 }] },
  "MECH-027": {
    type: "planetary_gearset",
    ringTeeth: 60,
    sunTeeth: 18,
    planetTeeth: 21,
    module: 2.0,
    thickness: 10,
    boreR: 5,
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

  // =========================================================================
  // v0.6 expansion — approximations from existing variants. Some are
  // dimensionally faithful, others are visual stand-ins (e.g. a sphere cap
  // is shown as a short cylinder). The viewer's job is to give the eye
  // something to compare across agents, not to be the held-out reference.
  // =========================================================================

  // ---- L1 / primitives ----
  "PRIM-002": { type: "hollow_cylinder", outerR: 25, innerR: 0, height: 43 },
  "PRIM-003": { type: "stepped_shaft", segments: [{ d: 60, l: 1 }, { d: 30, l: 49 }] },
  "PRIM-004": { type: "box", size: [50, 50, 30] },
  "PRIM-005": { type: "box", size: [40, 40, 80] },
  "PRIM-009": { type: "hollow_cylinder", outerR: 50, innerR: 49, height: 8 },

  // ---- L1 / boolean ----
  "BOOL-001": {
    type: "csg_union",
    a: { type: "box", size: [60, 60, 60] },
    b: { type: "hollow_cylinder", outerR: 10, innerR: 0, height: 40 },
    offsetA: [0, 0, 0],
    offsetB: [20, 30, 20],
  },
  "BOOL-002": { type: "hollow_cylinder", outerR: 20, innerR: 0, height: 12 },
  "BOOL-005": { type: "box", size: [30, 30, 30] },

  // ---- L1 / brep ----
  "BREP-001": { type: "hollow_cylinder", outerR: 20, innerR: 0, height: 60 },
  "BREP-002": { type: "goblet", cupR: 15, cupH: 20, stemR: 15, stemH: 20, baseR: 15, baseT: 1 },
  "BREP-007": { type: "hollow_cylinder", outerR: 30, innerR: 5, height: 60 },

  // ---- L1 / freeform ----
  "SURF-001": { type: "blade", chord: 80, span: 12, twist: 90, thickness: 8 },
  "SURF-007": { type: "enclosure_half", w: 110, h: 38, d: 65, wall: 2, bossR: 0 },

  // ---- L2 / parametric_mech ----
  "MECH-002": { type: "enclosure_half", w: 80, h: 40, d: 50, wall: 4, bossR: 5 },
  "MECH-005": {
    type: "carrier_plate",
    r: 15, thickness: 6,
    bores: [
      { r: 4, n: 1, pcd: 0 },
      { r: 3, n: 1, pcd: 78 },
    ],
  },
  "MECH-018": {
    type: "carrier_plate",
    r: 30, thickness: 8,
    bores: [{ r: 2.25, n: 4, pcd: 56, phase: Math.PI / 4 }],
  },
  "MECH-031": { type: "stepped_shaft", segments: [{ d: 35, l: 18 }] },

  // ---- L2 / assembly ----
  "ASM-001": { type: "stepped_shaft", segments: [{ d: 22, l: 8 }, { d: 16, l: 22 }] },
  "ASM-008": { type: "gear", teeth: 18, module: 1.25, thickness: 22, boreR: 6 },
  "ASM-013": { type: "stepped_shaft", segments: [{ d: 30, l: 15 }, { d: 30.2, l: 5 }] },

  // ---- L2 / standards ----
  "STD-001": { type: "stepped_shaft", segments: [{ d: 8.4, l: 2 }, { d: 4.2, l: 14 }] },
  "STD-005": { type: "pin", d: 6, l: 30, chamfer: 0.6 },
  "STD-008": { type: "pin", d: 6.35, l: 15.9, chamfer: 0 },

  // ---- L2 / sheet metal ----
  "SHEET-001": { type: "enclosure_half", w: 100, h: 30, d: 80, wall: 1.0, bossR: 0 },
  "SHEET-007": { type: "enclosure_half", w: 200, h: 60, d: 120, wall: 1.5, bossR: 2 },

  // ---- L2 / sealing ----
  "SEAL-004": {
    type: "stepped_shaft",
    segments: [{ d: 37.7, l: 10 }, { d: 34.5, l: 4 }, { d: 37.7, l: 10 }],
  },
  "SEAL-007": {
    type: "carrier_plate",
    r: 20, thickness: 6,
    bores: [{ r: 1.5, n: 1, pcd: 25 }],
  },

  // ---- L2 / kinematic ----
  "KIN-005": {
    type: "carrier_plate",
    r: 40, thickness: 8,
    bores: [{ r: 3, n: 4, pcd: 60, phase: Math.PI / 4 }],
  },
  "KIN-008": {
    type: "planetary_gearset",
    ringTeeth: 63, sunTeeth: 21, planetTeeth: 21, module: 1.5,
    thickness: 8, boreR: 5,
  },

  // ---- L3 / DFM ----
  "DFMCNC-005": { type: "enclosure_half", w: 100, h: 10, d: 100, wall: 8, bossR: 0 },
  "DFMCNC-009": { type: "L_bracket", legA: 200, legB: 25, thickness: 12, holeD: 6.6, slotW: 12, slotL: 50 },
  "DFMCNC-013": { type: "stepped_shaft", segments: [{ d: 60, l: 25 }] },
  "DFMMOLD-005": { type: "enclosure_half", w: 180, h: 22, d: 60, wall: 1.8, bossR: 2.5 },
  "DFMFDM-002": { type: "box", size: [40, 40, 30] },
  "DFMFDM-011": { type: "hinge", w: 80, h: 30, t: 3, web: 0.3 },
  "CAM-005": { type: "enclosure_half", w: 80, h: 14, d: 80, wall: 6, bossR: 0 },

  // ---- L4 / cognition ----
  "PARAM-009": { type: "stepped_shaft", segments: [{ d: 70, l: 180 }, { d: 40, l: 22 }] },
  "REVENG-005": {
    type: "stepped_shaft",
    segments: [{ d: 80, l: 12 }, { d: 60, l: 12 }, { d: 40, l: 12 }],
  },
  "SKETCH-014": { type: "box", size: [80, 40, 2] },
  "FUNC-003": {
    type: "carrier_plate",
    r: 40, thickness: 50,
    bores: [{ r: 1.5, n: 3, pcd: 28 }],
  },
  "PARA-005": {
    type: "carrier_plate",
    r: 40, thickness: 8,
    bores: [
      { r: 6, n: 1, pcd: 0 },
      { r: 3, n: 3, pcd: 30 },
      { r: 1.5, n: 6, pcd: 60, phase: Math.PI / 6 },
    ],
  },
  "CAL-007": { type: "flange", hubR: 15, hubH: 4, plateR: 60, plateT: 14, pcd: 90, boltR: 4 },
};
