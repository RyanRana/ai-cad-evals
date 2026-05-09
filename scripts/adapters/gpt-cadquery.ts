import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

// GPT-5 → CadQuery pipeline. Mirrors the Claude adapter so the comparison
// is fair (same exemplars, same self-repair budget, same sandbox).
export async function runGptCadQuery(prompt: string, outDir: string, _seed: number) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY missing");

  const fewShot = await fs.readFile(path.join("scripts", "adapters", "cadquery_few_shot.md"), "utf-8");
  const system = `You are a CAD engineer that emits valid Python CadQuery 2.4 code. ${fewShot}\nReturn ONLY a python block. The script MUST end with cq.exporters.export(result, "model.step").`;

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: system },
    { role: "user", content: prompt },
  ];
  let totalIn = 0;
  let totalOut = 0;

  for (let attempt = 0; attempt < 4; attempt++) {
    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ model: "gpt-5", input: messages, max_output_tokens: 8000 }),
    });
    if (!resp.ok) throw new Error(`gpt ${resp.status}: ${await resp.text()}`);
    const j = (await resp.json()) as {
      output: { content: { type: string; text: string }[] }[];
      usage: { input_tokens: number; output_tokens: number };
    };
    totalIn += j.usage.input_tokens;
    totalOut += j.usage.output_tokens;
    const text = j.output[0].content.find((c) => c.type === "output_text" || c.type === "text")?.text ?? "";
    const code = text.match(/```python\s*([\s\S]*?)```/)?.[1] ?? text;
    const scriptPath = path.join(outDir, `attempt-${attempt}.py`);
    await fs.writeFile(scriptPath, code);
    const stepPath = path.join(outDir, "model.step");
    const r = await new Promise<{ ok: boolean; err: string }>((res) => {
      const c = spawn("python3", [scriptPath], { stdio: ["ignore", "pipe", "pipe"] });
      let err = "";
      c.stderr.on("data", (d) => (err += d.toString()));
      c.on("close", (code) => res({ ok: code === 0, err }));
      setTimeout(() => c.kill("SIGKILL"), 60_000);
    });
    if (r.ok) {
      const cost = (totalIn * 0.000010) + (totalOut * 0.000040);
      return { artifactPath: stepPath, scriptPath, format: "STEP" as const, tokensIn: totalIn, tokensOut: totalOut, costUsd: +cost.toFixed(4) };
    }
    messages.push({ role: "assistant", content: text });
    messages.push({ role: "user", content: `Execution failed:\n\n${r.err}\n\nReturn corrected python.` });
  }
  throw new Error("gpt+cadquery exceeded 4 self-repair attempts");
}
