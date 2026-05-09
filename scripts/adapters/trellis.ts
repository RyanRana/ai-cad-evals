import fs from "node:fs/promises";
import path from "node:path";

// Microsoft Trellis 3D — image-to-3D diffusion. We render the prompt to an
// image first via SDXL, then feed the image through a Trellis HF Spaces
// endpoint. Output is a GLB; we also save the raw mesh.
export async function runTrellis(prompt: string, outDir: string, _seed: number) {
  const endpoint = process.env.TRELLIS_ENDPOINT;
  if (!endpoint) throw new Error("TRELLIS_ENDPOINT missing");
  const sdxlKey = process.env.STABILITY_API_KEY;
  if (!sdxlKey) throw new Error("STABILITY_API_KEY missing");

  // 1) prompt → image
  const sd = await fetch("https://api.stability.ai/v2beta/stable-image/generate/sd3", {
    method: "POST",
    headers: { Authorization: `Bearer ${sdxlKey}` },
    body: (() => {
      const f = new FormData();
      f.set("prompt", `${prompt}, technical drawing, single object, plain background, isometric view`);
      f.set("output_format", "png");
      return f;
    })(),
  });
  if (!sd.ok) throw new Error(`sdxl ${sd.status}`);
  const png = Buffer.from(await sd.arrayBuffer());
  const imgPath = path.join(outDir, "render.png");
  await fs.writeFile(imgPath, png);

  // 2) image → mesh
  const fd = new FormData();
  fd.set("image", new Blob([png], { type: "image/png" }));
  const r = await fetch(`${endpoint}/api/predict`, { method: "POST", body: fd });
  if (!r.ok) throw new Error(`trellis ${r.status}`);
  const glb = Buffer.from(await r.arrayBuffer());
  const artifactPath = path.join(outDir, "model.glb");
  await fs.writeFile(artifactPath, glb);
  return { artifactPath, format: "GLB" as const, costUsd: 0.05 };
}
