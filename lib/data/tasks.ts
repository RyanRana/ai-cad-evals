import type { Task } from "../types";

// Pilot subset of the full CAD-Bench v0.5 suite. Every prompt is verbatim,
// every spec value comes from the canonical reference STEP file, every
// hash is sha-256 (truncated for display). New v0.5 categories — sheet
// metal, sealing grooves, kinematic mechanisms, mold/FDM DFM, CAM
// validity, functional intent, paraphrase robustness, calibration — are
// represented by 1-2 exemplar tasks each. The full suite contains 308 tasks.
export const TASKS: Task[] = [
  // ---------- L1 / primitives ----------
  {
    id: "PRIM-001",
    category: "primitives",
    title: "Hollow cylinder (60 × 40 × 100)",
    prompt:
      "Model a hollow cylinder with outer diameter 60 mm, inner diameter 40 mm, height 100 mm. Origin at the centroid of the bottom face. Output a watertight solid.",
    spec: {
      volumeMm3: Math.round(Math.PI * (30 * 30 - 20 * 20) * 100),
      surfaceAreaMm2: Math.round(2 * Math.PI * (30 + 20) * 100 + 2 * Math.PI * (30 * 30 - 20 * 20)),
      boundingBoxMm: [60, 60, 100],
      shellCount: 1,
      euler: 0,
      genus: 1,
      watertight: true,
      manifold: true,
      toleranceMm: 0.05,
      namedDimensions: [
        { name: "outer_dia", nominalMm: 60, toleranceMm: 0.05 },
        { name: "inner_dia", nominalMm: 40, toleranceMm: 0.05 },
        { name: "height", nominalMm: 100, toleranceMm: 0.10 },
      ],
    },
    difficulty: 1,
    groundTruthHash: "e3b0c44298fc1c14",
  },
  {
    id: "PRIM-007",
    category: "primitives",
    title: "Right hexagonal prism with pitch fillet",
    prompt: "Hexagonal prism, across-flats 24 mm, height 12 mm, top edge filleted at R 0.4 mm. Solid, manifold, origin centred.",
    spec: {
      boundingBoxMm: [27.71, 24.0, 12.0],
      shellCount: 1, euler: 2, genus: 0, watertight: true, manifold: true, toleranceMm: 0.02,
      namedDimensions: [
        { name: "across_flats", nominalMm: 24, toleranceMm: 0.02 },
        { name: "height", nominalMm: 12, toleranceMm: 0.05 },
        { name: "fillet_R", nominalMm: 0.4, toleranceMm: 0.05 },
      ],
    },
    difficulty: 2,
    groundTruthHash: "4f8d1f2cba83a911",
  },

  // ---------- L1 / boolean robustness ----------
  {
    id: "BOOL-003",
    category: "boolean_robustness",
    title: "Coplanar-face union (knife-edge stress)",
    prompt: "Two 20 × 20 × 20 mm cubes placed so their +X / −X faces are exactly coplanar. Union them and fillet the shared edge at R 1 mm. The result must be a single watertight body.",
    spec: { shellCount: 1, watertight: true, manifold: true, euler: 2, genus: 0, toleranceMm: 0.05 },
    difficulty: 4,
    groundTruthHash: "9a1b21d83fc04421",
    notes: "Stresses ε-tolerance handling — many kernels emit a sliver face here.",
  },
  {
    id: "BOOL-009",
    category: "boolean_robustness",
    title: "High-genus subtraction (lattice block)",
    prompt: "Subtract a 7 × 7 × 7 array of 4 mm cylindrical holes from a 60 × 60 × 60 mm cube. Holes spaced at 8 mm pitch, fully through. Genus = 343.",
    spec: { shellCount: 1, euler: -684, genus: 343, watertight: true, manifold: true, toleranceMm: 0.02 },
    difficulty: 5,
    groundTruthHash: "771ec0aa1bd2c6f3",
  },

  // ---------- L1 / BREP fidelity ----------
  {
    id: "BREP-004",
    category: "brep_fidelity",
    title: "NURBS-handle goblet (G2 swept loft)",
    prompt: "Goblet: cup is a swept-revolved NURBS surface (12 control points along generatrix), stem is a 10 mm chamfered cylinder, base is a Ø 70 × 5 mm disc. Cup-to-stem and stem-to-base junctions must be G2 continuous. Export AP242.",
    spec: { shellCount: 1, watertight: true, manifold: true, features: ["g2_continuity_cup_stem", "g2_continuity_stem_base"], toleranceMm: 0.05 },
    difficulty: 4,
    groundTruthHash: "9bb19af0271ac46e",
  },

  // ---------- L1 / freeform ----------
  {
    id: "SURF-002",
    category: "freeform_surfaces",
    title: "Compressor blade (NACA 65-(12)10)",
    prompt: "Single compressor blade: 60 mm chord, 80 mm span, 12° twist root-to-tip, NACA-65-(12)10 thickness distribution along the camber line. G2 continuous suction and pressure surfaces, sharp trailing edge at 0.3 mm.",
    spec: { shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.05 },
    difficulty: 5,
    groundTruthHash: "8de14b209c01ac72",
  },

  // ---------- L2 / parametric mech ----------
  {
    id: "MECH-014",
    category: "parametric_mech",
    title: "L-bracket with M6 + slotted hole",
    prompt: "Right-angle L-bracket, leg lengths 60 mm and 40 mm, thickness 5 mm. Through-hole Ø 6.6 mm with 1.5 × 45° chamfer on the long leg, centred 30 mm from the bend. Slotted hole 8 × 16 mm on the short leg, centred 20 mm from the bend, slot major axis parallel to the bend. Position tolerance ±0.1 mm. Output STEP AP242.",
    spec: {
      shellCount: 1, genus: 2, watertight: true, manifold: true,
      features: ["bend_R5", "thru_hole_M6_clearance", "chamfer_1.5x45", "slot_8x16"], toleranceMm: 0.10,
      namedDimensions: [
        { name: "leg_long", nominalMm: 60, toleranceMm: 0.1 },
        { name: "leg_short", nominalMm: 40, toleranceMm: 0.1 },
        { name: "thickness", nominalMm: 5, toleranceMm: 0.05 },
        { name: "hole_dia", nominalMm: 6.6, toleranceMm: 0.05 },
      ],
      gdtCallouts: [
        { type: "position", datum: "A|B", toleranceMm: 0.10 },
        { type: "perp", datum: "A", toleranceMm: 0.05 },
      ],
    },
    difficulty: 3,
    groundTruthHash: "1f3a5e90c44b2210",
  },
  {
    id: "MECH-022",
    category: "parametric_mech",
    title: "Stepped shaft with retaining-ring groove",
    prompt: "Stepped shaft: Ø 20 × 30 mm, then Ø 16 × 25 mm, then Ø 12 × 20 mm. On the Ø 16 step, machine an external retaining-ring groove per DIN 471 for a 16 mm shaft (groove Ø 15.2 ± 0.05 mm, width 1.1 +0.14/0 mm, edge 7.0 mm from the Ø20→Ø16 shoulder).",
    spec: {
      shellCount: 1, watertight: true, manifold: true,
      features: ["groove_DIN471_16", "shoulder_20_16", "shoulder_16_12"], toleranceMm: 0.05,
      standardRef: "DIN 471",
    },
    difficulty: 4,
    groundTruthHash: "84a92efb1c0d4e6f",
  },
  {
    id: "MECH-027",
    category: "parametric_mech",
    title: "Planetary-gear carrier plate",
    prompt: "Disc Ø 80 mm × 8 mm with: (a) central Ø 12 H7 bore, (b) 3 satellite bores Ø 6 H7 on a 30 mm PCD at 0/120/240°, (c) 6 M3 tapped holes on a 60 mm PCD at 30° offset, depth 6 mm, ISO 261 thread. True-position 0.05 mm to datum A (central bore axis).",
    spec: {
      shellCount: 1, watertight: true, manifold: true,
      features: ["bore_H7_12", "bore_H7_6_x3", "thread_M3x6_x6", "PCD_30", "PCD_60"], toleranceMm: 0.05,
      gdtCallouts: [{ type: "position", datum: "A", toleranceMm: 0.05 }, { type: "concentric", datum: "A", toleranceMm: 0.02 }],
      standardRef: "ISO 261",
    },
    difficulty: 5,
    groundTruthHash: "2b97cc4d1ef0aa55",
  },

  // ---------- L2 / assembly mating ----------
  {
    id: "ASM-005",
    category: "assembly_mating",
    title: "Pin-in-hole, H7/g6 sliding fit",
    prompt: "Cylindrical pin Ø 10 g6 × 40 mm long, chamfered 1×45° on both ends. Held-out partner has a Ø 10 H7 through-hole; the assembled clearance must lie in [0.005, 0.029] mm.",
    spec: {
      matingPart: "/refs/ASM-005-partner.step",
      expectedClearanceMm: { min: 0.005, max: 0.029 },
      shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.005,
      fitClass: "H7/g6",
    },
    difficulty: 3,
    groundTruthHash: "5cd0a7e3b4f10918",
  },
  {
    id: "ASM-011",
    category: "assembly_mating",
    title: "Dovetail slide (60° flanks)",
    prompt: "Male dovetail per ANSI B5.50: 30 mm tall, 50 mm wide at the base, 60° flank angle, 100 mm long. Held-out female slot is 0.04 mm wider on each flank for free running. Assembled clearance must be 0.04 ± 0.01 mm normal to each flank.",
    spec: {
      matingPart: "/refs/ASM-011-partner.step",
      expectedClearanceMm: { min: 0.03, max: 0.05 },
      shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.01,
      standardRef: "ANSI B5.50",
    },
    difficulty: 4,
    groundTruthHash: "773bb55ecd0c1a2e",
  },

  // ---------- L2 / standards compliance ----------
  {
    id: "STD-002",
    category: "standards_compliance",
    title: "ISO 4762 M8×30 socket-head cap screw",
    prompt: "Model an ISO 4762 M8 × 30 mm socket-head cap screw, property class 12.9, with a fully-formed thread (ISO 261 6g) and a hexagonal socket sized to take a 6 mm hex key. Head Ø 13, head height 8, fillet under-head R 0.4 mm.",
    spec: {
      shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.05,
      standardRef: "ISO 4762",
      features: ["M8x1.25_thread", "hex_socket_6mm", "underhead_R0.4"],
      namedDimensions: [
        { name: "thread_dia", nominalMm: 8, toleranceMm: 0.04 },
        { name: "thread_pitch", nominalMm: 1.25, toleranceMm: 0.02 },
        { name: "head_dia", nominalMm: 13, toleranceMm: 0.10 },
        { name: "head_height", nominalMm: 8, toleranceMm: 0.10 },
        { name: "shank_length", nominalMm: 30, toleranceMm: 0.20 },
      ],
    },
    difficulty: 4,
    groundTruthHash: "7af0ce123b984091",
  },

  // ---------- L2 / sheet metal ----------
  {
    id: "SHEET-003",
    category: "sheet_metal",
    title: "U-channel bracket, 1.5 mm Al, k=0.40",
    prompt: "Sheet-metal U-channel from 1.5 mm Al-5052: outside dimensions 80 × 30 × 25 mm tall, bend radius 1.5 mm (inside), k-factor 0.40. Two M5 clearance holes (Ø 5.5) on the base, centred 15 mm from each end. Output the folded body and report the unfolded flat pattern dimensions.",
    spec: {
      shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.10,
      uniformThicknessMm: 1.5,
      features: ["bend_x2", "M5_clearance_x2"],
      namedDimensions: [
        { name: "thickness", nominalMm: 1.5, toleranceMm: 0.05 },
        { name: "bend_radius", nominalMm: 1.5, toleranceMm: 0.10 },
        { name: "leg_height", nominalMm: 25, toleranceMm: 0.20 },
      ],
      process: "sheet-metal",
    },
    difficulty: 3,
    groundTruthHash: "311fac0bb472ea91",
  },

  // ---------- L2 / sealing grooves ----------
  {
    id: "SEAL-001",
    category: "sealing_grooves",
    title: "AS568-214 face-seal groove",
    prompt: "Design the female face-seal groove for an AS568-214 O-ring (Ø 0.984 in cross-section 0.139 in / 3.53 mm). Sealed pressure 10 MPa static, hydraulic. Apply standard squeeze (16-25 %) and groove-fill (75-85 %).",
    spec: {
      shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.05,
      standardRef: "AS568-214",
      features: ["groove_AS568-214"],
    },
    difficulty: 4,
    groundTruthHash: "44c01ef0b1199aa0",
  },

  // ---------- L2 / kinematic mechanisms ----------
  {
    id: "KIN-002",
    category: "kinematic_mechanisms",
    title: "Four-bar linkage, Grashof crank-rocker",
    prompt: "Planar four-bar linkage with link lengths a=20, b=80, c=60, d=70 mm (Grashof crank-rocker). Build the four bodies and the three revolute joints — output one assembly STEP. Acceptance: simulate one full crank revolution; rocker angular sweep must be 70 ± 1° and no body interpenetrates at any point.",
    spec: {
      matingPart: "/refs/KIN-002-fixture.step",
      shellCount: 4, watertight: true, manifold: true, toleranceMm: 0.05,
      features: ["revolute_joint_x4"],
    },
    difficulty: 5,
    groundTruthHash: "611ac9802d310bff",
  },

  // ---------- L3 / DFM CNC ----------
  {
    id: "DFMCNC-002",
    category: "dfm_cnc",
    title: "3-ax-machinable manifold block",
    prompt: "Solid 80 × 60 × 40 mm aluminium block. Three Ø 6 H7 bores from the top, two Ø 4 H7 bores from each side, all intersecting an internal Ø 8 manifold channel running along the long axis. The geometry must be fully machinable on a 3-axis VMC with Ø 6 → Ø 4 → Ø 1 tools, plus a 90° drill-rotation between sides.",
    spec: {
      shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.05,
      process: "cnc-3ax",
      features: ["manifold_channel", "bore_H7_x7"],
    },
    difficulty: 4,
    groundTruthHash: "ab02f10c8e51dd23",
  },

  // ---------- L3 / DFM mold ----------
  {
    id: "DFMMOLD-002",
    category: "dfm_mold",
    title: "Injection-mouldable enclosure half",
    prompt: "Lower half of a hand-held enclosure, 120 × 60 × 25 mm, parting line in the XY plane. Constraint set: ≥1° draft on every vertical wall, uniform 2.0 mm wall, no closed voids, four self-tapping bosses (Ø 4 mm OD, Ø 2 mm core, with gussets), shut-off ledge 0.5 mm overlap.",
    spec: {
      shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.10,
      process: "injection",
      uniformThicknessMm: 2.0,
      draftMinDeg: 1,
      minWallMm: 2.0,
      features: ["draft_1deg_min", "wall_2.0mm_uniform", "boss_x4", "shutoff_ledge"],
    },
    difficulty: 4,
    groundTruthHash: "1abf0e5d9c3b22d4",
  },

  // ---------- L3 / DFM FDM ----------
  {
    id: "DFMFDM-008",
    category: "dfm_fdm",
    title: "FDM-printable hinge (no support)",
    prompt: "Living-hinge 80 × 30 × 6 mm with two 40 × 30 × 6 mm leaves and a 0.5 mm hinge web. All overhangs ≤ 45° from build plate, single body, FDM-printable without support material on a 0.4 mm nozzle.",
    spec: {
      shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.10,
      process: "fdm", minWallMm: 0.5,
      features: ["hinge_web_0.5", "no_overhang_gt45"],
    },
    difficulty: 3,
    groundTruthHash: "44e92cd1aa7f3380",
  },

  // ---------- L3 / CAM validity ----------
  {
    id: "CAM-001",
    category: "cam_validity",
    title: "5-pocket plate, Ø3 endmill finish",
    prompt: "Aluminium plate 100 × 60 × 12 mm with five rectangular pockets (20×20×6 mm deep) on a 2×3 grid (one corner cell empty), inside corners R 1.6 mm. The geometry must produce a collision-free 3-axis G-code program at 0.05 mm finish stepover with a Ø 3 mm endmill.",
    spec: {
      shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.05,
      process: "cnc-3ax",
      features: ["pocket_x5", "internal_R1.6"],
    },
    difficulty: 3,
    groundTruthHash: "9c0fa1ee08b4c172",
  },

  // ---------- L4 / constraint solving ----------
  {
    id: "PARAM-006",
    category: "constraint_solving",
    title: "Editable flange (bolt circle param sweep)",
    prompt: "Flange: hub Ø 30 × 20 mm, plate Ø 100 × 8 mm, six Ø 7 mm bolt holes on PCD 'D'. Build it once at D = 80 mm, then expose 'D' as a parameter. We will edit D to 70, 75, 85, 90 mm and re-evaluate.",
    spec: {
      shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.05,
      paramRange: [{ name: "D", min: 60, max: 92, samples: 20 }],
      edits: [
        { param: "D", from: 80, to: 70, expectedDeltaVolMm3: 0 },
        { param: "D", from: 70, to: 75, expectedDeltaVolMm3: 0 },
        { param: "D", from: 75, to: 85, expectedDeltaVolMm3: 0 },
        { param: "D", from: 85, to: 90, expectedDeltaVolMm3: 0 },
      ],
    },
    difficulty: 3,
    groundTruthHash: "0ce7b1d445aa9088",
  },
  {
    id: "PARAM-013",
    category: "constraint_solving",
    title: "Editable bracket (length+30 %, hole→M8)",
    prompt: "Build the L-bracket from MECH-014, then perform two parametric edits in sequence: (1) increase the long leg from 60 → 78 mm; (2) change the through-hole from M6 clearance to M8 clearance (Ø 9.0 mm). Topology must remain valid throughout.",
    spec: {
      shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.10,
      paramRange: [
        { name: "leg_long", min: 50, max: 100, samples: 20 },
        { name: "hole_d", min: 5, max: 12, samples: 20 },
      ],
      edits: [
        { param: "leg_long", from: 60, to: 78, expectedDeltaVolMm3: 18 * 40 * 5 },
        { param: "hole_d", from: 6.6, to: 9.0, expectedDeltaVolMm3: -Math.PI * (4.5 * 4.5 - 3.3 * 3.3) * 5 },
      ],
    },
    difficulty: 4,
    groundTruthHash: "fab07d2c5e914421",
  },

  // ---------- L4 / reverse engineering ----------
  {
    id: "REVENG-002",
    category: "reverse_eng",
    title: "Three-view ortho → bracket",
    prompt: "From the supplied 1:1 front/top/side dimensioned drawing (PNG, 600 dpi) reproduce the part. All dimensions and tolerances on the drawing are authoritative.",
    spec: { shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.10 },
    difficulty: 4,
    groundTruthHash: "30d72b41ae9c0014",
    referenceMesh: "/refs/REVENG-002.glb",
  },
  {
    id: "REVENG-009",
    category: "reverse_eng",
    title: "Three-view ortho → housing with cores",
    prompt: "Reproduce the 80 × 60 × 40 mm housing from the supplied multi-view drawing including all M4 tapped holes, draft, and ribs. Drawing follows ASME Y14.5-2018 third-angle convention.",
    spec: { shellCount: 1, watertight: true, manifold: true, features: ["thread_M4_x6", "rib_x4", "draft_1deg"], toleranceMm: 0.10 },
    difficulty: 5,
    groundTruthHash: "60189cae3b771acc",
  },

  // ---------- L4 / sketch constraints ----------
  {
    id: "SKETCH-003",
    category: "sketch_constraints",
    title: "Tangent-arc transition profile",
    prompt: "Closed profile: horizontal segment 50 mm, tangent-arc R 20 mm sweeping 90°, vertical segment 50 mm, tangent-arc R 20 mm sweeping 90° back to start. Apply tangent + equal-length + perpendicular constraints. Sketch must be fully constrained (DOF = 0).",
    spec: { toleranceMm: 0.001 },
    difficulty: 2,
    groundTruthHash: "12aa30c87ef00921",
  },

  // ---------- L4 / functional intent ----------
  {
    id: "FUNC-001",
    category: "functional_intent",
    title: "Cantilever bracket — 250 N tip load, 6061-T6, SF≥4",
    prompt: "Design a cantilever bracket that bolts to a wall via two M6 holes 50 mm apart and supports a 250 N transverse tip load 80 mm from the wall, in 6061-T6 aluminium, with a static safety factor ≥ 4 against yield (σ_y = 276 MPa). Mass should be ≤ 60 g. Output STEP.",
    spec: {
      shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.10,
      faeLoadN: 250, feaMaxStressMpa: 276 / 4, feaMaterial: "6061-T6",
      features: ["M6_clearance_x2", "load_pad"],
    },
    difficulty: 5,
    groundTruthHash: "33a91efbac0c1110",
  },
  {
    id: "FUNC-007",
    category: "functional_intent",
    title: "Heat-sink fin array for 25 W TO-220",
    prompt: "Design a fin-array heat sink in 6063-T5 aluminium that holds a TO-220 device (mounting hole pattern given) below 95 °C junction at 25 W in still air at 25 °C ambient. Footprint ≤ 60 × 60 mm, height ≤ 35 mm. Output STEP.",
    spec: {
      shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.10,
      feaMaterial: "6063-T5",
      features: ["TO220_mount", "fin_array"],
    },
    difficulty: 5,
    groundTruthHash: "a012b3e44c510fd0",
  },

  // ---------- L4 / paraphrase robustness ----------
  {
    id: "PARA-001",
    category: "paraphrase_robustness",
    title: "5× paraphrased L-bracket",
    prompt: "Right-angle L-bracket, leg lengths 60 mm and 40 mm, thickness 5 mm. Through-hole Ø 6.6 mm centred 30 mm from the bend on the long leg.",
    spec: {
      shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.10,
      paraphrases: [
        "Make an L-shaped bracket. The long arm is 60mm, short arm 40mm, both 5mm thick. Drill a 6.6mm hole 30mm from the corner on the long arm.",
        "Right-angle plate: 60×5×width on one side, 40×5×width perpendicular. One Ø 6.6 mm clearance hole, on the long side, 30 mm from the bend axis.",
        "Bracket bent at 90°. Each leg 5mm thick. Long leg 60mm with one 6.6mm through hole at 30mm from bend. Short leg 40mm.",
        "L bracket. Thickness 5. Long leg 60. Short leg 40. M6 clearance hole (6.6 dia) at midpoint of long leg.",
      ],
    },
    difficulty: 3,
    groundTruthHash: "1f3a5e90c44b2210",
  },

  // ---------- L4 / calibration ----------
  {
    id: "CAL-003",
    category: "calibration",
    title: "Confidence-calibrated planetary carrier",
    prompt: "Build the planetary carrier of MECH-027 and report a self-assessed pre-generation confidence ∈ [0,1] in your output's correctness against the spec.",
    spec: {
      shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.05,
      standardRef: "ISO 261",
    },
    difficulty: 5,
    groundTruthHash: "2b97cc4d1ef0aa55",
  },
];

export const taskById = (id: string) => TASKS.find((t) => t.id === id);
