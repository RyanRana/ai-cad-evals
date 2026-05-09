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

  // Persist key in sessionStorage so a tab reload doesn't lose it. Cleared on tab close.
  useEffect(() => {
    const k = sessionStorage.getItem(`pg-key-${provider}`);
    if (k) setApiKey(k);
    else setApiKey("");
  }, [provider]);
  useEffect(() => {
    if (apiKey) sessionStorage.setItem(`pg-key-${provider}`, apiKey);
  }, [apiKey, provider]);

  // When the provider changes, snap to its first model.
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
    <div className="space-y-10">
      <header className="space-y-3 border-b pb-8">
        <div className="eyebrow">Live · Playground · BYO key</div>
        <h1 className="font-serif text-[40px] md:text-[52px] leading-[1.04] tracking-tight">
          Run <span className="italic text-[var(--accent)]">your own</span> prompt against any frontier model.
        </h1>
        <p className="text-[var(--muted)] text-[15px] leading-[1.7] max-w-2xl">
          Paste an OpenAI, Anthropic, or Google API key, write a prompt, pick an output format. Your key is
          forwarded once to the chosen provider and is never stored or logged on this site
          (<a className="link" href="https://github.com">view route handler →</a>). Each response includes the
          raw model output, a runnable CAD program, and a structured shape we can render in-browser using the
          same viewer the benchmark uses.
        </p>
      </header>

      <section className="grid lg:grid-cols-[420px_1fr] gap-8 items-start">
        {/* ---- left column: controls ---- */}
        <div className="space-y-5 lg:sticky lg:top-24">
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
              className="w-full surface rounded-sm px-3 py-2 text-[13px] font-mono"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              {MODELS[provider].map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} <span className="text-[var(--muted)]">— {m.id}</span>
                </option>
              ))}
            </select>
          </Field>
          <Field label="Output format">
            <ButtonRow
              value={format}
              options={[
                { id: "cadquery", label: "CadQuery 2.4" },
                { id: "openscad", label: "OpenSCAD" },
              ]}
              onChange={(v) => setFormat(v as Format)}
            />
          </Field>
          <Field label="API key" hint={keyHint(provider)}>
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={keyPlaceholder(provider)}
              className="w-full surface rounded-sm px-3 py-2 text-[13px] font-mono"
            />
            <div className="text-[10px] font-mono text-[var(--muted)] mt-1.5 leading-relaxed">
              Stored in <span className="text-[var(--foreground)]/80">sessionStorage</span> only (cleared when
              you close this tab). Forwarded once to <span className="text-[var(--foreground)]/80">{providerHost(provider)}</span> via
              <span className="text-[var(--foreground)]/80"> /api/playground</span>. Not logged.
            </div>
          </Field>
          <Field label="Prompt">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={6}
              className="w-full surface rounded-sm px-3 py-2 text-[13px] leading-relaxed font-mono resize-y"
              placeholder="Describe a part. Dimensions, fits, features, intended process…"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {SAMPLES.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPrompt(s)}
                  className="text-[10px] font-mono px-2 py-1 rounded-sm border hover:border-[var(--accent-dim)] hover:text-[var(--accent)] text-[var(--muted)]"
                >
                  sample {i + 1}
                </button>
              ))}
            </div>
          </Field>
          <button
            type="button"
            disabled={busy || !apiKey || !prompt}
            onClick={run}
            className="w-full px-4 py-2.5 rounded-sm bg-[var(--accent)] text-[var(--background)] font-mono text-[13px] tracking-wide hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {busy ? "running…" : "Generate part →"}
          </button>
        </div>

        {/* ---- right column: result ---- */}
        <div className="space-y-6 min-w-0">
          <div className="flex items-end justify-between">
            <h2 className="font-serif text-[24px] tracking-tight leading-none">
              <span className="section-no mr-3">§1</span>Live preview
            </h2>
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--muted)]">
              {elapsedMs !== null && `t = ${(elapsedMs / 1000).toFixed(2)} s · `}
              same viewer as /tasks
            </div>
          </div>
          <PreviewPane busy={busy} result={result} />

          <div className="flex items-end justify-between pt-2">
            <h2 className="font-serif text-[24px] tracking-tight leading-none">
              <span className="section-no mr-3">§2</span>Generated{" "}
              {format === "cadquery" ? "CadQuery" : "OpenSCAD"}
            </h2>
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--muted)]">
              copy &amp; run locally
            </div>
          </div>
          <CodePane busy={busy} result={result} format={format} />

          <details className="text-[11px] font-mono text-[var(--muted)] surface rounded-sm">
            <summary className="cursor-pointer px-3 py-2 select-none">raw model output</summary>
            <pre className="px-3 pb-3 whitespace-pre-wrap break-words text-[var(--foreground)]/80">
              {result?.ok ? result.raw : result && !result.ok ? result.error : "—"}
            </pre>
          </details>

          <p className="text-[11px] text-[var(--muted)] leading-relaxed max-w-2xl">
            Output is not benchmarked here — every prompt you write is one ad-hoc sample, not the 5-seed,
            308-task sweep that produces the leaderboard numbers. To run a real eval pass against your own
            agent, see <a className="link" href="/methodology">/methodology</a> and the open harness.
          </p>
        </div>
      </section>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-[10px] font-mono tracking-[0.18em] uppercase text-[var(--muted)]">{label}</label>
        {hint && <span className="text-[10px] font-mono text-[var(--muted-2)]">{hint}</span>}
      </div>
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
          className={`px-3 py-1.5 rounded-sm border text-[12px] font-mono transition-colors ${
            value === o.id
              ? "bg-[var(--accent)] text-[var(--background)] border-[var(--accent)]"
              : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--accent-dim)]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function PreviewPane({ busy, result }: { busy: boolean; result: Result | null }) {
  if (busy) {
    return <div className="surface rounded-sm h-[420px] flex items-center justify-center text-[12px] font-mono text-[var(--muted)]">generating…</div>;
  }
  if (!result) {
    return (
      <div className="surface rounded-sm h-[420px] flex items-center justify-center text-[12px] font-mono text-[var(--muted)] text-center px-6">
        Run a prompt to see the live render here.
        <br />Same Three.js viewer as the benchmark task pages.
      </div>
    );
  }
  if (!result.ok) {
    return (
      <div className="surface rounded-sm h-[420px] flex items-center justify-center text-center px-6">
        <div className="space-y-2">
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--bad)]">request failed</div>
          <div className="font-mono text-[12px] text-[var(--foreground)]/85 max-w-md">{result.error}</div>
        </div>
      </div>
    );
  }
  if (!result.shape) {
    return (
      <div className="surface rounded-sm h-[420px] flex items-center justify-center text-[12px] font-mono text-[var(--muted)] text-center px-6">
        Model returned code but no structured shape. The code is below — run it locally with the CadQuery or
        OpenSCAD CLI to see the part.
      </div>
    );
  }
  return (
    <div>
      <CadViewer shape={result.shape as ShapeDesc} height={420} label={`live render · ${result.modelUsed}`} />
      {result.tokens && (
        <div className="text-[10px] font-mono text-[var(--muted)] mt-2 tabular-nums">
          {result.tokens.input ?? "?"} input · {result.tokens.output ?? "?"} output tokens · primitive{" "}
          <span className="text-[var(--accent)]">{(result.shape as { type?: string }).type ?? "?"}</span>
        </div>
      )}
    </div>
  );
}

function CodePane({ busy, result, format }: { busy: boolean; result: Result | null; format: Format }) {
  const [copied, setCopied] = useState(false);
  const code = result?.ok ? result.code : "";
  return (
    <div className="surface rounded-sm relative">
      <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
        <span className="text-[10px] font-mono text-[var(--muted)]">
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
          className="text-[10px] font-mono px-2 py-1 rounded-sm border bg-[var(--card)] hover:border-[var(--accent-dim)] hover:text-[var(--accent)] disabled:opacity-40"
        >
          {copied ? "copied ✓" : "copy"}
        </button>
      </div>
      <pre className="p-4 pr-24 text-[12px] font-mono leading-relaxed overflow-x-auto whitespace-pre min-h-[160px]">
        {busy ? "// generating…" : code || "// run a prompt to populate this panel."}
      </pre>
    </div>
  );
}

function keyHint(p: Provider): string {
  return p === "anthropic" ? "anthropic.com → console" : p === "openai" ? "platform.openai.com" : "ai.google.dev";
}
function keyPlaceholder(p: Provider): string {
  return p === "anthropic" ? "sk-ant-…" : p === "openai" ? "sk-…" : "AIza…";
}
function providerHost(p: Provider): string {
  return p === "anthropic" ? "api.anthropic.com" : p === "openai" ? "api.openai.com" : "generativelanguage.googleapis.com";
}
