import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

// Gemini 2.5 Pro → OpenSCAD pipeline. OpenSCAD has no BREP output, so the
// runner converts the .scad source into an STL via the system `openscad`
// binary. Self-repair budget = 3.
export async function runGeminiOpenScad(prompt: string, outDir: string, _seed: number) {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) throw new Error("GOOGLE_API_KEY missing");

  const sys = `You emit valid OpenSCAD 2024.06. Return ONLY a code block. End with no main module call required — top-level statements render. Aim for solid, manifold, watertight CSG.`;
  const messages: { role: "user" | "model"; parts: { text: string }[] }[] = [{ role: "user", parts: [{ text: prompt }] }];
  let totalIn = 0;
  let totalOut = 0;

  for (let attempt = 0; attempt < 4; attempt++) {
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${key}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ system_instruction: { parts: [{ text: sys }] }, contents: messages }),
    });
    if (!resp.ok) throw new Error(`gemini ${resp.status}: ${await resp.text()}`);
    const j = (await resp.json()) as {
      candidates: { content: { parts: { text: string }[] } }[];
      usageMetadata: { promptTokenCount: number; candidatesTokenCount: number };
    };
    totalIn += j.usageMetadata.promptTokenCount;
    totalOut += j.usageMetadata.candidatesTokenCount;
    const text = j.candidates[0].content.parts[0].text;
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
      const cost = (totalIn * 0.0000035) + (totalOut * 0.0000105);
      return { artifactPath: stlPath, scriptPath: scadPath, format: "STL" as const, tokensIn: totalIn, tokensOut: totalOut, costUsd: +cost.toFixed(4) };
    }
    messages.push({ role: "model", parts: [{ text }] });
    messages.push({ role: "user", parts: [{ text: `OpenSCAD failed:\n\n${r.err}\n\nReturn corrected scad.` }] });
  }
  throw new Error("gemini+openscad exceeded 4 attempts");
}
