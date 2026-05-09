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
    <div className="space-y-14">
      <section className="grid md:grid-cols-[1fr_auto] md:gap-10 items-end border-b pb-10">
        <div className="space-y-5 max-w-3xl">
          <div className="eyebrow">Report 02 · CAD-Bench Lab · May 2026</div>
          <h1 className="font-serif text-[46px] md:text-[58px] leading-[1.02] tracking-tight">
            A research-grade benchmark for{" "}
            <span className="italic text-[var(--accent)]">AI&nbsp;CAD agents</span>.
          </h1>
          <p className="text-[var(--muted)] leading-[1.7] text-[15px] max-w-2xl">
            {TASKS.length}-task pilot subset of the {sumTasks()}-task suite, run across {AGENTS.length} agents at 5
            seeds each. Scoring is layered — geometry, engineering, manufacturability, cognition — and reported
            with bootstrapped 95 % CIs, worst-case p5, and a 2PL IRT ability&nbsp;θ calibrated against task
            difficulty. Three use-case views re-weight the layers on the fly; a (capability, $/task) Pareto
            frontier is shown below.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-[12px] font-mono text-[var(--muted)]">
            <Link href="/design" className="link">Design rationale →</Link>
            <Link href="/methodology" className="link">Methodology →</Link>
            <Link href="/tasks" className="link">Task corpus →</Link>
            <a href="#" className="link">Reproduce (Vercel Sandbox) →</a>
          </div>
        </div>
        <aside className="hidden md:block surface w-[260px] p-4 text-[11px] font-mono leading-[1.7] text-[var(--muted)]">
          <div className="eyebrow mb-2">Abstract</div>
          <p className="text-[var(--foreground)]/85">
            We evaluate <span className="text-[var(--foreground)]">{AGENTS.length}</span> AI CAD agents — including
            native generators, LLM+kernel pipelines, and a <span className="text-[var(--foreground)]">human</span>{" "}
            baseline (n=4) — on {sumTasks()} prompts spanning {CATEGORIES.length} categories.
          </p>
          <p className="mt-2">
            Headline finding: mesh-only image-to-3D models score in single digits on BREP fidelity despite
            high visual quality; senior engineers retain a 14-point engineering-layer lead over the strongest AI
            agent at 100× wall-clock cost.
          </p>
        </aside>
      </section>

      <section>
        <div className="flex items-end justify-between mb-5">
          <h2 className="font-serif text-[26px] tracking-tight leading-none">
            <span className="section-no mr-3">§1</span>Leaderboard
            <span className="text-[var(--muted)] font-sans text-[13px] ml-3 align-middle">use-case weighted</span>
          </h2>
          <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--muted)]">
            95 % CI · p5 worst-case · IRT 2PL θ
          </span>
        </div>
        <Leaderboard rows={rows} />
      </section>

      <section className="grid lg:grid-cols-[1.4fr_1fr] gap-8">
        <div>
          <h2 className="font-serif text-[22px] tracking-tight leading-none mb-1">
            <span className="section-no mr-3">§2</span>Pareto frontier
          </h2>
          <div className="eyebrow mb-3">capability · $/task · production weighting</div>
          <div className="surface rounded-sm p-3">
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
          <h2 className="font-serif text-[22px] tracking-tight leading-none mb-1">
            <span className="section-no mr-3">§3</span>Per-layer composite
          </h2>
          <div className="eyebrow mb-3">L1·geom / L2·eng / L3·mfg / L4·cog</div>
          <div className="surface rounded-sm overflow-x-auto">
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
        <div className="flex items-end justify-between mb-5">
          <div>
            <h2 className="font-serif text-[26px] tracking-tight leading-none">
              <span className="section-no mr-3">§4</span>Per-category matrix
            </h2>
            <div className="eyebrow mt-2">20 categories across 4 layers · top-3 per column bolded</div>
          </div>
          <Link href="/categories" className="text-[12px] font-mono link">All categories →</Link>
        </div>
        <div className="surface rounded-sm overflow-x-auto">
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
    <div className="surface rounded-sm p-5">
      <div className="eyebrow">{label}</div>
      <div className="font-serif text-[34px] leading-none tracking-tight mt-3 tabular-nums">{value}</div>
      <div className="text-[11px] text-[var(--muted)] mt-2 font-mono">{sub}</div>
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
