import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

// DeepCAD (Wu et al. 2021) - research checkpoint. Generation runs through
// a local python wrapper that loads the official weights and emits a
// command sequence which we then bake into a STEP via OpenCascade.
export async function runDeepCad(prompt: string, outDir: string, seed: number) {
  const stepPath = path.join(outDir, "model.step");
  const r = await new Promise<{ ok: boolean; err: string }>((res) => {
    const c = spawn("python3", ["scripts/external/deepcad_wrapper.py", "--prompt", prompt, "--seed", String(seed), "--out", stepPath], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let err = "";
    c.stderr.on("data", (d) => (err += d.toString()));
    c.on("close", (code) => res({ ok: code === 0, err }));
    setTimeout(() => c.kill("SIGKILL"), 60_000);
  });
  if (!r.ok) throw new Error(`deepcad: ${r.err}`);
  await fs.access(stepPath);
  return { artifactPath: stepPath, format: "STEP" as const, costUsd: 0.02 };
}
