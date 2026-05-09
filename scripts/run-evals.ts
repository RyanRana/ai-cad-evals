/**
 * CAD-Bench v0.4 reference runner.
 *
 * Executes the registered task suite against any subset of agents and writes
 * a JSONL run sheet identical in shape to lib/types.ts:RunResult. Designed
 * to be invoked from CI: a typical full sweep takes ~70 wall-clock minutes
 * on the agents listed in lib/data/agents.ts.
 *
 * Usage:
 *   tsx scripts/run-evals.ts --agents zoo-text-to-cad-2.4,claude-opus-4-7-cadquery \
 *                            --tasks PRIM-001,MECH-014 \
 *                            --seeds 5 --out runs/2026-04-12.jsonl
 *
 * Required env vars (only for the agents you exercise):
 *   ZOO_API_KEY                Zoo Text-to-CAD
 *   ADAM_API_KEY               CADcrush partner key
 *   ANTHROPIC_API_KEY          Claude pipelines
 *   OPENAI_API_KEY             GPT-5 pipelines
 *   GOOGLE_API_KEY             Gemini pipelines
 *   TRELLIS_ENDPOINT           HF Spaces or self-hosted
 *   SPLINE_API_KEY             Spline AI
 *
 * Scoring: artifacts are written to runs/<sweep>/<agent>/<task>.{step|stl}.
 * scripts/scoring/score.py consumes the artifacts + lib/data/tasks.ts to
 * produce the final RunResult.metrics block. Geometric metrics (IoU,
 * Chamfer, Hausdorff) use OpenCascade 7.8 + trimesh; BREP topology checks
 * use ShapeAnalysis_Wire.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { TASKS } from "../lib/data/tasks";
import { AGENTS } from "../lib/data/agents";
import type { RunResult } from "../lib/types";

import { runZoo } from "./adapters/zoo";
import { runAdam } from "./adapters/adam";
import { runClaudeCadQuery } from "./adapters/claude-cadquery";
import { runGptCadQuery } from "./adapters/gpt-cadquery";
import { runGeminiOpenScad } from "./adapters/gemini-openscad";
import { runClaudeOpenScad } from "./adapters/claude-openscad";
import { runDeepCad } from "./adapters/deepcad";
import { runTrellis } from "./adapters/trellis";
import { runSpline } from "./adapters/spline";

type AdapterOutput = {
  artifactPath: string;
  format: "STEP" | "STL" | "GLB" | "OpenSCAD" | "CadQuery";
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
  error?: string;
};

const ADAPTERS: Record<string, (prompt: string, outDir: string, seed: number) => Promise<AdapterOutput>> = {
  "zoo-text-to-cad-2.4": runZoo,
  "adam-cadcrush-1.1": runAdam,
  "claude-opus-4-7-cadquery": runClaudeCadQuery,
  "gpt-5-cadquery": runGptCadQuery,
  "gemini-2-5-pro-openscad": runGeminiOpenScad,
  "claude-opus-4-7-openscad": runClaudeOpenScad,
  "deepcad-2024": runDeepCad,
  "trellis-3d-1.0": runTrellis,
  "spline-ai-2.7": runSpline,
};

function arg(name: string, fallback?: string) {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  if (a) return a.split("=", 2)[1];
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

async function main() {
  const agentIds = (arg("agents") ?? AGENTS.filter((a) => a.id !== "human-mechE").map((a) => a.id).join(",")).split(",");
  const taskIds = arg("tasks") ? arg("tasks")!.split(",") : TASKS.map((t) => t.id);
  const seeds = parseInt(arg("seeds", "5")!);
  const out = arg("out", `runs/${new Date().toISOString().slice(0, 10)}.jsonl`)!;
  const sweepDir = path.join("runs", path.basename(out, ".jsonl"));
  await fs.mkdir(sweepDir, { recursive: true });

  const fh = await fs.open(out, "w");
  let completed = 0;
  const total = agentIds.length * taskIds.length * seeds;

  for (const agentId of agentIds) {
    const adapter = ADAPTERS[agentId];
    if (!adapter) {
      console.warn(`[skip] no adapter registered for ${agentId}`);
      continue;
    }
    for (const taskId of taskIds) {
      const task = TASKS.find((t) => t.id === taskId);
      if (!task) {
        console.warn(`[skip] no task ${taskId}`);
        continue;
      }
      for (let seed = 1; seed <= seeds; seed++) {
        const t0 = performance.now();
        const outDir = path.join(sweepDir, agentId, `${taskId}-s${seed}`);
        await fs.mkdir(outDir, { recursive: true });

        let adapterOut: AdapterOutput;
        try {
          adapterOut = await withTimeout(adapter(task.prompt, outDir, seed), 90_000);
        } catch (e) {
          adapterOut = { artifactPath: "", format: "STEP", error: (e as Error).message };
        }

        // Score the artifact (or record a failed run with all metrics = 0).
        const metrics = adapterOut.error
          ? { vol_iou: 0, watertight: false, manifold: 0, pass_at_1: 0, pass_at_5: 0 }
          : await scoreArtifact(adapterOut.artifactPath, task);

        const result: RunResult = {
          agentId,
          taskId,
          seed,
          timestamp: new Date().toISOString(),
          metrics,
          outputArtifact: adapterOut.artifactPath || undefined,
          outputFormat: adapterOut.format,
          tokensIn: adapterOut.tokensIn,
          tokensOut: adapterOut.tokensOut,
          costUsd: adapterOut.costUsd,
          latencyMs: Math.round(performance.now() - t0),
          error: adapterOut.error,
          judgedBy: "automatic",
        };
        await fh.write(JSON.stringify(result) + "\n");
        completed++;
        process.stdout.write(`\r[${completed}/${total}] ${agentId}/${taskId} seed=${seed} ` +
          `${adapterOut.error ? "ERR" : `iou=${(metrics.vol_iou as number).toFixed(3)}`}      `);
      }
    }
  }
  await fh.close();
  console.log(`\n→ wrote ${out}`);
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const race = new Promise<T>((_, rej) => (timer = setTimeout(() => rej(new Error(`adapter timeout @ ${ms}ms`)), ms)));
  try {
    return await Promise.race([p, race]);
  } finally {
    clearTimeout(timer!);
  }
}

/** Delegates to scripts/scoring/score.py via a child process. */
async function scoreArtifact(artifact: string, task: typeof TASKS[number]) {
  const { spawn } = await import("node:child_process");
  return new Promise<RunResult["metrics"]>((resolve, reject) => {
    const child = spawn("python3", ["scripts/scoring/score.py", "--artifact", artifact, "--task", task.id], {
      stdio: ["ignore", "pipe", "inherit"],
    });
    let buf = "";
    child.stdout.on("data", (c) => (buf += c));
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(`scorer exited ${code}`));
      try {
        resolve(JSON.parse(buf));
      } catch (e) {
        reject(e);
      }
    });
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
