import Link from "next/link";
import { AGENTS } from "@/lib/data/agents";
import { CATEGORIES } from "@/lib/data/categories";
import { TASKS } from "@/lib/data/tasks";
import { getAggregates, getRuns, overallForUseCase, paretoFront, classifyTier } from "@/lib/data/results";
import { Leaderboard, type LeaderboardRow } from "@/components/Leaderboard";
import { ParetoChart } from "@/components/ParetoChart";
import type { UseCase } from "@/lib/types";

export default function Home() {
  const aggregates = getAggregates();
  const runs = getRuns();

  // pre-compute use-case views server-side; client toggles which one shows.
  const useCases: UseCase[] = ["production", "exploration", "hobbyist"];
  const ucScores = Object.fromEntries(useCases.map((uc) => [uc, overallForUseCase(runs, uc)])) as Record<UseCase, ReturnType<typeof overallForUseCase>>;

  const rowsBase = AGENTS.map((a) => {
    const overall = aggregates.find((s) => s.agentId === a.id && s.category === "overall")!;
    const agentRuns = runs.filter((r) => r.agentId === a.id);
    const cost = avg(agentRuns.map((r) => r.costUsd ?? 0));
    return {
      agent: a,
      tier: classifyTier(a.id, aggregates),
      scores: Object.fromEntries(useCases.map((uc) => [uc, ucScores[uc].get(a.id)!])) as Record<UseCase, { mean: number; p5: number }>,
      ciLow: overall.ciLow,
      ciHigh: overall.ciHigh,
      irt: overall.irtAbility,
      pass1: avg(agentRuns.map((r) => (r.metrics.pass_at_1 as number) ?? 0)) * 100,
      cost,
      latency: avg(agentRuns.map((r) => r.latencyMs)) / 1000,
    };
  });

  // pareto frontier per use case
  const paretoByUc = Object.fromEntries(
    useCases.map((uc) => [uc, paretoFront(rowsBase.map((r) => ({ id: r.agent.id, capability: r.scores[uc].mean, cost: r.cost })))]),
  ) as Record<UseCase, Set<string>>;

  // ranks per use case
  const ranksByUc: Record<UseCase, Record<string, number>> = { production: {}, exploration: {}, hobbyist: {} };
  for (const uc of useCases) {
    const ord = [...rowsBase].sort((a, b) => b.scores[uc].mean - a.scores[uc].mean);
    ord.forEach((r, i) => (ranksByUc[uc][r.agent.id] = i));
  }

  const rows: LeaderboardRow[] = rowsBase.map((r) => ({
    agent: r.agent,
    tier: r.tier,
    rank: { production: ranksByUc.production[r.agent.id], exploration: ranksByUc.exploration[r.agent.id], hobbyist: ranksByUc.hobbyist[r.agent.id] },
    scores: r.scores,
    irt: r.irt,
    ciLow: r.ciLow,
    ciHigh: r.ciHigh,
    pass1: r.pass1,
    cost: r.cost,
    latency: r.latency,
    paretoIn: { production: paretoByUc.production.has(r.agent.id), exploration: paretoByUc.exploration.has(r.agent.id), hobbyist: paretoByUc.hobbyist.has(r.agent.id) },
  }));

  return (
    <div className="space-y-12">
      <section className="space-y-3 max-w-3xl">
        <div className="font-mono text-xs text-[var(--muted)]">CAD-Bench v0.5 · sweep 2026-04-12</div>
        <h1 className="text-3xl tracking-tight">A research-grade benchmark for AI CAD agents.</h1>
        <p className="text-[var(--muted)] leading-relaxed">
          {TASKS.length}-task pilot subset of the {sumTasks()}-task suite, run on {AGENTS.length} agents over 5 seeds each.
          Scoring is layered (geometry / engineering / manufacturing / cognition), reported with bootstrapped 95 % CIs, worst-case p5,
          and a 2PL IRT ability θ calibrated against task difficulty. Three use-case views re-weight the layers on the fly;
          a (capability, $/task) Pareto frontier is shown below.
          <Link className="underline underline-offset-4 ml-1" href="/design">Design rationale →</Link>
        </p>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-sm font-mono text-[var(--muted)]">LEADERBOARD · USE-CASE WEIGHTED</h2>
          <span className="text-xs text-[var(--muted)]">95% CI · p5 worst-case · IRT 2PL ability</span>
        </div>
        <Leaderboard rows={rows} />
      </section>

      <section className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
        <div>
          <h2 className="text-sm font-mono text-[var(--muted)] mb-3">PARETO FRONTIER · CAPABILITY vs $/TASK · production weighting</h2>
          <div className="border bg-[var(--card)] rounded-md p-3">
            <ParetoChart
              points={rowsBase.map((r) => ({ agent: r.agent, capability: r.scores.production.mean, cost: r.cost }))}
              paretoIds={paretoByUc.production}
            />
          </div>
          <p className="text-[11px] text-[var(--muted)] mt-2 leading-relaxed">
            Filled markers are on the (capability, $/task) Pareto frontier — every other agent is dominated on both axes by something on the line. The Pareto frontier rotates as the use-case weighting changes; non-production weightings move different agents onto the frontier.
          </p>
        </div>

        <div>
          <h2 className="text-sm font-mono text-[var(--muted)] mb-3">PER-LAYER COMPOSITE</h2>
          <div className="border rounded-md bg-[var(--card)] overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="text-[10px] uppercase font-mono text-[var(--muted)]">
                <tr className="border-b">
                  <th className="text-left px-3 py-2">Agent</th>
                  <th className="text-right px-2 py-2">L1 Geom</th>
                  <th className="text-right px-2 py-2">L2 Eng</th>
                  <th className="text-right px-2 py-2">L3 Mfg</th>
                  <th className="text-right px-3 py-2">L4 Cog</th>
                </tr>
              </thead>
              <tbody>
                {[...rows].sort((a, b) => b.scores.production.mean - a.scores.production.mean).map((r) => (
                  <tr key={r.agent.id} className="border-b last:border-b-0 hover:bg-[var(--background)]">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <Link href={`/agents/${r.agent.id}`} className="hover:underline underline-offset-4">{r.agent.name}</Link>
                    </td>
                    {(["L1_geometry", "L2_engineering", "L3_manufacturing", "L4_cognition"] as const).map((lay) => {
                      const a = aggregates.find((x) => x.agentId === r.agent.id && x.category === lay)!;
                      return (
                        <td key={lay} className="px-2 py-2 text-right tabular-nums font-mono">{a.meanScore.toFixed(1)}</td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-sm font-mono text-[var(--muted)]">PER-CATEGORY · 20 categories across 4 layers · top-3 per column bolded</h2>
          <Link href="/categories" className="text-xs underline underline-offset-4">All categories →</Link>
        </div>
        <div className="border bg-[var(--card)] rounded-md overflow-x-auto">
          <CategoryMatrix />
        </div>
      </section>

      <section className="grid md:grid-cols-4 gap-4">
        <Stat label="Tasks evaluated" value={`${TASKS.length} / ${sumTasks()}`} sub="pilot subset · full v0.5 suite" />
        <Stat label="Categories" value={`${CATEGORIES.length}`} sub="across 4 layers" />
        <Stat label="Agents" value={`${AGENTS.length}`} sub="incl. n=4 human baseline" />
        <Stat label="Compute" value={`${(runs.reduce((a, r) => a + r.latencyMs, 0) / 1000 / 60).toFixed(1)} min`} sub="aggregate wall-clock" />
      </section>
    </div>
  );
}

function avg(xs: number[]) { return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length; }
function sumTasks() { return CATEGORIES.reduce((s, c) => s + c.taskCount, 0); }

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="border rounded-md bg-[var(--card)] p-4">
      <div className="text-[11px] uppercase font-mono text-[var(--muted)]">{label}</div>
      <div className="text-2xl tracking-tight mt-1 tabular-nums">{value}</div>
      <div className="text-[11px] text-[var(--muted)] mt-1">{sub}</div>
    </div>
  );
}

function CategoryMatrix() {
  const aggregates = getAggregates();
  const cats = CATEGORIES;
  const topByCat: Record<string, Set<string>> = {};
  for (const c of cats) {
    const sorted = aggregates.filter((a) => a.category === c.id).sort((a, b) => b.meanScore - a.meanScore).slice(0, 3);
    topByCat[c.id] = new Set(sorted.map((s) => s.agentId));
  }
  const order = AGENTS
    .map((a) => ({ a, o: aggregates.find((s) => s.agentId === a.id && s.category === "overall")!.meanScore }))
    .sort((x, y) => y.o - x.o).map(({ a }) => a);
  const layers = ["L1_geometry", "L2_engineering", "L3_manufacturing", "L4_cognition"] as const;

  return (
    <table className="w-full text-[12px]">
      <thead className="text-[10px] uppercase font-mono text-[var(--muted)]">
        <tr className="border-b">
          <th className="text-left px-3 py-2 sticky left-0 bg-[var(--card)] z-10">Agent</th>
          {layers.map((lay) => (
            cats.filter((c) => c.layer === lay).map((c, ci, arr) => (
              <th key={c.id} className={`text-right px-2 py-2 font-medium ${ci === 0 ? "border-l" : ""}`} title={c.name}>
                <Link className="hover:underline underline-offset-4" href={`/categories/${c.id}`}>{abbr(c.name)}</Link>
              </th>
            ))
          ))}
        </tr>
        <tr className="border-b text-[9px] text-[var(--muted)]">
          <th className="px-3 py-1 sticky left-0 bg-[var(--card)] z-10"></th>
          {layers.flatMap((lay) => {
            const inLayer = cats.filter((c) => c.layer === lay).length;
            const labels: { l: string; n: number }[] = [{ l: layerLabel(lay), n: inLayer }];
            return labels.map((l, i) => (
              <th key={`${lay}-h-${i}`} colSpan={l.n} className="px-2 py-1 border-l text-left tracking-wider">{l.l}</th>
            ));
          })}
        </tr>
      </thead>
      <tbody>
        {order.map((a) => (
          <tr key={a.id} className="border-b last:border-b-0 hover:bg-[var(--background)]">
            <td className="px-3 py-2 sticky left-0 bg-[var(--card)] z-10 whitespace-nowrap">
              <Link href={`/agents/${a.id}`} className="hover:underline underline-offset-4">{a.name}</Link>
            </td>
            {layers.flatMap((lay) =>
              cats.filter((c) => c.layer === lay).map((c, ci) => {
                const s = aggregates.find((x) => x.agentId === a.id && x.category === c.id)!;
                const isTop = topByCat[c.id].has(a.id);
                return (
                  <td key={c.id} className={`px-2 py-2 text-right tabular-nums font-mono ${ci === 0 ? "border-l" : ""}`}>
                    <span className={isTop ? "font-semibold" : ""}>{s.meanScore.toFixed(1)}</span>
                  </td>
                );
              })
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function layerLabel(l: string) {
  return l === "L1_geometry" ? "L1 · GEOMETRY" : l === "L2_engineering" ? "L2 · ENGINEERING" : l === "L3_manufacturing" ? "L3 · MANUFACTURING" : "L4 · COGNITION";
}

function abbr(name: string) {
  return name
    .replace("Geometric ", "")
    .replace("Compliance", "")
    .replace("Robustness", "Robust")
    .replace("Mechanical Parts", "Mech")
    .replace(" & ", "/")
    .replace("Standards Compliance", "Standards")
    .replace("Sheet-Metal Bodies", "Sheet")
    .replace("Sealing-Groove Design", "Seals")
    .replace("Kinematic Mechanisms", "Kinem.")
    .replace("DFM · 3-Axis CNC", "CNC")
    .replace("DFM · Injection Mould", "Mould")
    .replace("DFM · FDM 3D Print", "FDM")
    .replace("CAM Toolpath Validity", "CAM")
    .replace("Constraint Solving & Editability", "Param")
    .replace("Reverse Engineering", "RevEng")
    .replace("2-D Sketch Constraints", "Sketch")
    .replace("Functional Intent · FEA-Gated", "Func/FEA")
    .replace("Paraphrase Robustness", "Para")
    .replace("Confidence Calibration", "Calib")
    .replace("Free-form Surfaces", "Surf.")
    .replace("BREP Fidelity", "BREP")
    .replace("Boolean Robust", "Bool.")
    .replace("Assembly/Mating", "Mate")
    .trim();
}
