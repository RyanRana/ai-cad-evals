import { NextResponse } from "next/server";

// Server route handler for the BYO-key playground. Receives a provider,
// model, format, prompt, and the user's API key in the JSON body. Forwards
// to the provider, parses the response into { code, shape, raw }, and
// returns. The key is used exactly once for the outbound request and is
// never written to disk or logged.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Provider = "openai" | "anthropic" | "google";
type Format = "cadquery" | "openscad";

type Body = {
  provider: Provider;
  model: string;
  format: Format;
  prompt: string;
  apiKey: string;
};

const SHAPE_PRIMS = `
{ "type": "box", "size": [x, y, z] }
{ "type": "hollow_cylinder", "outerR", "innerR", "height" }
{ "type": "hex_prism", "acrossFlats", "height", "filletR" }
{ "type": "stepped_shaft", "segments": [{"d","l"}, ...] }
{ "type": "L_bracket", "legA", "legB", "thickness", "holeD", "slotW", "slotL" }
{ "type": "carrier_plate", "r", "thickness", "bores": [{"r","n","pcd","phase"}, ...] }
{ "type": "pin", "d", "l", "chamfer" }
{ "type": "dovetail", "baseW", "topW", "height", "length" }
{ "type": "enclosure_half", "w", "h", "d", "wall", "bossR" }
{ "type": "hinge", "w", "h", "t", "web" }
{ "type": "goblet", "cupR", "cupH", "stemR", "stemH", "baseR", "baseT" }
{ "type": "flange", "hubR", "hubH", "plateR", "plateT", "pcd", "boltR" }
{ "type": "blade", "chord", "span", "twist", "thickness" }
{ "type": "impeller", "hubR", "hubH", "bladeCount", "chord", "span", "twist", "thickness" }
{ "type": "gear", "teeth", "module", "thickness", "boreR" }
{ "type": "planetary_gearset", "ringTeeth", "sunTeeth", "planetTeeth", "module", "thickness", "boreR" }
`.trim();

function systemPrompt(format: Format) {
  const formatLine = format === "cadquery"
    ? "\"code\" — a complete CadQuery 2.4 program (Python) that constructs the part. Use only the standard CadQuery API. Include sensible defaults for any dimension not specified. The script should end with `result = ...` so the cq-cli runner can pick it up."
    : "\"code\" — a complete OpenSCAD 2024.06 program that constructs the part. Use only stock primitives (cube, cylinder, sphere, hull, minkowski, linear_extrude, rotate_extrude, polygon, polyhedron) plus the boolean ops. Include sensible defaults for any dimension not specified.";
  return `You are an expert mechanical CAD engineer. Given a natural-language description of a part, return a JSON object with exactly two top-level fields:

1. ${formatLine}

2. "shape" — a structured description of the part using EXACTLY ONE of the following primitive types, used by an in-browser viewer to preview the part:

${SHAPE_PRIMS}

All numeric dimensions are in millimetres. Pick the primitive closest to the requested part; if none fit cleanly, return { "type": "box", "size": [x,y,z] } with the part's bounding box. Output ONLY the JSON object, no markdown fences, no commentary, no preamble.`;
}

function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }
  const { provider, model, format, prompt, apiKey } = body ?? {};
  if (!provider || !model || !format || !prompt || !apiKey) {
    return jsonError(400, "provider, model, format, prompt and apiKey are required");
  }
  if (typeof apiKey !== "string" || apiKey.length < 8 || apiKey.length > 512) {
    return jsonError(400, "apiKey shape looks wrong");
  }
  if (prompt.length > 8000) {
    return jsonError(400, "prompt too long (max 8000 chars)");
  }

  const sys = systemPrompt(format);

  try {
    let raw = "";
    let modelUsed = model;
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;

    if (provider === "openai") {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: sys },
            { role: "user", content: prompt },
          ],
        }),
      });
      const j = await r.json();
      if (!r.ok) return jsonError(r.status, j?.error?.message ?? "openai error");
      raw = j.choices?.[0]?.message?.content ?? "";
      modelUsed = j.model ?? model;
      inputTokens = j.usage?.prompt_tokens;
      outputTokens = j.usage?.completion_tokens;
    } else if (provider === "anthropic") {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          temperature: 0.2,
          system: sys,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const j = await r.json();
      if (!r.ok) return jsonError(r.status, j?.error?.message ?? j?.message ?? "anthropic error");
      const block = Array.isArray(j.content) ? j.content.find((c: { type?: string }) => c?.type === "text") : null;
      raw = block?.text ?? "";
      modelUsed = j.model ?? model;
      inputTokens = j.usage?.input_tokens;
      outputTokens = j.usage?.output_tokens;
    } else if (provider === "google") {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: sys }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
            maxOutputTokens: 4096,
          },
        }),
      });
      const j = await r.json();
      if (!r.ok) return jsonError(r.status, j?.error?.message ?? "google error");
      raw = j?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p?.text ?? "").join("") ?? "";
      modelUsed = model;
      inputTokens = j?.usageMetadata?.promptTokenCount;
      outputTokens = j?.usageMetadata?.candidatesTokenCount;
    } else {
      return jsonError(400, `unknown provider: ${provider}`);
    }

    const parsed = parseModelOutput(raw);
    return NextResponse.json({
      ok: true,
      raw,
      code: parsed.code,
      shape: parsed.shape,
      modelUsed,
      tokens: { input: inputTokens, output: outputTokens },
    });
  } catch (e) {
    return jsonError(500, e instanceof Error ? e.message : "request failed");
  }
}

// Parse the model's JSON output. Many providers return a string that is
// already valid JSON; others wrap it in markdown fences. We try strict
// JSON.parse first, then fall back to the first {...} balanced segment.
function parseModelOutput(raw: string): { code: string; shape: unknown } {
  const trimmed = raw.trim();
  const candidates = [trimmed, stripFences(trimmed), firstJsonObject(trimmed)].filter(Boolean) as string[];
  for (const c of candidates) {
    try {
      const j = JSON.parse(c);
      if (typeof j === "object" && j) {
        return {
          code: typeof j.code === "string" ? j.code : "",
          shape: j.shape ?? null,
        };
      }
    } catch {
      // try next candidate
    }
  }
  return { code: trimmed, shape: null };
}

function stripFences(s: string): string {
  return s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
}

function firstJsonObject(s: string): string {
  const start = s.indexOf("{");
  if (start < 0) return "";
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return "";
}
