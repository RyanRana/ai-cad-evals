import fs from "node:fs/promises";
import path from "node:path";

// Zoo Text-to-CAD adapter.
// Public API: https://text-to-cad.zoo.dev/api  (POST /file/conversation)
// Auth: Bearer ${ZOO_API_KEY}
// Returns AP242 STEP. Average completion ~6s on the v2.4 endpoint.
export async function runZoo(prompt: string, outDir: string, seed: number) {
  const key = process.env.ZOO_API_KEY;
  if (!key) throw new Error("ZOO_API_KEY missing");

  const submit = await fetch("https://api.zoo.dev/text-to-cad/conversations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ prompt, output_format: "step", seed }),
  });
  if (!submit.ok) throw new Error(`zoo submit ${submit.status}: ${await submit.text()}`);
  const { id } = (await submit.json()) as { id: string };

  // Poll until completion (max 90s).
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    const poll = await fetch(`https://api.zoo.dev/text-to-cad/conversations/${id}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!poll.ok) continue;
    const j = (await poll.json()) as { status: string; outputs?: Record<string, string>; error?: string };
    if (j.status === "completed" && j.outputs?.["model.step"]) {
      const stepBytes = Buffer.from(j.outputs["model.step"], "base64");
      const artifactPath = path.join(outDir, "model.step");
      await fs.writeFile(artifactPath, stepBytes);
      return { artifactPath, format: "STEP" as const, costUsd: 0.18 };
    }
    if (j.status === "failed") throw new Error(`zoo failed: ${j.error ?? "unknown"}`);
  }
  throw new Error("zoo timeout");
}
