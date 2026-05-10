import Link from "next/link";
import { notFound } from "next/navigation";
import { AGENTS, agentById } from "@/lib/data/agents";
import { TASKS } from "@/lib/data/tasks";
import { CATEGORIES } from "@/lib/data/categories";
import { getAggregates, getRuns, classifyTier } from "@/lib/data/results";
import { CategoryBars } from "@/components/CategoryBars";
import { MetricCell } from "@/components/MetricCell";
import { LayerRadar } from "@/components/LayerRadar";
import { TierBadge } from "@/components/TierBadge";
import { METRICS, metricsByLayer } from "@/lib/data/metrics";
import { BackLink } from "@/components/BackLink";

export function generateStaticParams() {
  return AGENTS.map((a) => ({ id: a.id }));
}

export default async function AgentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = agentById(id);
  if (!agent) return notFound();
  const aggregates = getAggregates().filter((a) => a.agentId === agent.id);
  const overall = aggregates.find((a) => a.category === "overall")!;
  const tier = classifyTier(agent.id, getAggregates());
  const runs = getRuns().filter((r) => r.agentId === agent.id);

  const human = getAggregates().filter((a) => a.agentId === "human-mechE");
  const layers = ["L1_geometry", "L2_engineering", "L3_manufacturing", "L4_cognition"] as const;
  const layerVals = layers.map((lay) => {
    const a = aggregates.find((x) => x.category === lay)!;
    const ref = human.find((x) => x.category === lay)?.meanScore;
    return { axis: short(lay), value: a.meanScore, ref };
  });

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <BackLink href="/agents" className="text-xs text-[var(--muted)] hover:underline underline-offset-4">← back</BackLink>
        <div className="flex items-baseline justify-between flex-wrap gap-3">
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="text-2xl tracking-tight">{agent.name}</h1>
            <TierBadge tier={tier} full />
          </div>
          <div className="font-mono text-sm tabular-nums flex flex-wrap gap-x-4 gap-y-1 items-baseline">
            <span>composite <span className="text-base">{overall.meanScore.toFixed(1)}</span> <span className="text-[var(--muted)]">[{overall.ciLow.toFixed(1)}, {overall.ciHigh.toFixed(1)}]</span></span>
            <span>p5 <span className="text-[var(--muted)]">{overall.p5.toFixed(1)}</span></span>
            <span>IRT θ <span className="text-[var(--muted)]">{overall.irtAbility.toFixed(1)}</span></span>
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

      <section className="grid lg:grid-cols-[280px_1fr] gap-6 items-start">
        <div className="border rounded-md bg-[var(--card)] p-4 flex flex-col items-center">
          <LayerRadar values={layerVals} label={agent.id === "human-mechE" ? "human" : "vs. human"} />
          <div className="text-[10px] font-mono text-[var(--muted)] mt-2">solid: agent · dashed: human baseline</div>
        </div>
        <div>
          <h2 className="text-sm font-mono text-[var(--muted)] mb-3">PER-CATEGORY SCORE (95 % CI)</h2>
          <div className="border rounded-md bg-[var(--card)] p-5">
            <CategoryBars aggregates={aggregates} />
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-mono text-[var(--muted)] mb-3">MEAN METRICS BY LAYER</h2>
        <div className="space-y-4">
          {layers.map((lay) => {
            const layMetrics = metricsByLayer(lay).filter((m) => !["latency_p50", "latency_p95", "cost_per_task", "pass_at_5"].includes(m.id));
            return (
              <div key={lay} className="border rounded-md bg-[var(--card)] overflow-x-auto">
                <div className="px-3 py-2 text-[10px] uppercase font-mono text-[var(--muted)] border-b">{layerName(lay)}</div>
                <table className="w-full text-[12px]">
                  <thead className="text-[10px] uppercase font-mono text-[var(--muted)]">
                    <tr className="border-b">
                      <th className="text-left px-3 py-2">Category</th>
                      {layMetrics.map((m) => (
                        <th key={m.id} className="text-right px-2 py-2 font-medium" title={m.formula}>{abbr(m.name)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {CATEGORIES.filter((c) => c.layer === lay).map((c) => {
                      const a = aggregates.find((x) => x.category === c.id)!;
                      return (
                        <tr key={c.id} className="border-b last:border-b-0 hover:bg-[var(--background)]">
                          <td className="px-3 py-2 whitespace-nowrap">
                            <Link href={`/categories/${c.id}`} className="hover:underline underline-offset-4">{c.name}</Link>
                          </td>
                          {layMetrics.map((m) => {
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
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-mono text-[var(--muted)] mb-3">TASK-BY-TASK ARTIFACTS</h2>
        <div className="border rounded-md bg-[var(--card)] divide-y">
          {TASKS.map((t) => {
            const r = runs.find((rr) => rr.taskId === t.id);
            if (!r) return null;
            return (
              <Link href={`/tasks/${t.id}?agent=${agent.id}`} key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--background)] text-[12px]">
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

function short(lay: string) {
  return lay === "L1_geometry" ? "L1 Geom" : lay === "L2_engineering" ? "L2 Eng" : lay === "L3_manufacturing" ? "L3 Mfg" : "L4 Cog";
}
function layerName(lay: string) {
  return lay === "L1_geometry" ? "L1 · Geometry" : lay === "L2_engineering" ? "L2 · Engineering" : lay === "L3_manufacturing" ? "L3 · Manufacturing" : "L4 · Cognition";
}
function abbr(name: string) {
  return name
    .replace("Volumetric IoU", "Vol IoU")
    .replace("Bidirectional Chamfer", "Chamfer")
    .replace("Hausdorff p95", "Hausdorff")
    .replace("Normal Consistency", "NormCons")
    .replace("Edge-Manifoldness", "Manif.")
    .replace("Watertightness", "Watert.")
    .replace("Euler-Poincaré Compliance", "Euler")
    .replace("STEP Round-trip Chamfer", "STEP RT")
    .replace("DFM Composite", "DFM")
    .replace("Parametric Edit Accuracy", "ParamEdit")
    .replace("Constraint Solve Rate", "ConSolve")
    .replace("Mating Clearance", "Mating")
    .replace("Feature Recall", "FeatRec")
    .replace("Named-Dimension RMSE", "Dim RMSE")
    .replace("GD&T Compliance", "GD&T")
    .replace("Fit-Class Compliance", "Fit-Cls")
    .replace("Standards Compliance", "Std")
    .replace("Draft-Angle Compliance", "Draft")
    .replace("Min-Wall Compliance", "Min-Wall")
    .replace("CAM Reachability", "CAM-Reach")
    .replace("Support-Volume Ratio", "Supp")
    .replace("Wall-Thickness Uniformity", "Wall-Unif")
    .replace("Parametric Range Integrity", "P-Range")
    .replace("FEA-Yield Pass", "FEA-σ")
    .replace("Paraphrase IoU σ", "Para σ")
    .replace("Seed σ", "Seed σ")
    .replace("Calibration (Brier)", "Brier")
    .replace("Edit-vs-Fresh Latency", "EditLat")
    .replace("Pass@1", "P@1")
    .replace("Pass@5", "P@5");
}

void METRICS;
