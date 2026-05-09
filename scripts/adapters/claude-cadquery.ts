import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

// Claude Opus 4.7 → CadQuery pipeline.
// 1. Send the prompt + 8 few-shot CadQuery exemplars to Anthropic.
// 2. Strip the python block from the response.
// 3. Execute it in a subprocess that has cadquery 2.4 and OCC 7.8 imported.
// 4. Self-repair: if execution fails, feed the traceback back up to 3 times.
//
// Env: ANTHROPIC_API_KEY
//
// The exemplars and the system prompt live in scripts/adapters/cadquery_few_shot.md.
export async function runClaudeCadQuery(prompt: string, outDir: string, _seed: number) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY missing");

  const fewShot = await fs.readFile(path.join("scripts", "adapters", "cadquery_few_shot.md"), "utf-8");
  let system = `You are a CAD engineer that emits valid Python CadQuery 2.4 code. ${fewShot}\nReturn ONLY a python block. The script MUST end with cq.exporters.export(result, "model.step").`;
  let messages: { role: "user" | "assistant"; content: string }[] = [{ role: "user", content: prompt }];
  let totalIn = 0;
  let totalOut = 0;

  for (let attempt = 0; attempt < 4; attempt++) {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-7",
        max_tokens: 8000,
        system,
        messages,
      }),
    });
    if (!resp.ok) throw new Error(`claude ${resp.status}: ${await resp.text()}`);
    const j = (await resp.json()) as {
      content: { type: string; text: string }[];
      usage: { input_tokens: number; output_tokens: number };
    };
    totalIn += j.usage.input_tokens;
    totalOut += j.usage.output_tokens;
    const text = j.content.find((c) => c.type === "text")?.text ?? "";
    const code = extractPython(text);
    const scriptPath = path.join(outDir, `attempt-${attempt}.py`);
    await fs.writeFile(scriptPath, code);
    const stepPath = path.join(outDir, "model.step");
    const result = await execCadQuery(scriptPath, outDir);
    if (result.ok) {
      const cost = (totalIn * 0.000015) + (totalOut * 0.000075);
      return { artifactPath: stepPath, format: "STEP" as const, tokensIn: totalIn, tokensOut: totalOut, costUsd: +cost.toFixed(4) };
    }
    // Self-repair: append the traceback as a user message.
    messages = [
      ...messages,
      { role: "assistant", content: text },
      { role: "user", content: `Execution failed:\n\n${result.stderr}\n\nProduce a corrected python block.` },
    ];
  }
  throw new Error("claude+cadquery exceeded 4 self-repair attempts");
}

function extractPython(s: string) {
  const m = s.match(/```python\s*([\s\S]*?)```/);
  return m ? m[1] : s;
}

function execCadQuery(scriptPath: string, _outDir: string): Promise<{ ok: boolean; stderr: string }> {
  return new Promise((resolve) => {
    const c = spawn("python3", [scriptPath], { stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    c.stderr.on("data", (d) => (err += d.toString()));
    c.on("close", (code) => resolve({ ok: code === 0, stderr: err }));
    setTimeout(() => c.kill("SIGKILL"), 60_000);
  });
}
