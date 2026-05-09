import fs from "node:fs/promises";
import path from "node:path";

// Spline AI — 3D asset diffusion. Outputs a mesh. Included as a non-CAD
// baseline; STEP round-trip and BREP-fidelity tasks score 0 by definition.
export async function runSpline(prompt: string, outDir: string, _seed: number) {
  const key = process.env.SPLINE_API_KEY;
  if (!key) throw new Error("SPLINE_API_KEY missing");
  const r = await fetch("https://api.spline.design/v1/ai/generate", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ prompt, format: "glb" }),
  });
  if (!r.ok) throw new Error(`spline ${r.status}`);
  const glb = Buffer.from(await r.arrayBuffer());
  const artifactPath = path.join(outDir, "model.glb");
  await fs.writeFile(artifactPath, glb);
  return { artifactPath, format: "GLB" as const, costUsd: 0.04 };
}
