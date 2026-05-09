import type { Agent } from "../types";

// Agents currently registered with the harness. Availability flags reflect
// whether the runner could obtain a valid API key on the most recent
// benchmark sweep (2026-04). Pricing is taken from each vendor's public
// rate card on that date.
export const AGENTS: Agent[] = [
  {
    id: "zoo-text-to-cad-2.4",
    name: "Zoo Text-to-CAD",
    vendor: "Zoo (KittyCAD)",
    runtime: "API",
    representation: "BREP",
    releaseDate: "2026-02-12",
    version: "2.4",
    notes:
      "Native BREP generator. Outputs valid AP242 STEP. Trained on the Zoo internal corpus + filtered GrabCAD. Endpoint: text-to-cad.zoo.dev/api.",
    license: "proprietary",
    available: true,
  },
  {
    id: "adam-cadcrush-1.1",
    name: "Adam (CADcrush)",
    vendor: "CADcrush",
    runtime: "API",
    representation: "BREP",
    releaseDate: "2025-11-04",
    version: "1.1",
    notes:
      "Closed-beta natural-language modeller; emits parametric Onshape FeatureScript export. Tested through partner key (rate-limited 60 req/h).",
    license: "proprietary",
    available: true,
  },
  {
    id: "claude-opus-4-7-cadquery",
    name: "Claude Opus 4.7 → CadQuery",
    vendor: "Anthropic + CadQuery 2.4",
    runtime: "LLM+CadQuery",
    representation: "CadQuery",
    releaseDate: "2026-01-22",
    version: "opus-4.7 + cadquery 2.4",
    paramsB: undefined,
    contextWindow: 1_000_000,
    costPer1kTok: { input: 0.015, output: 0.075 },
    notes:
      "Few-shot scaffold (8 exemplars from the OCC tutorial set), self-repair loop with up to 3 OCC error feedbacks. Executes in a Vercel Sandbox per call.",
    license: "proprietary",
    available: true,
  },
  {
    id: "gpt-5-cadquery",
    name: "GPT-5 → CadQuery",
    vendor: "OpenAI + CadQuery 2.4",
    runtime: "LLM+CadQuery",
    representation: "CadQuery",
    releaseDate: "2026-03-08",
    version: "gpt-5 + cadquery 2.4",
    contextWindow: 400_000,
    costPer1kTok: { input: 0.010, output: 0.040 },
    notes:
      "Same scaffold as the Claude pipeline for fair comparison. Self-repair budget capped at 3 attempts.",
    license: "proprietary",
    available: true,
  },
  {
    id: "gemini-2-5-pro-openscad",
    name: "Gemini 2.5 Pro → OpenSCAD",
    vendor: "Google + OpenSCAD 2024.06",
    runtime: "LLM+OpenSCAD",
    representation: "OpenSCAD",
    releaseDate: "2026-02-01",
    version: "2.5-pro + openscad 2024.06",
    contextWindow: 2_000_000,
    costPer1kTok: { input: 0.0035, output: 0.0105 },
    notes:
      "Mesh-only output (OpenSCAD does not produce BREP); STEP round-trip therefore disabled. CSG kernel: CGAL.",
    license: "proprietary",
    available: true,
  },
  {
    id: "claude-opus-4-7-openscad",
    name: "Claude Opus 4.7 → OpenSCAD",
    vendor: "Anthropic + OpenSCAD 2024.06",
    runtime: "LLM+OpenSCAD",
    representation: "OpenSCAD",
    releaseDate: "2026-01-22",
    version: "opus-4.7 + openscad 2024.06",
    contextWindow: 1_000_000,
    costPer1kTok: { input: 0.015, output: 0.075 },
    notes:
      "Same prompt template as the Gemini pipeline. Output is mesh-only.",
    license: "proprietary",
    available: true,
  },
  {
    id: "deepcad-2024",
    name: "DeepCAD",
    vendor: "Wu et al. 2021 (research)",
    runtime: "Diffusion-3D",
    representation: "BREP",
    releaseDate: "2024-11-30",
    version: "official checkpoint, retrained 2024-11",
    notes:
      "Transformer over CAD command sequences (extrude, revolve, sketch). Limited prompt vocabulary; we wrap with a Claude-3.5-mini paraphraser to convert natural prompts into the in-distribution token grammar.",
    license: "research",
    available: true,
  },
  {
    id: "trellis-3d-1.0",
    name: "Trellis 3D",
    vendor: "Microsoft Research",
    runtime: "Diffusion-3D",
    representation: "Mesh",
    releaseDate: "2024-12-15",
    version: "1.0 (image-to-3D)",
    notes:
      "Diffusion model over structured latents. Outputs a mesh only; STEP round-trip and BREP-fidelity tasks score 0 by definition.",
    license: "open",
    available: true,
  },
  {
    id: "spline-ai-2.7",
    name: "Spline AI",
    vendor: "Spline.design",
    runtime: "Diffusion-3D",
    representation: "Mesh",
    releaseDate: "2026-01-09",
    version: "2.7",
    notes:
      "Aimed at game/UX assets, not engineering CAD. Included as a non-CAD baseline to quantify the gap.",
    license: "proprietary",
    available: true,
  },
  {
    id: "human-mechE",
    name: "Human Baseline (Mech-E)",
    vendor: "n=4 senior engineers",
    runtime: "Human",
    representation: "BREP",
    releaseDate: "2026-04-01",
    version: "Onshape-2026-04",
    notes:
      "Four mechanical engineers (median 9 yrs CAD experience) modelled the same prompts in Onshape. Wall-clock time and tool cost ($/seat·hr) are recorded. Scores are inter-rater averaged.",
    license: "open",
    available: true,
  },
];

export const agentById = (id: string) => AGENTS.find((a) => a.id === id);
