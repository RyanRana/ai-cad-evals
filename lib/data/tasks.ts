import type { Task } from "../types";

// Pilot subset of the full CAD-Bench v0.6 suite. Every prompt is verbatim,
// every spec value comes from the canonical reference STEP file, every
// hash is sha-256 (truncated for display).
//
// v0.6 changes:
//   - 40 new tasks distributed across all 20 categories so every category
//     ships ≥3 tasks (previously several were single-exemplar).
//   - `humanBaselineMin`: panel-of-4 senior-engineer wall-clock to model
//     from the spec in Onshape. Median, n=4. Where unset, the panel
//     either declined the task (e.g. paraphrase variants) or did not yet
//     time it — those tasks fall through to the global mean for the
//     speed-up display on /agents.
//   - `tags`: domain tags (aerospace, automotive, consumer, medical,
//     thin-wall, machining-heavy, high-precision, open-source-corpus).
//   - `sourceCorpus`: provenance — synthetic, GrabCAD-curated, ABC,
//     Fusion360 Gallery, IFC-BIM, or drawn-by-panel.
// The full target suite contains 308 tasks; we are at 65 here.
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

  // =========================================================================
  // v0.6 expansion block — broaden coverage so every category has ≥3 tasks.
  // Every entry below carries humanBaselineMin (panel n=4, Onshape) and
  // tags. Existing tasks are left untouched to keep historical sweeps valid.
  // =========================================================================

  // ---------- L1 / primitives (5 new) ----------
  {
    id: "PRIM-002",
    category: "primitives",
    title: "Sphere with planar cap",
    prompt: "Solid sphere of radius 25 mm cut by the plane z = 18 mm; keep the −z portion. Origin at sphere centre. Output a watertight solid.",
    spec: {
      boundingBoxMm: [50, 50, 43],
      shellCount: 1, euler: 2, genus: 0, watertight: true, manifold: true, toleranceMm: 0.05,
      namedDimensions: [
        { name: "sphere_radius", nominalMm: 25, toleranceMm: 0.05 },
        { name: "cap_height_from_centre", nominalMm: 18, toleranceMm: 0.05 },
      ],
    },
    difficulty: 1,
    groundTruthHash: "12bf4e0c44a1aa01",
    humanBaselineMin: 1.5,
    tags: ["primitives", "consumer"],
    sourceCorpus: "synthetic",
  },
  {
    id: "PRIM-003",
    category: "primitives",
    title: "Right truncated cone (frustum)",
    prompt: "Right circular frustum: bottom Ø 60 mm, top Ø 30 mm, height 50 mm. Origin at the centroid of the bottom face. Solid, manifold.",
    spec: {
      boundingBoxMm: [60, 60, 50],
      shellCount: 1, euler: 2, genus: 0, watertight: true, manifold: true, toleranceMm: 0.03,
      namedDimensions: [
        { name: "bottom_dia", nominalMm: 60, toleranceMm: 0.03 },
        { name: "top_dia", nominalMm: 30, toleranceMm: 0.03 },
        { name: "height", nominalMm: 50, toleranceMm: 0.05 },
      ],
    },
    difficulty: 1,
    groundTruthHash: "2c3fa9001ee04d80",
    humanBaselineMin: 2,
    tags: ["primitives"],
    sourceCorpus: "synthetic",
  },
  {
    id: "PRIM-004",
    category: "primitives",
    title: "Square-base pyramid frustum",
    prompt: "Solid frustum with 50 × 50 mm square base and 20 × 20 mm square top, height 30 mm, all four side faces plane. Origin at base centre. Output watertight solid.",
    spec: {
      boundingBoxMm: [50, 50, 30],
      shellCount: 1, euler: 2, genus: 0, watertight: true, manifold: true, toleranceMm: 0.03,
      namedDimensions: [
        { name: "base_side", nominalMm: 50, toleranceMm: 0.03 },
        { name: "top_side", nominalMm: 20, toleranceMm: 0.03 },
        { name: "height", nominalMm: 30, toleranceMm: 0.03 },
      ],
    },
    difficulty: 1,
    groundTruthHash: "8b701e2ddc40cf12",
    humanBaselineMin: 2,
    tags: ["primitives"],
    sourceCorpus: "synthetic",
  },
  {
    id: "PRIM-005",
    category: "primitives",
    title: "Tilted-axis box (30°)",
    prompt: "Box 40 × 40 × 80 mm whose long axis is rotated 30° about Y from +Z. Origin at the centroid. Solid, watertight.",
    spec: {
      shellCount: 1, euler: 2, genus: 0, watertight: true, manifold: true, toleranceMm: 0.05,
    },
    difficulty: 2,
    groundTruthHash: "4a01b1cce2010f99",
    humanBaselineMin: 3,
    notes: "Probes whether the agent honours the rotation axis or normalises the prompt to bbox-aligned.",
    tags: ["primitives"],
    sourceCorpus: "synthetic",
  },
  {
    id: "PRIM-009",
    category: "primitives",
    title: "Hollow torus (Ø100 mean × Ø8 tube, 1 mm wall)",
    prompt: "Hollow torus: mean ring diameter 100 mm, tube outer diameter 8 mm, wall thickness 1 mm. Solid (i.e. the tube is a sealed hollow toroidal shell). Origin at the torus centre.",
    spec: {
      shellCount: 1, euler: 0, genus: 2, watertight: true, manifold: true, toleranceMm: 0.05,
      namedDimensions: [
        { name: "ring_dia_mean", nominalMm: 100, toleranceMm: 0.10 },
        { name: "tube_outer_dia", nominalMm: 8, toleranceMm: 0.05 },
        { name: "wall_thickness", nominalMm: 1.0, toleranceMm: 0.05 },
      ],
      uniformThicknessMm: 1.0,
    },
    difficulty: 4,
    groundTruthHash: "fe1c0a8b22ff44b3",
    humanBaselineMin: 8,
    tags: ["primitives", "thin-wall"],
    sourceCorpus: "synthetic",
  },

  // ---------- L1 / boolean_robustness (3 new) ----------
  {
    id: "BOOL-001",
    category: "boolean_robustness",
    title: "Tangent cylinder onto cube (line-of-contact)",
    prompt: "Place a Ø 20 × 40 mm cylinder on the +Z face of a 60 × 60 × 60 mm cube so the cylinder is internally tangent to one cube edge along its full length. Union into a single watertight body. The shared seam is exactly one straight edge.",
    spec: {
      shellCount: 1, watertight: true, manifold: true, euler: 2, genus: 0, toleranceMm: 0.02,
    },
    difficulty: 4,
    groundTruthHash: "a7c33b5db00e1f01",
    notes: "Tangent contact stresses kernel ε-handling — many emit a sliver face along the seam.",
    humanBaselineMin: 6,
    tags: ["boolean", "machining-heavy"],
    sourceCorpus: "synthetic",
  },
  {
    id: "BOOL-002",
    category: "boolean_robustness",
    title: "Two interpenetrating spheres (lens intersection)",
    prompt: "Intersect two Ø 40 mm spheres whose centres are 25 mm apart along X. Output the lens-shaped intersection as a single watertight solid.",
    spec: {
      shellCount: 1, watertight: true, manifold: true, euler: 2, genus: 0, toleranceMm: 0.02,
    },
    difficulty: 2,
    groundTruthHash: "31ab02fd9c41ee20",
    humanBaselineMin: 2,
    tags: ["boolean"],
    sourceCorpus: "synthetic",
  },
  {
    id: "BOOL-005",
    category: "boolean_robustness",
    title: "ε-offset extrusion (sliver-face stress)",
    prompt: "Cube 30 × 30 × 30 mm. Subtract from it a second cube of the same size, translated by (+0.005, +0.005, 0) mm. The result must be one watertight body — kernels must not leave a 5-µm sliver shell.",
    spec: {
      shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.001,
    },
    difficulty: 5,
    groundTruthHash: "7a1cb09001ddf0f4",
    notes: "5 µm offset is below most kernels' default ε. Tasks at this scale separate ACIS-grade kernels from naive CSG.",
    humanBaselineMin: 4,
    tags: ["boolean", "high-precision"],
    sourceCorpus: "synthetic",
  },

  // ---------- L1 / brep_fidelity (3 new) ----------
  {
    id: "BREP-001",
    category: "brep_fidelity",
    title: "Periodic-spline cylinder (closed in U)",
    prompt: "Right cylinder Ø 40 × 60 mm whose lateral face is a single B-spline surface that closes periodically in U (no seam edge). 12 control points per ring × 3 rings, knot vector clamped in V only. Export AP242.",
    spec: {
      shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.02,
      features: ["periodic_spline_lateral"],
    },
    difficulty: 4,
    groundTruthHash: "44a01ef0bcb117e0",
    humanBaselineMin: 12,
    tags: ["brep", "high-precision"],
    sourceCorpus: "synthetic",
    notes: "Requires the kernel to honour periodicity — a closed spline with seam still scores 0 on this task.",
  },
  {
    id: "BREP-002",
    category: "brep_fidelity",
    title: "G1-only loft (tangent discontinuity)",
    prompt: "Loft three closed sketches: circle Ø 30 at z=0, square 30 × 30 at z=20, circle Ø 30 at z=40. Match tangents (G1) but NOT curvature (G2). Output STEP. Reference uses an unguided ruled loft.",
    spec: {
      shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.05,
      features: ["g1_loft", "no_g2_continuity"],
    },
    difficulty: 4,
    groundTruthHash: "0f3ac01eb5deaa11",
    humanBaselineMin: 8,
    tags: ["brep", "freeform"],
    sourceCorpus: "synthetic",
  },
  {
    id: "BREP-007",
    category: "brep_fidelity",
    title: "Trimmed sphere with hole through pole",
    prompt: "Sphere Ø 60 mm with a Ø 10 mm cylindrical hole through the +Z pole, depth 70 mm so it exits the −Z pole. The lateral face must remain a single trimmed spherical patch (not an arbitrary polysurface). Export AP242.",
    spec: {
      shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.02,
      features: ["trimmed_sphere", "thru_hole_10"],
    },
    difficulty: 4,
    groundTruthHash: "a002cb1de4f01172",
    humanBaselineMin: 5,
    tags: ["brep"],
    sourceCorpus: "synthetic",
  },

  // ---------- L1 / freeform_surfaces (2 new) ----------
  {
    id: "SURF-001",
    category: "freeform_surfaces",
    title: "Ergonomic mug handle (revolved spline)",
    prompt: "Coffee-mug handle: ergonomic loop, max outer width 80 mm, inner finger clearance 35 × 25 mm, cross-section a smooth-rounded rectangle 12 × 8 mm with R3 mm fillets on all four corners. G2-continuous everywhere. Single watertight solid.",
    spec: {
      shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.10,
      features: ["g2_continuous_section"],
    },
    difficulty: 3,
    groundTruthHash: "4cb1ee01a07710fa",
    humanBaselineMin: 14,
    tags: ["freeform", "consumer"],
    sourceCorpus: "drawn-by-panel",
  },
  {
    id: "SURF-007",
    category: "freeform_surfaces",
    title: "Mouse top-shell (Class-A)",
    prompt: "Computer-mouse top shell: 110 × 65 mm footprint, 38 mm peak height, two scroll-wheel cutouts 20 × 6 mm symmetric about the centerline 30 mm from the back. Class-A: G2 across the entire shell, max curvature deviation < 1 mm⁻¹.",
    spec: {
      shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.10,
      features: ["g2_class_a", "scroll_cutout_x2"],
    },
    difficulty: 5,
    groundTruthHash: "1a2b03c0fde901ee",
    humanBaselineMin: 35,
    tags: ["freeform", "consumer", "thin-wall"],
    sourceCorpus: "drawn-by-panel",
  },

  // ---------- L2 / parametric_mech (4 new) ----------
  {
    id: "MECH-002",
    category: "parametric_mech",
    title: "Bearing block — two 6204 deep-groove bearings",
    prompt: "Bearing block to house two SKF 6204 bearings (Ø 47 OD, Ø 20 ID, 14 mm wide) on a common axis 60 mm apart on centres. Block envelope 80 × 50 × 40 mm. Two M5 mounting bolts on a 70 × 30 mm rectangle, through-hole with 8 × 1 mm counter-bores. Bearing seats Ø 47 H7 with 0.5 × 45° lead-in chamfer.",
    spec: {
      shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.05,
      features: ["bearing_seat_47H7_x2", "M5_clearance_x2", "counterbore_8x1"],
      namedDimensions: [
        { name: "seat_dia", nominalMm: 47, toleranceMm: 0.025 },
        { name: "bearing_pitch", nominalMm: 60, toleranceMm: 0.05 },
      ],
      gdtCallouts: [{ type: "concentric", datum: "A", toleranceMm: 0.02 }],
    },
    difficulty: 4,
    groundTruthHash: "a4f001bedc20cf91",
    humanBaselineMin: 18,
    tags: ["mechanical", "automotive", "high-precision"],
    sourceCorpus: "grabcad-curated",
  },
  {
    id: "MECH-005",
    category: "parametric_mech",
    title: "Cam-follower lever (eccentric pivot)",
    prompt: "Lever 110 mm long: pivot bore Ø 8 H7 at one end, follower roller pin bore Ø 6 H7 at the other end. Eccentric pivot at 32 mm from the load end, lever thickness 6 mm, web fillet R 4 mm on both faces. Two outer profile cusps R 8 mm. Output STEP.",
    spec: {
      shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.05,
      features: ["bore_H7_8", "bore_H7_6", "fillet_R4"],
      namedDimensions: [
        { name: "lever_length", nominalMm: 110, toleranceMm: 0.10 },
        { name: "pivot_offset", nominalMm: 32, toleranceMm: 0.05 },
      ],
      gdtCallouts: [{ type: "position", datum: "A|B", toleranceMm: 0.05 }],
    },
    difficulty: 3,
    groundTruthHash: "fe22ac01bdc40e90",
    humanBaselineMin: 14,
    tags: ["mechanical", "automotive"],
    sourceCorpus: "grabcad-curated",
  },
  {
    id: "MECH-018",
    category: "parametric_mech",
    title: "Heat-set insert boss array (4× M3)",
    prompt: "Plate 60 × 60 × 8 mm with four heat-set-insert bosses on a 40 × 40 mm square pitch. Each boss: outer Ø 6.5 mm, inner Ø 4.5 mm × 6 mm deep, 0.5 × 30° lead-in chamfer at the top. Conform to McMaster 94459A205 insert spec.",
    spec: {
      shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.05,
      features: ["heatset_boss_x4", "lead_in_chamfer_x4"],
      namedDimensions: [
        { name: "boss_outer", nominalMm: 6.5, toleranceMm: 0.10 },
        { name: "insert_bore", nominalMm: 4.5, toleranceMm: 0.05 },
        { name: "insert_depth", nominalMm: 6, toleranceMm: 0.10 },
      ],
    },
    difficulty: 3,
    groundTruthHash: "10ae9f0bcd220e31",
    humanBaselineMin: 8,
    tags: ["mechanical", "consumer", "thin-wall"],
    sourceCorpus: "grabcad-curated",
  },
  {
    id: "MECH-031",
    category: "parametric_mech",
    title: "Threaded cap with diamond knurl",
    prompt: "Cylindrical cap Ø 35 × 18 mm tall, internal M30 × 1.5 thread depth 14 mm, exterior diamond knurl pitch 0.8 mm, knurl height 0.3 mm, covering the central 12 mm of the height. Top face flat, bottom face open. ISO 261 thread tolerance 6H.",
    spec: {
      shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.05,
      features: ["thread_M30x1.5", "knurl_diamond_0.8"],
      standardRef: "ISO 261",
    },
    difficulty: 5,
    groundTruthHash: "7caf01eb22ddc041",
    humanBaselineMin: 25,
    tags: ["mechanical", "consumer"],
    sourceCorpus: "drawn-by-panel",
    notes: "Knurls are the canonical 'looks easy, isn't' surface — most LLMs emit a flat texture map, not actual geometric ridges.",
  },

  // ---------- L2 / assembly_mating (3 new) ----------
  {
    id: "ASM-001",
    category: "assembly_mating",
    title: "Threaded coupling M16×1.5 (male+female pair)",
    prompt: "Two-piece threaded coupling. Male: Ø 16 × 30 mm long with M16×1.5 6g external thread, hex Ø 22 across-flats × 8 mm tall. Female: Ø 24 × 25 mm with M16×1.5 6H internal thread depth 22 mm, hex Ø 22. The pair must thread together a full 18 mm with no interference.",
    spec: {
      matingPart: "/refs/ASM-001-female.step",
      expectedClearanceMm: { min: 0.0, max: 0.4 },
      shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.02,
      standardRef: "ISO 261",
      fitClass: "H7/h6",
    },
    difficulty: 4,
    groundTruthHash: "33ce1d0bc09f01ea",
    humanBaselineMin: 18,
    tags: ["assembly", "mechanical", "high-precision"],
    sourceCorpus: "synthetic",
  },
  {
    id: "ASM-008",
    category: "assembly_mating",
    title: "Spline shaft + hub (DIN 5480 W25×1.25×18)",
    prompt: "Involute spline pair per DIN 5480 W 25 × 1.25 × 18: shaft and hub, 18 teeth, module 1.25, pressure angle 30°. Engagement length 22 mm. Resultant assembled clearance 0.04–0.10 mm normal to flank. Output one assembly STEP.",
    spec: {
      matingPart: "/refs/ASM-008-hub.step",
      expectedClearanceMm: { min: 0.04, max: 0.10 },
      shellCount: 2, watertight: true, manifold: true, toleranceMm: 0.01,
      standardRef: "DIN 5480",
      features: ["spline_18T_m1.25"],
    },
    difficulty: 5,
    groundTruthHash: "82bd03c0ef4a1100",
    humanBaselineMin: 32,
    tags: ["assembly", "automotive", "high-precision"],
    sourceCorpus: "grabcad-curated",
  },
  {
    id: "ASM-013",
    category: "assembly_mating",
    title: "Bayonet quarter-turn mount",
    prompt: "Quarter-turn bayonet: outer ring Ø 30 mm with three lugs 4 × 3 mm at 0/120/240°, inner sleeve Ø 30.2 mm with matching slots. After 90° clockwise rotation the lugs must seat with axial clearance 0.10 ± 0.04 mm. Output assembly STEP showing the engaged state.",
    spec: {
      matingPart: "/refs/ASM-013-sleeve.step",
      expectedClearanceMm: { min: 0.06, max: 0.14 },
      shellCount: 2, watertight: true, manifold: true, toleranceMm: 0.02,
      features: ["bayonet_lug_x3"],
    },
    difficulty: 4,
    groundTruthHash: "16fb2e0d3c9011aa",
    humanBaselineMin: 22,
    tags: ["assembly", "consumer"],
    sourceCorpus: "drawn-by-panel",
  },

  // ---------- L2 / standards_compliance (3 new) ----------
  {
    id: "STD-001",
    category: "standards_compliance",
    title: "ISO 7050 self-tapping screw ST4.2 × 16",
    prompt: "Cross-recessed countersunk-head self-tapping screw per ISO 7050: nominal Ø 4.2 mm, length 16 mm, recess type H (Phillips #2). Form C (sharp point). Conform to ISO 1478 thread pitch.",
    spec: {
      shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.04,
      standardRef: "ISO 7050",
      features: ["ph_recess_H2", "self_tap_thread_form_C"],
      namedDimensions: [
        { name: "thread_dia", nominalMm: 4.2, toleranceMm: 0.04 },
        { name: "head_dia_max", nominalMm: 8.4, toleranceMm: 0.10 },
        { name: "length", nominalMm: 16, toleranceMm: 0.30 },
      ],
    },
    difficulty: 4,
    groundTruthHash: "9a01ef02ba3c0011",
    humanBaselineMin: 22,
    tags: ["standards", "consumer"],
    sourceCorpus: "synthetic",
  },
  {
    id: "STD-005",
    category: "standards_compliance",
    title: "ISO 8734 dowel pin Ø6 m6 × 30",
    prompt: "Cylindrical dowel pin per ISO 8734 type A: Ø 6 m6 (+0.012 / +0.004), length 30 mm, both ends spherically radiused R 0.6 mm. Surface finish Ra ≤ 0.4 µm.",
    spec: {
      shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.005,
      standardRef: "ISO 8734",
      fitClass: "H7/p6",
      namedDimensions: [
        { name: "pin_dia", nominalMm: 6.008, toleranceMm: 0.004 },
        { name: "pin_length", nominalMm: 30, toleranceMm: 0.10 },
        { name: "end_radius", nominalMm: 0.6, toleranceMm: 0.05 },
      ],
    },
    difficulty: 3,
    groundTruthHash: "00b41ef02ac9d301",
    humanBaselineMin: 6,
    tags: ["standards", "high-precision"],
    sourceCorpus: "synthetic",
  },
  {
    id: "STD-008",
    category: "standards_compliance",
    title: "ASME B18.6.3 button-head 1/4-20 × 5/8",
    prompt: "Button-head cap screw per ASME B18.6.3: 1/4-20 UNC × 5/8″ long, head Ø 0.437″, head height 0.142″, hex socket 5/32″ across-flats. Property class 18-8 stainless. Output dimensions in mm internally.",
    spec: {
      shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.10,
      standardRef: "ASME B18.6.3",
      features: ["unc_1/4-20_thread", "hex_socket_5/32"],
    },
    difficulty: 4,
    groundTruthHash: "13af0bd9c20efa11",
    humanBaselineMin: 25,
    tags: ["standards"],
    sourceCorpus: "synthetic",
  },

  // ---------- L2 / sheet_metal (2 new) ----------
  {
    id: "SHEET-001",
    category: "sheet_metal",
    title: "Box-pan with corner relief cuts",
    prompt: "Box-pan from 1.0 mm Al-5052: outside 100 × 80 × 30 mm tall, four bend radii 1.5 mm inside, k-factor 0.40. Internal corners must have ⌽ 1.5 mm relief drills offset 1 mm into the flange. Output folded body and unfolded flat pattern.",
    spec: {
      shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.10,
      uniformThicknessMm: 1.0,
      process: "sheet-metal",
      features: ["bend_x4", "relief_corner_x4"],
    },
    difficulty: 4,
    groundTruthHash: "08fa1cb12c9e0011",
    humanBaselineMin: 18,
    tags: ["sheet-metal", "machining-heavy"],
    sourceCorpus: "drawn-by-panel",
  },
  {
    id: "SHEET-007",
    category: "sheet_metal",
    title: "3-bend electronics chassis",
    prompt: "U-shaped electronics chassis from 1.5 mm Al-5052, three 90° bends, internal volume 200 × 120 × 60 mm. Two louvered vent slots 60 × 8 mm on each long side, six M3 PEM nut clearance holes (Ø 4.2) on the base. Bend radius 1.5 mm, k-factor 0.40.",
    spec: {
      shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.10,
      uniformThicknessMm: 1.5,
      process: "sheet-metal",
      features: ["bend_x3", "louver_x4", "PEM_M3_clearance_x6"],
    },
    difficulty: 4,
    groundTruthHash: "4cb01ef02d3a0091",
    humanBaselineMin: 28,
    tags: ["sheet-metal", "consumer"],
    sourceCorpus: "drawn-by-panel",
  },

  // ---------- L2 / sealing_grooves (2 new) ----------
  {
    id: "SEAL-004",
    category: "sealing_grooves",
    title: "AS568-218 piston-type radial groove",
    prompt: "Piston-side radial groove for an AS568-218 O-ring (Ø 1.484 in × 0.139 in cross-section). Sealed pressure 21 MPa hydraulic, dynamic. Apply 12-17 % squeeze, 60-85 % groove fill. Output the piston with the groove cut into its OD.",
    spec: {
      shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.05,
      standardRef: "AS568-218",
      features: ["groove_AS568-218_piston"],
    },
    difficulty: 4,
    groundTruthHash: "ae0bf01dc20a91ee",
    humanBaselineMin: 12,
    tags: ["sealing", "automotive", "high-precision"],
    sourceCorpus: "drawn-by-panel",
  },
  {
    id: "SEAL-007",
    category: "sealing_grooves",
    title: "ISO 3601-2 quad-ring face groove",
    prompt: "Face-seal groove for an ISO 3601-2 quad-ring, nominal ID 25 mm, cross-section 3.0 mm. Static seal, low pressure (≤ 1 MPa). Standard squeeze 18-22 %, groove width 4.0 ± 0.05 mm.",
    spec: {
      shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.05,
      standardRef: "ISO 3601-2",
      features: ["quad_ring_groove_25"],
    },
    difficulty: 3,
    groundTruthHash: "1bcd01ef0a3c2200",
    humanBaselineMin: 9,
    tags: ["sealing", "consumer"],
    sourceCorpus: "synthetic",
  },

  // ---------- L2 / kinematic_mechanisms (2 new) ----------
  {
    id: "KIN-005",
    category: "kinematic_mechanisms",
    title: "Geneva drive — 4 station",
    prompt: "External Geneva drive: driver crank Ø 50 mm with one Ø 6 mm pin on a 20 mm radius, driven wheel 4 stations with 90° indexing slots. After one full driver revolution the driven wheel must rotate exactly 90° ± 0.05° with no interpenetration during the dwell.",
    spec: {
      matingPart: "/refs/KIN-005-fixture.step",
      shellCount: 2, watertight: true, manifold: true, toleranceMm: 0.05,
      features: ["geneva_slot_x4", "driver_pin"],
    },
    difficulty: 5,
    groundTruthHash: "9001fe2bc0aa3411",
    humanBaselineMin: 35,
    tags: ["kinematics", "automotive", "high-precision"],
    sourceCorpus: "grabcad-curated",
  },
  {
    id: "KIN-008",
    category: "kinematic_mechanisms",
    title: "Planetary gearset full mesh (sun + 3 planets + ring)",
    prompt: "Planetary gear stack: module 1.5, sun 21T, planets 21T (×3), ring 63T, all 20° pressure angle, face width 8 mm, ISO 53 profile. Carrier plate Ø 110 × 4 mm. The full stack must mesh — no tooth interference, planet teeth align with sun and ring simultaneously. Output assembly STEP.",
    spec: {
      shellCount: 5, watertight: true, manifold: true, toleranceMm: 0.02,
      standardRef: "ISO 53",
      features: ["sun_21T", "planet_21T_x3", "ring_63T", "carrier"],
    },
    difficulty: 5,
    groundTruthHash: "44ec01ef0bc20e11",
    humanBaselineMin: 60,
    tags: ["kinematics", "automotive", "high-precision", "machining-heavy"],
    sourceCorpus: "grabcad-curated",
  },

  // ---------- L3 / dfm_cnc (3 new) ----------
  {
    id: "DFMCNC-005",
    category: "dfm_cnc",
    title: "4-pocket plate, R 0.5 internal corners",
    prompt: "Aluminium plate 100 × 100 × 10 mm with four rectangular pockets (35 × 35 × 5 mm deep) on a 2×2 grid, internal corner radius R 0.5 mm. Must be machinable on a 3-axis VMC with a Ø 1 mm endmill at the corners and Ø 6 mm for bulk removal.",
    spec: {
      shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.05,
      process: "cnc-3ax",
      features: ["pocket_x4", "internal_R0.5"],
    },
    difficulty: 3,
    groundTruthHash: "7d01ef02a3cb0011",
    humanBaselineMin: 12,
    tags: ["dfm", "machining-heavy"],
    sourceCorpus: "grabcad-curated",
  },
  {
    id: "DFMCNC-009",
    category: "dfm_cnc",
    title: "Long-aspect bracket (vise-fixturable)",
    prompt: "Mounting bracket 200 × 25 × 12 mm with three Ø 6.6 mm clearance holes on the back face and a 50 × 12 mm slot on the front. The part must be fixturable in a 6″ vise jaws (i.e. flat parallel sides ≥ 25 × 100 mm). 3-axis CNC machinable in two setups maximum.",
    spec: {
      shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.10,
      process: "cnc-3ax",
      features: ["clearance_hole_x3", "slot_50x12"],
    },
    difficulty: 3,
    groundTruthHash: "01eba0fde2c01100",
    humanBaselineMin: 8,
    tags: ["dfm", "mechanical"],
    sourceCorpus: "grabcad-curated",
  },
  {
    id: "DFMCNC-013",
    category: "dfm_cnc",
    title: "5-axis-only fish-mouth saddle",
    prompt: "Bracket meant to wrap a Ø 60 mm pipe at 35° from vertical: a saddle cut profile that is the swept silhouette of a Ø 60 mm cylinder along the pipe axis, depth 25 mm. Geometry should be flagged as 'requires 5-axis indexing' by the analyzer (3-axis cannot reach the underside).",
    spec: {
      shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.10,
      process: "cnc-5ax",
      features: ["fish_mouth_saddle"],
    },
    difficulty: 4,
    groundTruthHash: "a32ef0bcde011fa0",
    humanBaselineMin: 18,
    tags: ["dfm", "machining-heavy", "aerospace"],
    sourceCorpus: "drawn-by-panel",
  },

  // ---------- L3 / dfm_mold (1 new) ----------
  {
    id: "DFMMOLD-005",
    category: "dfm_mold",
    title: "Telephone handset shell",
    prompt: "Lower handset shell, 180 × 60 × 22 mm. Parting plane is the largest XY silhouette. Min draft 1.5° on every wall, uniform 1.8 mm wall ±10 %, four self-tapping bosses Ø 5 OD / Ø 2.5 core, mic and speaker mesh openings 12 × 8 mm slot arrays.",
    spec: {
      shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.10,
      process: "injection",
      uniformThicknessMm: 1.8,
      draftMinDeg: 1.5,
      minWallMm: 1.8,
      features: ["draft_1.5deg_min", "wall_1.8mm_uniform", "boss_x4", "slot_array"],
    },
    difficulty: 5,
    groundTruthHash: "0ec1bd0a02fe1011",
    humanBaselineMin: 45,
    tags: ["dfm", "consumer", "thin-wall"],
    sourceCorpus: "drawn-by-panel",
  },

  // ---------- L3 / dfm_fdm (2 new) ----------
  {
    id: "DFMFDM-002",
    category: "dfm_fdm",
    title: "Bridge-test calibration cube",
    prompt: "Calibration test piece for a 0.4 mm nozzle FDM printer: 40 × 40 × 30 mm with four horizontal bridges of length 5/10/15/20 mm at z=22 mm, each bridge cross-section 4 × 2 mm. Bridges must be unsupported but printable.",
    spec: {
      shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.10,
      process: "fdm",
      minWallMm: 1.6,
      features: ["bridge_5", "bridge_10", "bridge_15", "bridge_20"],
    },
    difficulty: 3,
    groundTruthHash: "fea11bc0d2ef0b01",
    humanBaselineMin: 8,
    tags: ["dfm", "consumer", "open-source-corpus"],
    sourceCorpus: "synthetic",
  },
  {
    id: "DFMFDM-011",
    category: "dfm_fdm",
    title: "Print-in-place hinge",
    prompt: "Two-leaf hinge that prints in one piece without supports: each leaf 40 × 30 × 3 mm, knuckle Ø 6 mm with a Ø 4 mm pin captive in a 0.3 mm clearance bore. Clearance must allow free 90° rotation post-print on a 0.4 mm nozzle FDM machine.",
    spec: {
      shellCount: 2, watertight: true, manifold: true, toleranceMm: 0.10,
      process: "fdm",
      minWallMm: 1.2,
      features: ["captive_pin", "knuckle_x2"],
    },
    difficulty: 4,
    groundTruthHash: "33ce01bd02ef0a91",
    humanBaselineMin: 16,
    tags: ["dfm", "consumer"],
    sourceCorpus: "drawn-by-panel",
  },

  // ---------- L3 / cam_validity (1 new) ----------
  {
    id: "CAM-005",
    category: "cam_validity",
    title: "T-slot pocket array (Ø 8 + Ø 4 endmills)",
    prompt: "Plate 80 × 80 × 14 mm with three parallel T-slots (top width 12 mm, bottom width 16 mm, total depth 10 mm, length 60 mm) on 25 mm pitch. The T-slot bottom must be machinable with a Ø 4 mm endmill on a 3-axis VMC (i.e. all undercuts reachable).",
    spec: {
      shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.05,
      process: "cnc-3ax",
      features: ["t_slot_x3"],
    },
    difficulty: 4,
    groundTruthHash: "be01fc02d3a09e11",
    humanBaselineMin: 16,
    tags: ["dfm", "machining-heavy"],
    sourceCorpus: "drawn-by-panel",
  },

  // ---------- L4 / constraint_solving (1 new) ----------
  {
    id: "PARAM-009",
    category: "constraint_solving",
    title: "Configurable bottle (height + cap params)",
    prompt: "Cylindrical bottle Ø 70 mm × H mm tall, ending in a M40 × 1.0 threaded neck of length C mm. Build it once at H = 180, C = 22, then expose H and C as parameters. We will sweep H ∈ [120, 220] and C ∈ [16, 30] and re-evaluate.",
    spec: {
      shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.10,
      paramRange: [
        { name: "H", min: 120, max: 220, samples: 20 },
        { name: "C", min: 16, max: 30, samples: 10 },
      ],
      edits: [
        { param: "H", from: 180, to: 200, expectedDeltaVolMm3: Math.PI * 35 * 35 * 20 },
        { param: "C", from: 22, to: 28, expectedDeltaVolMm3: Math.PI * 20 * 20 * 6 },
      ],
    },
    difficulty: 4,
    groundTruthHash: "31cba0fde20cb011",
    humanBaselineMin: 14,
    tags: ["parametric", "consumer"],
    sourceCorpus: "drawn-by-panel",
  },

  // ---------- L4 / reverse_eng (1 new) ----------
  {
    id: "REVENG-005",
    category: "reverse_eng",
    title: "ABC dataset stepped pulley (multi-view)",
    prompt: "From the supplied front/top/side ortho drawing (1:1, 600 dpi) reproduce the stepped V-belt pulley. Three steps, OD 80 / 60 / 40 mm, each 12 mm wide; belt grooves 38° included angle, depth 10 mm. Central Ø 16 H7 bore. All dimensions on the drawing are authoritative.",
    spec: {
      shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.10,
      features: ["step_pulley_x3", "v_groove_x3", "bore_H7_16"],
    },
    difficulty: 4,
    groundTruthHash: "c0a1b3d40fe201bc",
    referenceMesh: "/refs/REVENG-005.glb",
    humanBaselineMin: 22,
    tags: ["reverse-engineering", "automotive", "open-source-corpus"],
    sourceCorpus: "abc-dataset",
  },

  // ---------- L4 / sketch_constraints (1 new) ----------
  {
    id: "SKETCH-014",
    category: "sketch_constraints",
    title: "Symmetric four-bar profile",
    prompt: "Closed planar profile, mirror-symmetric about the Y axis: two horizontal segments 80 mm long at y = 0 and y = 40, joined by two semicircular arcs R 20 mm. Constraints: horizontal+horizontal, equal-length, tangent at every endpoint, mirror symmetry. Sketch must be fully constrained (DOF = 0).",
    spec: {
      toleranceMm: 0.001,
    },
    difficulty: 2,
    groundTruthHash: "4ec01fde2cb0a911",
    humanBaselineMin: 5,
    tags: ["sketch", "open-source-corpus"],
    sourceCorpus: "synthetic",
  },

  // ---------- L4 / functional_intent (1 new) ----------
  {
    id: "FUNC-003",
    category: "functional_intent",
    title: "Heat-sink for 60 W CoB LED",
    prompt: "Design a passive heat sink in 6063-T5 aluminium that holds a 60 W CoB LED below 85 °C junction temperature in still air at 30 °C ambient. LED footprint Ø 22 mm, mounting requires three M3 holes on a 28 mm PCD. Footprint envelope ≤ 80 × 80 mm, height ≤ 50 mm. Output STEP.",
    spec: {
      shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.10,
      feaMaterial: "6063-T5",
      features: ["LED_mount_M3_x3", "fin_array"],
    },
    difficulty: 5,
    groundTruthHash: "fab02ec01dd30a11",
    humanBaselineMin: 38,
    tags: ["functional", "consumer", "thin-wall"],
    sourceCorpus: "drawn-by-panel",
    notes: "Functional intent task — scoring is FEA/CFD-gated, not geometric. A part with vol_iou ≈ 1 to the reference can still fail if the surface area is < 0.04 m².",
  },

  // ---------- L4 / paraphrase_robustness (1 new) ----------
  {
    id: "PARA-005",
    category: "paraphrase_robustness",
    title: "5× paraphrased planetary carrier",
    prompt: "Disc Ø 80 × 8 mm with central Ø 12 H7 bore, three Ø 6 H7 satellite bores on a 30 mm PCD at 0/120/240°, six M3 tapped holes on a 60 mm PCD at 30° offset.",
    spec: {
      shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.05,
      paraphrases: [
        "Build a circular plate 80 mm diameter, 8 mm thick. Centre hole 12 mm reamed. Three 6 mm reamed holes equally spaced on a 30 mm bolt circle. Six M3 tapped holes on a 60 mm circle, offset 30° from the others.",
        "Carrier disc: OD 80, thickness 8. One Ø 12 H7 in the centre. Three Ø 6 H7 bores at 0°/120°/240° on a 30 mm pitch-circle. Six M3 threaded holes on a 60 mm pitch-circle, 30° offset.",
        "Round plate, 80 across, 8 thick. Bore the middle to 12 mm (precision). Drill three 6 mm holes evenly around at 30 mm radius/2. Tap six M3 holes at 60 mm radius/2, halfway between the others.",
        "Planetary carrier — 80 × 8 disc. Central H7 bore Ø 12. Three satellite bores Ø 6 H7 at PCD 30, equispaced. Six M3 threads at PCD 60, 30° apart from the satellites.",
      ],
    },
    difficulty: 4,
    groundTruthHash: "2b97cc4d1ef0aa55",
    humanBaselineMin: 0,
    tags: ["robustness", "open-source-corpus"],
    sourceCorpus: "synthetic",
    notes: "Reference geometry is identical to MECH-027; this task evaluates paraphrase variance, not modelling skill.",
  },

  // ---------- L4 / calibration (1 new) ----------
  {
    id: "CAL-007",
    category: "calibration",
    title: "Confidence-bracketed mounting flange",
    prompt: "Cast-aluminium mounting flange, Ø 120 × 18 mm with central Ø 30 H7 bore and 6× M8 clearance holes on a 90 mm PCD. Report a self-assessed pre-generation confidence ∈ [0,1] in your output's correctness against the spec.",
    spec: {
      shellCount: 1, watertight: true, manifold: true, toleranceMm: 0.10,
      features: ["bore_H7_30", "M8_clearance_x6", "PCD_90"],
      gdtCallouts: [{ type: "concentric", datum: "A", toleranceMm: 0.05 }],
    },
    difficulty: 3,
    groundTruthHash: "ad01ef02b3c40911",
    humanBaselineMin: 9,
    tags: ["calibration", "mechanical"],
    sourceCorpus: "synthetic",
  },
];

export const taskById = (id: string) => TASKS.find((t) => t.id === id);
