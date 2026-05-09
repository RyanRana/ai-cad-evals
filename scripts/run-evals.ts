/**
 * CAD-Bench v0.5 reference runner.
 *
 * Executes the registered task suite against any subset of agents and writes
 * a JSONL run sheet identical in shape to lib/types.ts:RunResult.
 *
 * v0.5 adds:
 *   - per-task metric activation: the full task spec is handed to score.py,
 *     which only computes the metrics declared in the spec.
 *   - parametric robustness sweep: for tasks with `paramRange` or `edits`
 *     and adapters that emit a script (CadQuery / OpenSCAD), the runner
 *     calls scripts/scoring/param_sweep.py to substitute parameters and
 *     re-render. Results merge into RunResult.metrics.
 *   - paraphrase loop: PARA-* tasks expand into N variants (canonical +
 *     spec.paraphrases). Each variant runs as a separate seed so the
 *     aggregator can compute variance.
 *   - end-of-sweep aggregate: variance / calibration / latency / cost
 *     metrics that are only meaningful across runs are written alongside
 *     the JSONL as <sweep>.summary.json by aggregate.py.
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
 *   OPENSCAD_BIN               openscad binary (defaults to "openscad")
 *
 * Scoring: artifacts and (optionally) source scripts are written under
 * runs/<sweep>/<agent>/<task>-s<seed>/. scripts/scoring/score.py reads
 * the per-task JSON spec from that directory and emits the metric block.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { TASKS } from "../lib/data/tasks";
import { AGENTS } from "../lib/data/agents";
import type { RunResult, Task } from "../lib/types";

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
  scriptPath?: string;
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
  const skipAggregate = !!arg("no-aggregate");
  const skipParamSweep = !!arg("no-param-sweep");
  const sweepDir = path.join("runs", path.basename(out, ".jsonl"));
  await fs.mkdir(sweepDir, { recursive: true });

  const fh = await fs.open(out, "w");
  let completed = 0;

  // Pre-compute the run plan — paraphrase tasks expand into N variants.
  const plan: { agentId: string; task: Task; seed: number; prompt: string; variantTag?: string }[] = [];
  for (const agentId of agentIds) {
    if (!ADAPTERS[agentId]) {
      console.warn(`[skip] no adapter registered for ${agentId}`);
      continue;
    }
    for (const taskId of taskIds) {
      const task = TASKS.find((t) => t.id === taskId);
      if (!task) {
        console.warn(`[skip] no task ${taskId}`);
        continue;
      }
      const variants = paraphraseVariants(task);
      for (let seed = 1; seed <= seeds; seed++) {
        if (variants) {
          variants.forEach((v, vi) => {
            plan.push({ agentId, task, seed: seed * 100 + vi, prompt: v.prompt, variantTag: v.tag });
          });
        } else {
          plan.push({ agentId, task, seed, prompt: task.prompt });
        }
      }
    }
  }

  for (const item of plan) {
    const { agentId, task, seed, prompt, variantTag } = item;
    const t0 = performance.now();
    const tag = variantTag ? `-${variantTag}` : "";
    const outDir = path.join(sweepDir, agentId, `${task.id}-s${seed}${tag}`);
    await fs.mkdir(outDir, { recursive: true });

    const taskJsonPath = path.join(outDir, "task.json");
    await fs.writeFile(taskJsonPath, JSON.stringify(task));

    let adapterOut: AdapterOutput;
    try {
      adapterOut = await withTimeout(ADAPTERS[agentId](prompt, outDir, seed), 90_000);
    } catch (e) {
      adapterOut = { artifactPath: "", format: "STEP", error: (e as Error).message };
    }

    let metrics: RunResult["metrics"];
    if (adapterOut.error) {
      metrics = { vol_iou: 0, watertight: false, manifold: 0, pass_at_1: 0 };
    } else {
      metrics = await scoreArtifact(adapterOut.artifactPath, taskJsonPath);
      if (!skipParamSweep && adapterOut.scriptPath && taskNeedsParamSweep(task)) {
        const paramOut = path.join(outDir, "param_sweep.json");
        const tmp = path.join(outDir, "param_tmp");
        const paramMetrics = await runParamSweep(adapterOut.scriptPath, taskJsonPath, paramOut, tmp);
        Object.assign(metrics, paramMetrics);
      }
    }

    const result: RunResult = {
      agentId,
      taskId: task.id,
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
    const iouText = typeof metrics.vol_iou === "number" ? (metrics.vol_iou as number).toFixed(3) : "—";
    process.stdout.write(`\r[${completed}/${plan.length}] ${agentId}/${task.id}${tag} seed=${seed} ` +
      `${adapterOut.error ? "ERR" : `iou=${iouText}`}      `);
  }
  await fh.close();
  console.log(`\n→ wrote ${out}`);

  if (!skipAggregate) {
    const summaryPath = out.replace(/\.jsonl$/, ".summary.json");
    await runAggregate(out, summaryPath);
    console.log(`→ wrote ${summaryPath}`);
  }
}

function paraphraseVariants(task: Task): { prompt: string; tag: string }[] | null {
  const ps = task.spec?.paraphrases;
  if (!ps || ps.length === 0) return null;
  return [
    { prompt: task.prompt, tag: "p0" },
    ...ps.map((p, i) => ({ prompt: p, tag: `p${i + 1}` })),
  ];
}

function taskNeedsParamSweep(task: Task): boolean {
  return Boolean(task.spec?.paramRange?.length || task.spec?.edits?.length);
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
async function scoreArtifact(artifact: string, taskJsonPath: string) {
  const { spawn } = await import("node:child_process");
  return new Promise<RunResult["metrics"]>((resolve, reject) => {
    const child = spawn(
      "python3",
      ["scripts/scoring/score.py", "--artifact", artifact, "--task-json", taskJsonPath],
      { stdio: ["ignore", "pipe", "inherit"] },
    );
    let buf = "";
    child.stdout.on("data", (c) => (buf += c));
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(`scorer exited ${code}`));
      try { resolve(JSON.parse(buf)); } catch (e) { reject(e); }
    });
  });
}

async function runParamSweep(script: string, taskJsonPath: string, outJson: string, tmpDir: string) {
  const { spawn } = await import("node:child_process");
  return new Promise<Partial<RunResult["metrics"]>>((resolve) => {
    const child = spawn(
      "python3",
      [
        "scripts/scoring/param_sweep.py",
        "--script", script,
        "--task-json", taskJsonPath,
        "--out", outJson,
        "--tmp-dir", tmpDir,
      ],
      { stdio: ["ignore", "pipe", "inherit"] },
    );
    let buf = "";
    child.stdout.on("data", (c) => (buf += c));
    child.on("close", (code) => {
      if (code !== 0) return resolve({});
      try { resolve(JSON.parse(buf)); } catch { resolve({}); }
    });
  });
}

async function runAggregate(jsonl: string, summary: string) {
  const { spawn } = await import("node:child_process");
  return new Promise<void>((resolve) => {
    const child = spawn(
      "python3",
      ["scripts/scoring/aggregate.py", "--in", jsonl, "--out", summary],
      { stdio: ["ignore", "inherit", "inherit"] },
    );
    child.on("close", () => resolve());
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
