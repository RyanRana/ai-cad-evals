"use client";

import { useEffect, useState } from "react";
import { CadViewer, type ShapeDesc } from "@/components/CadViewer";

type Provider = "openai" | "anthropic" | "google";
type Format = "cadquery" | "openscad";

const MODELS: Record<Provider, { id: string; label: string }[]> = {
  anthropic: [
    { id: "claude-opus-4-7", label: "Claude Opus 4.7" },
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
  ],
  openai: [
    { id: "gpt-5", label: "GPT-5" },
    { id: "gpt-5-mini", label: "GPT-5 mini" },
    { id: "gpt-4o", label: "GPT-4o" },
  ],
  google: [
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  ],
};

const SAMPLES = [
  "An L-bracket 60×40 mm, 5 mm thick, with an M6 clearance hole through the long leg and a 16×8 mm slot through the short leg.",
  "A planetary gearset with a 60-tooth ring, 18-tooth sun, and three 21-tooth planets at module 2 mm. 10 mm thick. 5 mm bore in the sun.",
  "A 7-blade centrifugal compressor impeller. Hub diameter 28 mm, hub height 30 mm. Blades twist 28° from root to tip, 38 mm span, 36 mm chord, 4 mm thick.",
  "A bolted carrier plate, 80 mm diameter, 8 mm thick. One M6 central bore, three M3 holes on a 30 mm PCD, six M1.5 holes on a 60 mm PCD with a 30° phase offset.",
];

type Result =
  | { ok: true; code: string; shape: ShapeDesc | null; raw: string; modelUsed: string; tokens?: { input?: number; output?: number } }
  | { ok: false; error: string };

export default function Playground() {
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [model, setModel] = useState<string>(MODELS.anthropic[0].id);
  const [format, setFormat] = useState<Format>("cadquery");
  const [apiKey, setApiKey] = useState("");
  const [prompt, setPrompt] = useState(SAMPLES[0]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);

  useEffect(() => {
    const k = sessionStorage.getItem(`pg-key-${provider}`);
    setApiKey(k ?? "");
  }, [provider]);
  useEffect(() => {
    if (apiKey) sessionStorage.setItem(`pg-key-${provider}`, apiKey);
  }, [apiKey, provider]);
  useEffect(() => {
    setModel(MODELS[provider][0].id);
  }, [provider]);

  async function run() {
    if (!apiKey || !prompt) return;
    setBusy(true);
    setResult(null);
    setElapsedMs(null);
    const t0 = performance.now();
    try {
      const r = await fetch("/api/playground", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider, model, format, prompt, apiKey }),
      });
      const j = await r.json();
      setElapsedMs(Math.round(performance.now() - t0));
      setResult(j);
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : "request failed" });
      setElapsedMs(Math.round(performance.now() - t0));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2 max-w-2xl">
        <h1 className="text-[32px] leading-tight tracking-tight font-medium">Playground</h1>
        <p className="text-[15px] text-[var(--muted)]">
          Bring your own key. Generate a CAD part with any frontier model.
        </p>
      </header>

      <section className="grid lg:grid-cols-[380px_1fr] gap-6 items-start">
        <div className="space-y-4 lg:sticky lg:top-6">
          <Field label="Provider">
            <ButtonRow
              value={provider}
              options={[
                { id: "anthropic", label: "Anthropic" },
                { id: "openai", label: "OpenAI" },
                { id: "google", label: "Google" },
              ]}
              onChange={(v) => setProvider(v as Provider)}
            />
          </Field>

          <Field label="Model">
            <select
              className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-[13px] bg-white"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              {MODELS[provider].map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Format">
            <ButtonRow
              value={format}
              options={[
                { id: "cadquery", label: "CadQuery" },
                { id: "openscad", label: "OpenSCAD" },
              ]}
              onChange={(v) => setFormat(v as Format)}
            />
          </Field>

          <Field label="API key">
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={keyPlaceholder(provider)}
              className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-[13px] font-mono bg-white"
            />
          </Field>

          <Field label="Prompt">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
              className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-[13px] leading-relaxed resize-y bg-white"
              placeholder="Describe a part…"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {SAMPLES.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPrompt(s)}
                  className="text-[12px] px-2 py-1 rounded-md border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)]"
                >
                  Sample {i + 1}
                </button>
              ))}
            </div>
          </Field>

          <button
            type="button"
            disabled={busy || !apiKey || !prompt}
            onClick={run}
            className="w-full px-4 py-2.5 rounded-md bg-[var(--foreground)] text-white text-[14px] font-medium hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            {busy ? "Generating…" : "Generate"}
          </button>
        </div>

        <div className="space-y-5 min-w-0">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-medium">Preview</h2>
            {elapsedMs !== null && (
              <span className="text-[12px] text-[var(--muted)] tabular-nums">{(elapsedMs / 1000).toFixed(2)}s</span>
            )}
          </div>
          <PreviewPane busy={busy} result={result} />

          <div className="flex items-center justify-between pt-2">
            <h2 className="text-[15px] font-medium">{format === "cadquery" ? "CadQuery" : "OpenSCAD"}</h2>
          </div>
          <CodePane busy={busy} result={result} format={format} />
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[13px] text-[var(--muted)] mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

function ButtonRow({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { id: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`px-3 py-1.5 rounded-md text-[13px] transition-colors ${
            value === o.id
              ? "bg-[var(--foreground)] text-white"
              : "border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function PreviewPane({ busy, result }: { busy: boolean; result: Result | null }) {
  const shell = "border border-[var(--border)] rounded-md h-[420px] flex items-center justify-center text-[13px] text-[var(--muted)] text-center px-6 bg-white";
  if (busy) return <div className={shell}>Generating…</div>;
  if (!result) return <div className={shell}>Run a prompt to see the render.</div>;
  if (!result.ok) {
    return (
      <div className={shell}>
        <div>
          <div className="text-[var(--bad)] font-medium mb-1">Request failed</div>
          <div className="font-mono text-[12px] text-[var(--foreground)]/85 max-w-md">{result.error}</div>
        </div>
      </div>
    );
  }
  if (!result.shape) {
    return <div className={shell}>Code generated, but no structured shape to render.</div>;
  }
  return (
    <div>
      <CadViewer shape={result.shape as ShapeDesc} height={420} label={result.modelUsed} />
      {result.tokens && (
        <div className="text-[12px] text-[var(--muted)] mt-2 tabular-nums">
          {result.tokens.input ?? "?"} in · {result.tokens.output ?? "?"} out tokens
        </div>
      )}
    </div>
  );
}

function CodePane({ busy, result, format }: { busy: boolean; result: Result | null; format: Format }) {
  const [copied, setCopied] = useState(false);
  const code = result?.ok ? result.code : "";
  return (
    <div className="border border-[var(--border)] rounded-md relative bg-white">
      <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
        <span className="text-[11px] text-[var(--muted)] font-mono">
          {format === "cadquery" ? "model.py" : "model.scad"}
        </span>
        <button
          type="button"
          disabled={!code}
          onClick={async () => {
            if (!code) return;
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="text-[11px] px-2 py-1 rounded-md border border-[var(--border)] hover:border-[var(--foreground)] disabled:opacity-40"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="p-4 pr-24 text-[12px] font-mono leading-relaxed overflow-x-auto whitespace-pre min-h-[160px]">
        {busy ? "// generating…" : code || "// run a prompt to populate this panel."}
      </pre>
    </div>
  );
}

function keyPlaceholder(p: Provider): string {
  return p === "anthropic" ? "sk-ant-…" : p === "openai" ? "sk-…" : "AIza…";
}
