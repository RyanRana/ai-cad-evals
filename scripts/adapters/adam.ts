import fs from "node:fs/promises";
import path from "node:path";

// CADcrush "Adam" partner endpoint. Returns Onshape FeatureScript export
// in STEP form. Closed beta — rate limited 60 req/h.
export async function runAdam(prompt: string, outDir: string, seed: number) {
  const key = process.env.ADAM_API_KEY;
  if (!key) throw new Error("ADAM_API_KEY missing");
  const r = await fetch("https://api.cadcrush.com/v1/generate", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ prompt, format: "step", seed, return_inline: true }),
  });
  if (!r.ok) throw new Error(`adam ${r.status}: ${await r.text()}`);
  const j = (await r.json()) as { step_b64: string };
  const artifactPath = path.join(outDir, "model.step");
  await fs.writeFile(artifactPath, Buffer.from(j.step_b64, "base64"));
  return { artifactPath, format: "STEP" as const, costUsd: 0.27 };
}
