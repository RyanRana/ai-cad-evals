import Link from "next/link";
import { notFound } from "next/navigation";
import { AGENTS, agentById } from "@/lib/data/agents";
import { TASKS } from "@/lib/data/tasks";
import { CATEGORIES } from "@/lib/data/categories";
import { getAggregates, getRuns } from "@/lib/data/results";
import { CategoryBars } from "@/components/CategoryBars";
import { MetricCell } from "@/components/MetricCell";
import { METRICS } from "@/lib/data/metrics";

export function generateStaticParams() {
  return AGENTS.map((a) => ({ id: a.id }));
}

export default async function AgentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = agentById(id);
  if (!agent) return notFound();
  const aggregates = getAggregates().filter((a) => a.agentId === agent.id);
  const overall = aggregates.find((a) => a.category === "overall")!;
  const runs = getRuns().filter((r) => r.agentId === agent.id);

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <Link href="/agents" className="text-xs text-[var(--muted)] hover:underline underline-offset-4">← all agents</Link>
        <div className="flex items-baseline justify-between flex-wrap gap-3">
          <h1 className="text-2xl tracking-tight">{agent.name}</h1>
          <div className="font-mono text-sm tabular-nums">
            composite <span className="text-base">{overall.meanScore.toFixed(1)}</span>
            <span className="text-[var(--muted)]"> [{overall.ciLow.toFixed(1)}, {overall.ciHigh.toFixed(1)}]</span>
          </div>
        </div>
        <div className="font-mono text-[11px] text-[var(--muted)] flex flex-wrap gap-x-3 gap-y-1">
          <span>{agent.vendor}</span>
          <span>· v{agent.version}</span>
          <span>· released {agent.releaseDate}</span>
          <span>· {agent.runtime}</span>
          <span>· emits {agent.representation}</span>
          <span>· {agent.license}</span>
          {agent.contextWindow && <span>· {Math.round(agent.contextWindow / 1000)}k ctx</span>}
          {agent.costPer1kTok && <span>· ${agent.costPer1kTok.input}/${agent.costPer1kTok.output} per 1k tok</span>}
        </div>
        <p className="text-[var(--muted)] max-w-3xl text-sm leading-relaxed">{agent.notes}</p>
      </header>

      <section>
        <h2 className="text-sm font-mono text-[var(--muted)] mb-3">PER-CATEGORY SCORE (95 % CI)</h2>
        <div className="border rounded-md bg-[var(--card)] p-5">
          <CategoryBars aggregates={aggregates} />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-mono text-[var(--muted)] mb-3">MEAN METRICS BY CATEGORY</h2>
        <div className="border rounded-md bg-[var(--card)] overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="text-[10px] uppercase font-mono text-[var(--muted)]">
              <tr className="border-b">
                <th className="text-left px-3 py-2">Category</th>
                {METRICS.filter((m) => m.id !== "latency_p50" && m.id !== "latency_p95" && m.id !== "cost_per_task").map((m) => (
                  <th key={m.id} className="text-right px-2 py-2 font-medium" title={m.formula}>
                    {abbr(m.name)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((c) => {
                const a = aggregates.find((x) => x.category === c.id)!;
                return (
                  <tr key={c.id} className="border-b last:border-b-0 hover:bg-[var(--background)]">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <Link href={`/categories/${c.id}`} className="hover:underline underline-offset-4">{c.name}</Link>
                    </td>
                    {METRICS.filter((m) => m.id !== "latency_p50" && m.id !== "latency_p95" && m.id !== "cost_per_task").map((m) => {
                      const v = a.metricMeans[m.id];
                      return (
                        <td key={m.id} className="px-2 py-2 text-right">
                          <MetricCell value={v ?? null} format={m.unit === "ratio" ? "fixed3" : m.unit === "boolean" ? "auto" : "fixed3"} />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-mono text-[var(--muted)] mb-3">TASK-BY-TASK ARTIFACTS</h2>
        <div className="border rounded-md bg-[var(--card)] divide-y">
          {TASKS.map((t) => {
            const r = runs.find((rr) => rr.taskId === t.id);
            if (!r) return null;
            return (
              <Link
                href={`/tasks/${t.id}?agent=${agent.id}`}
                key={t.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--background)] text-[12px]"
              >
                <span className="font-mono text-[10px] text-[var(--muted)] w-20">{t.id}</span>
                <span className="flex-1 truncate">{t.title}</span>
                <span className="font-mono text-[var(--muted)] w-24 text-right hidden sm:inline">{(r.latencyMs / 1000).toFixed(1)}s</span>
                <span className="font-mono w-16 text-right">
                  <MetricCell value={r.metrics.vol_iou ?? null} format="fixed3" />
                </span>
                <span className="w-10 text-right">
                  <MetricCell value={r.metrics.pass_at_1 as number} format="auto" good={(r.metrics.pass_at_1 as number) > 0} />
                </span>
              </Link>
            );
          })}
        </div>
      </section>
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
    .replace("Pass@5", "P@5");
}
