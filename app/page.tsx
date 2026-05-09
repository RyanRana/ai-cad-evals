import Link from "next/link";
import { AGENTS } from "@/lib/data/agents";
import { CATEGORIES } from "@/lib/data/categories";
import { TASKS } from "@/lib/data/tasks";
import { getAggregates, getRuns } from "@/lib/data/results";
import { ScoreBar } from "@/components/ScoreBar";
import { MetricCell } from "@/components/MetricCell";

export default function Home() {
  const aggregates = getAggregates();
  const runs = getRuns();

  const overall = AGENTS.map((a) => ({
    agent: a,
    score: aggregates.find((s) => s.agentId === a.id && s.category === "overall")!,
    runs: runs.filter((r) => r.agentId === a.id),
  }))
    .map((row) => ({
      ...row,
      pass1: avg(row.runs.map((r) => (r.metrics.pass_at_1 as number) ?? 0)) * 100,
      cost: avg(row.runs.map((r) => r.costUsd ?? 0)),
      latency: avg(row.runs.map((r) => r.latencyMs)) / 1000,
    }))
    .sort((a, b) => b.score.meanScore - a.score.meanScore);

  return (
    <div className="space-y-12">
      <section className="space-y-3 max-w-3xl">
        <div className="font-mono text-xs text-[var(--muted)]">CAD-Bench v0.4 · sweep 2026-04-12</div>
        <h1 className="text-3xl tracking-tight">A research-grade benchmark for AI CAD agents.</h1>
        <p className="text-[var(--muted)] leading-relaxed">
          {TASKS.length}-task pilot subset of the {sumTasks()}-task suite, run on {AGENTS.length} agents
          over 5 seeds each. Scores are bootstrapped (B = 1000) means with 95% CIs across volumetric IoU,
          Chamfer / Hausdorff distances, BREP fidelity (STEP round-trip), DFM compliance, parametric editability,
          and assembly mating. <Link className="underline underline-offset-4" href="/methodology">Methodology →</Link>
        </p>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-sm font-mono text-[var(--muted)]">LEADERBOARD · COMPOSITE SCORE</h2>
          <span className="text-xs text-[var(--muted)]">95% CI from 1000-bootstrap on per-task scores</span>
        </div>
        <div className="border bg-[var(--card)] rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-[var(--muted)]">
              <tr className="border-b">
                <th className="text-left font-medium px-4 py-3 w-10">#</th>
                <th className="text-left font-medium px-2 py-3">Agent</th>
                <th className="text-left font-medium px-2 py-3 hidden md:table-cell">Runtime</th>
                <th className="text-left font-medium px-2 py-3">Composite</th>
                <th className="text-right font-medium px-2 py-3">Pass@1</th>
                <th className="text-right font-medium px-2 py-3 hidden sm:table-cell">p50 lat.</th>
                <th className="text-right font-medium px-4 py-3 hidden sm:table-cell">$/task</th>
              </tr>
            </thead>
            <tbody>
              {overall.map((row, i) => (
                <tr key={row.agent.id} className="border-b last:border-b-0 hover:bg-[var(--background)]">
                  <td className="px-4 py-3 text-[var(--muted)] tabular-nums">{i + 1}</td>
                  <td className="px-2 py-3">
                    <Link href={`/agents/${row.agent.id}`} className="hover:underline underline-offset-4">
                      {row.agent.name}
                    </Link>
                    <div className="text-[11px] text-[var(--muted)]">{row.agent.vendor}</div>
                  </td>
                  <td className="px-2 py-3 hidden md:table-cell font-mono text-[11px] text-[var(--muted)]">
                    {row.agent.runtime} · {row.agent.representation}
                  </td>
                  <td className="px-2 py-3 w-72">
                    <div className="flex items-center gap-3">
                      <div className="w-12 tabular-nums font-mono text-[13px]">{row.score.meanScore.toFixed(1)}</div>
                      <div className="flex-1">
                        <ScoreBar value={row.score.meanScore} ciLow={row.score.ciLow} ciHigh={row.score.ciHigh} />
                        <div className="text-[10px] tabular-nums text-[var(--muted)] mt-0.5 font-mono">
                          [{row.score.ciLow.toFixed(1)}, {row.score.ciHigh.toFixed(1)}] · n={row.score.n}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-3 text-right">
                    <MetricCell value={row.pass1 / 100} format="pct" />
                  </td>
                  <td className="px-2 py-3 text-right hidden sm:table-cell">
                    <MetricCell value={row.latency} format="fixed1" unit="s" />
                  </td>
                  <td className="px-4 py-3 text-right hidden sm:table-cell">
                    <MetricCell value={row.cost} format="fixed3" unit="$" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-sm font-mono text-[var(--muted)]">PER-CATEGORY · TOP-3 PER COLUMN BOLDED</h2>
          <Link href="/categories" className="text-xs underline underline-offset-4">All categories →</Link>
        </div>
        <div className="border bg-[var(--card)] rounded-md overflow-x-auto">
          <CategoryMatrix />
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-4">
        <Stat label="Tasks evaluated" value={`${TASKS.length} / ${sumTasks()}`} sub="pilot subset · full suite v0.4" />
        <Stat label="Agents" value={`${AGENTS.length}`} sub="incl. n=4 human baseline" />
        <Stat label="Compute" value={`${(runs.reduce((a, r) => a + r.latencyMs, 0) / 1000 / 60).toFixed(1)} min`} sub="aggregate wall-clock for synthetic pilot" />
      </section>
    </div>
  );
}

function avg(xs: number[]) {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

function sumTasks() {
  return CATEGORIES.reduce((s, c) => s + c.taskCount, 0);
}

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
    const sorted = aggregates
      .filter((a) => a.category === c.id)
      .sort((a, b) => b.meanScore - a.meanScore)
      .slice(0, 3);
    topByCat[c.id] = new Set(sorted.map((s) => s.agentId));
  }
  const order = AGENTS
    .map((a) => ({ a, o: aggregates.find((s) => s.agentId === a.id && s.category === "overall")!.meanScore }))
    .sort((x, y) => y.o - x.o)
    .map(({ a }) => a);

  return (
    <table className="w-full text-[12px]">
      <thead className="text-[10px] uppercase font-mono text-[var(--muted)]">
        <tr className="border-b">
          <th className="text-left px-3 py-2 sticky left-0 bg-[var(--card)] z-10">Agent</th>
          {cats.map((c) => (
            <th key={c.id} className="text-right px-2 py-2 font-medium" title={c.name}>
              <Link className="hover:underline underline-offset-4" href={`/categories/${c.id}`}>{abbr(c.name)}</Link>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {order.map((a) => (
          <tr key={a.id} className="border-b last:border-b-0 hover:bg-[var(--background)]">
            <td className="px-3 py-2 sticky left-0 bg-[var(--card)] z-10 whitespace-nowrap">
              <Link href={`/agents/${a.id}`} className="hover:underline underline-offset-4">{a.name}</Link>
            </td>
            {cats.map((c) => {
              const s = aggregates.find((x) => x.agentId === a.id && x.category === c.id)!;
              const isTop = topByCat[c.id].has(a.id);
              return (
                <td key={c.id} className="px-2 py-2 text-right tabular-nums font-mono">
                  <span className={isTop ? "font-semibold" : ""}>{s.meanScore.toFixed(1)}</span>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function abbr(name: string) {
  return name
    .replace("Geometric ", "")
    .replace("Compliance", "")
    .replace("Robustness", "Robust")
    .replace("Mechanical Parts", "Mech")
    .replace(" & ", "/")
    .replace("Engineering from Drawing", "Eng")
    .replace("Solving & Editability", "Solving")
    .replace("Free-form Surfacing", "Surfacing")
    .trim();
}
