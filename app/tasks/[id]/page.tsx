import Link from "next/link";
import { notFound } from "next/navigation";
import { TASKS, taskById } from "@/lib/data/tasks";
import { AGENTS } from "@/lib/data/agents";
import { categoryById } from "@/lib/data/categories";
import { getRuns } from "@/lib/data/results";
import { TASK_SHAPES } from "@/lib/data/shapes";
import { CadViewer } from "@/components/CadViewer";
import { MetricCell } from "@/components/MetricCell";
import { METRICS } from "@/lib/data/metrics";
import { degradeForAgent, brepFidelityForAgent } from "@/lib/data/agent-degrade";
import { BackLink } from "@/components/BackLink";

export function generateStaticParams() {
  return TASKS.map((t) => ({ id: t.id }));
}

export default async function TaskDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = taskById(id);
  if (!task) return notFound();
  const cat = categoryById(task.category)!;
  const runs = getRuns().filter((r) => r.taskId === task.id);
  const shape = TASK_SHAPES[task.id];

  const ranked = AGENTS.map((a) => {
    const r = runs.find((rr) => rr.agentId === a.id)!;
    return { a, r };
  }).sort((x, y) => ((y.r.metrics.vol_iou as number) ?? 0) - ((x.r.metrics.vol_iou as number) ?? 0));

  return (
    <div className="space-y-12">
      <header className="space-y-3 border-b pb-8">
        <BackLink href="/tasks" className="text-[11px] font-mono link">← back</BackLink>
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div className="space-y-2">
            <div className="eyebrow">
              {task.id} · <Link href={`/categories/${cat.id}`} className="link">{cat.name}</Link> · difficulty {task.difficulty}/5
            </div>
            <h1 className="font-serif text-[36px] md:text-[42px] leading-[1.05] tracking-tight">
              {task.title}
            </h1>
          </div>
          <div className="font-mono text-[10px] text-[var(--muted)]">sha256:{task.groundTruthHash}…</div>
        </div>
      </header>

      <section className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h2 className="font-serif text-[20px] tracking-tight"><span className="section-no mr-2">§1</span>Prompt <span className="text-[12px] font-sans text-[var(--muted)] ml-2">verbatim</span></h2>
          <div className="surface rounded-sm p-4 text-[13px] leading-relaxed font-mono whitespace-pre-wrap">{task.prompt}</div>
          <h2 className="font-serif text-[20px] tracking-tight pt-4"><span className="section-no mr-2">§2</span>Ground-truth spec</h2>
          <div className="surface rounded-sm p-4 text-[12px] font-mono space-y-1 tabular-nums">
            {task.spec.volumeMm3 !== undefined && <Row k="volume" v={`${task.spec.volumeMm3.toFixed(1)} mm³`} />}
            {task.spec.surfaceAreaMm2 !== undefined && <Row k="surface area" v={`${task.spec.surfaceAreaMm2.toFixed(1)} mm²`} />}
            {task.spec.boundingBoxMm && <Row k="bbox" v={task.spec.boundingBoxMm.map((x) => x.toFixed(1)).join(" × ") + " mm"} />}
            {task.spec.shellCount !== undefined && <Row k="shells" v={`${task.spec.shellCount}`} />}
            {task.spec.euler !== undefined && <Row k="V−E+F" v={`${task.spec.euler}`} />}
            {task.spec.genus !== undefined && <Row k="genus" v={`${task.spec.genus}`} />}
            {task.spec.watertight !== undefined && <Row k="watertight" v={task.spec.watertight ? "true" : "false"} />}
            {task.spec.manifold !== undefined && <Row k="manifold" v={task.spec.manifold ? "true" : "false"} />}
            {task.spec.toleranceMm !== undefined && <Row k="acceptance ε" v={`±${task.spec.toleranceMm} mm`} />}
            {task.spec.features && task.spec.features.length > 0 && <Row k="features" v={task.spec.features.join(", ")} />}
            {task.spec.expectedClearanceMm && <Row k="clearance" v={`[${task.spec.expectedClearanceMm.min}, ${task.spec.expectedClearanceMm.max}] mm`} />}
            {task.spec.edits && task.spec.edits.length > 0 && (
              <div>
                <div className="text-[var(--muted)] mt-1">parametric edits</div>
                {task.spec.edits.map((e, i) => (
                  <div key={i} className="pl-3">{e.param} : {e.from} → {e.to} (ΔV expected {e.expectedDeltaVolMm3.toFixed(0)} mm³)</div>
                ))}
              </div>
            )}
          </div>
          {task.notes && (
            <div className="text-[12px] text-[var(--muted)] leading-relaxed">{task.notes}</div>
          )}
        </div>
        <div className="space-y-4">
          <h2 className="font-serif text-[20px] tracking-tight"><span className="section-no mr-2">§3</span>Reference render</h2>
          {shape ? (
            <CadViewer shape={shape} height={400} label="canonical reference · drag to orbit, scroll to zoom" />
          ) : (
            <div className="surface rounded-sm h-[400px] flex items-center justify-center text-[var(--muted)] text-sm">
              No procedural visualisation — held-out reference STEP only.
            </div>
          )}
          <p className="text-[11px] text-[var(--muted)] leading-relaxed">
            Visualisation is rebuilt in-browser from the canonical parametric description. Scoring is performed against the held-out reference STEP file (sha-256 fingerprint above).
          </p>
        </div>
      </section>

      {shape && (
        <section className="space-y-5">
          <div className="flex items-end justify-between flex-wrap gap-2">
            <div>
              <h2 className="font-serif text-[26px] tracking-tight leading-none">
                <span className="section-no mr-3">§4</span>Per-agent renders
              </h2>
              <div className="eyebrow mt-2">reference + 10 agent outputs · scored against the held-out STEP</div>
            </div>
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--muted)]">
              vol IoU · BREP · manifold
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {/* Reference tile */}
            <RenderTile
              shape={shape}
              degrade={undefined}
              title="REFERENCE"
              subtitle="canonical · ground truth"
              chips={[
                { label: "VOL IoU", value: "1.000", tone: "good" },
                { label: "BREP", value: "100", tone: "good" },
                { label: "MANIF", value: "✓", tone: "good" },
              ]}
              accent
            />
            {ranked.map(({ a, r }) => {
              const failed = !!r.error;
              const deg = degradeForAgent(a.id, task.id, failed);
              const iou = (r.metrics.vol_iou as number | undefined) ?? 0;
              const stepRT = r.metrics.step_roundtrip as number | undefined;
              const brepHint = brepFidelityForAgent(a.id);
              const breVal = stepRT !== undefined ? Math.round(stepRT * 100) : brepHint !== undefined ? Math.round(brepHint * 100) : undefined;
              const manifold = r.metrics.manifold as number | boolean | undefined;
              return (
                <RenderTile
                  key={a.id}
                  href={`/agents/${a.id}`}
                  shape={shape}
                  degrade={deg}
                  title={a.name}
                  subtitle={a.vendor}
                  chips={[
                    { label: "VOL IoU", value: failed ? "—" : iou.toFixed(3), tone: failed ? "bad" : iou > 0.85 ? "good" : iou > 0.5 ? "mid" : "bad" },
                    { label: "BREP", value: breVal === undefined ? "—" : `${breVal}`, tone: breVal === undefined ? "mid" : breVal >= 60 ? "good" : breVal >= 30 ? "mid" : "bad" },
                    {
                      label: "MANIF",
                      value: failed ? "✗" : manifold === true || (typeof manifold === "number" && manifold >= 0.95) ? "✓" : "✗",
                      tone: failed ? "bad" : manifold === true || (typeof manifold === "number" && manifold >= 0.95) ? "good" : "bad",
                    },
                  ]}
                />
              );
            })}
          </div>
          <p className="text-[11px] text-[var(--muted)] leading-relaxed max-w-3xl">
            Each tile is rebuilt from the canonical parametric description and degraded to match the agent&apos;s
            scored profile (tessellation, non-manifold face removal, dimension scale jitter, missing features).
            Image-only diffusion models render visually plausible meshes but score in the single digits on BREP
            fidelity — the geometry is not a manifold solid even when the render reads clean.
          </p>
        </section>
      )}

      <section>
        <h2 className="font-serif text-[26px] tracking-tight leading-none mb-1">
          <span className="section-no mr-3">§5</span>Per-agent metrics
        </h2>
        <div className="eyebrow mb-4">ranked by Vol IoU · same data as the leaderboard, restricted to this task</div>
        <div className="surface rounded-sm overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="text-[10px] uppercase font-mono text-[var(--muted)]">
              <tr className="border-b">
                <th className="text-left px-3 py-2">Agent</th>
                {METRICS.filter((m) => cat.primaryMetrics.includes(m.id) || ["pass_at_1", "watertight", "manifold", "latency_p50"].includes(m.id)).map((m) => (
                  <th key={m.id} className="text-right px-2 py-2 font-medium" title={m.formula}>{abbr(m.name)}</th>
                ))}
                <th className="text-right px-2 py-2 font-medium">latency</th>
                <th className="text-right px-3 py-2 font-medium">cost</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map(({ a, r }) => (
                <tr key={a.id} className="border-b last:border-b-0 hover:bg-[var(--background)]">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <Link href={`/agents/${a.id}`} className="hover:underline underline-offset-4">{a.name}</Link>
                    {r.error && <div className="text-[10px] text-[var(--bad)]">{r.error}</div>}
                  </td>
                  {METRICS.filter((m) => cat.primaryMetrics.includes(m.id) || ["pass_at_1", "watertight", "manifold", "latency_p50"].includes(m.id)).map((m) => (
                    <td key={m.id} className="px-2 py-2 text-right">
                      <MetricCell value={r.metrics[m.id] ?? null} format={m.unit === "ratio" ? "fixed3" : m.unit === "boolean" ? "auto" : m.id === "dfm_score" ? "fixed1" : "fixed3"} />
                    </td>
                  ))}
                  <td className="px-2 py-2 text-right tabular-nums font-mono">{(r.latencyMs / 1000).toFixed(1)}s</td>
                  <td className="px-3 py-2 text-right tabular-nums font-mono">${(r.costUsd ?? 0).toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-[var(--muted)]">{k}</span>
      <span>{v}</span>
    </div>
  );
}

type Chip = { label: string; value: string; tone: "good" | "mid" | "bad" };

function RenderTile({
  shape,
  degrade,
  title,
  subtitle,
  chips,
  href,
  accent,
}: {
  shape: import("@/components/CadViewer").ShapeDesc;
  degrade?: import("@/components/CadViewer").Degrade;
  title: string;
  subtitle?: string;
  chips: Chip[];
  href?: string;
  accent?: boolean;
}) {
  const inner = (
    <div className={`surface rounded-sm overflow-hidden flex flex-col ${accent ? "border-[var(--accent-dim)]" : ""}`}>
      <CadViewer shape={shape} degrade={degrade} height={180} label={accent ? "canonical reference" : title} />
      <div className="px-3 py-2 border-t flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className={`text-[12px] truncate ${accent ? "text-[var(--accent)] font-mono uppercase tracking-[0.16em]" : ""}`}>{title}</div>
          {subtitle && <div className="text-[10px] font-mono text-[var(--muted)] truncate">{subtitle}</div>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {chips.map((c) => (
            <span
              key={c.label}
              className={`px-1.5 py-0.5 rounded-sm text-[9px] font-mono tabular-nums ${
                c.tone === "good"
                  ? "bg-[var(--good)]/15 text-[var(--good)]"
                  : c.tone === "mid"
                  ? "bg-[var(--warn)]/15 text-[var(--warn)]"
                  : "bg-[var(--bad)]/15 text-[var(--bad)]"
              }`}
              title={c.label}
            >
              {c.value}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
  return href ? <Link href={href} className="hover:opacity-95 block">{inner}</Link> : inner;
}

function abbr(name: string) {
  return name
    .replace("Volumetric IoU", "Vol IoU")
    .replace("Bidirectional Chamfer Distance", "Chamfer")
    .replace("Hausdorff Distance (H₉₅)", "Hausdorff")
    .replace("Normal Consistency", "NormCons")
    .replace("Edge-Manifoldness", "Manif.")
    .replace("Watertightness", "Watert.")
    .replace("Euler–Poincaré Compliance", "Euler")
    .replace("STEP Round-trip Chamfer", "STEP RT")
    .replace("DFM Composite", "DFM")
    .replace("Parametric Edit Accuracy", "ParamEdit")
    .replace("Constraint Solve Rate", "ConSolve")
    .replace("Mating Clearance Compliance", "Mating")
    .replace("Feature Recall", "FeatRec")
    .replace("Pass@1", "P@1")
    .replace("Latency p50", "p50");
}
