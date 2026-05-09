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
    <div className="space-y-8">
      <header className="space-y-2">
        <Link href="/tasks" className="text-xs text-[var(--muted)] hover:underline underline-offset-4">← all tasks</Link>
        <div className="flex items-baseline justify-between flex-wrap gap-3">
          <div>
            <div className="font-mono text-xs text-[var(--muted)]">{task.id} · <Link href={`/categories/${cat.id}`} className="hover:underline underline-offset-4">{cat.name}</Link> · difficulty {task.difficulty}/5</div>
            <h1 className="text-2xl tracking-tight">{task.title}</h1>
          </div>
          <div className="font-mono text-[10px] text-[var(--muted)]">sha256:{task.groundTruthHash}…</div>
        </div>
      </header>

      <section className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h2 className="text-sm font-mono text-[var(--muted)]">PROMPT (verbatim)</h2>
          <div className="border rounded-md bg-[var(--card)] p-4 text-[13px] leading-relaxed font-mono whitespace-pre-wrap">{task.prompt}</div>
          <h2 className="text-sm font-mono text-[var(--muted)] pt-2">GROUND-TRUTH SPEC</h2>
          <div className="border rounded-md bg-[var(--card)] p-4 text-[12px] font-mono space-y-1 tabular-nums">
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
        <div className="space-y-3">
          <h2 className="text-sm font-mono text-[var(--muted)]">REFERENCE RENDER</h2>
          {shape ? (
            <CadViewer shape={shape} height={400} label="canonical reference · drag to orbit, scroll to zoom" />
          ) : (
            <div className="border rounded-md bg-[var(--card)] h-[400px] flex items-center justify-center text-[var(--muted)] text-sm">
              No procedural visualisation — held-out reference STEP only.
            </div>
          )}
          <p className="text-[11px] text-[var(--muted)] leading-relaxed">
            Visualisation is rebuilt in-browser from the canonical parametric description. Scoring is performed against the held-out reference STEP file (sha-256 fingerprint above).
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-mono text-[var(--muted)] mb-3">PER-AGENT RESULTS · ranked by Vol IoU</h2>
        <div className="border rounded-md bg-[var(--card)] overflow-x-auto">
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
