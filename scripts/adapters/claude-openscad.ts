import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

// Claude Opus 4.7 → OpenSCAD. Mirrors the Gemini adapter for direct comparison.
export async function runClaudeOpenScad(prompt: string, outDir: string, _seed: number) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY missing");

  const system = `You emit valid OpenSCAD 2024.06. Return ONLY a code block. Solid, manifold, watertight CSG.`;
  let messages: { role: "user" | "assistant"; content: string }[] = [{ role: "user", content: prompt }];
  let totalIn = 0;
  let totalOut = 0;

  for (let attempt = 0; attempt < 4; attempt++) {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "content-type": "application/json", "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-opus-4-7", max_tokens: 8000, system, messages }),
    });
    if (!resp.ok) throw new Error(`claude ${resp.status}: ${await resp.text()}`);
    const j = (await resp.json()) as {
      content: { type: string; text: string }[];
      usage: { input_tokens: number; output_tokens: number };
    };
    totalIn += j.usage.input_tokens;
    totalOut += j.usage.output_tokens;
    const text = j.content.find((c) => c.type === "text")?.text ?? "";
    const code = text.match(/```(?:openscad|scad)?\s*([\s\S]*?)```/)?.[1] ?? text;

    const scadPath = path.join(outDir, `attempt-${attempt}.scad`);
    const stlPath = path.join(outDir, "model.stl");
    await fs.writeFile(scadPath, code);
    const r = await new Promise<{ ok: boolean; err: string }>((res) => {
      const c = spawn("openscad", ["-o", stlPath, scadPath], { stdio: ["ignore", "pipe", "pipe"] });
      let err = "";
      c.stderr.on("data", (d) => (err += d.toString()));
      c.on("close", (code) => res({ ok: code === 0, err }));
      setTimeout(() => c.kill("SIGKILL"), 60_000);
    });
    if (r.ok) {
      const cost = (totalIn * 0.000015) + (totalOut * 0.000075);
      return { artifactPath: stlPath, format: "STL" as const, tokensIn: totalIn, tokensOut: totalOut, costUsd: +cost.toFixed(4) };
    }
    messages = [...messages, { role: "assistant", content: text }, { role: "user", content: `OpenSCAD failed:\n\n${r.err}\n\nReturn corrected scad.` }];
  }
  throw new Error("claude+openscad exceeded 4 attempts");
}
