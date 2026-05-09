import { AGENTS } from "@/lib/data/agents";
import { CATEGORIES } from "@/lib/data/categories";
import { TASKS } from "@/lib/data/tasks";
import { getAggregates, getRuns, overallForUseCase, paretoFront, classifyTier } from "@/lib/data/results";
import { Leaderboard, type LeaderboardRow } from "@/components/Leaderboard";
import type { UseCase } from "@/lib/types";

export default function Home() {
  const aggregates = getAggregates();
  const runs = getRuns();

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

  const paretoByUc = Object.fromEntries(
    useCases.map((uc) => [uc, paretoFront(rowsBase.map((r) => ({ id: r.agent.id, capability: r.scores[uc].mean, cost: r.cost })))]),
  ) as Record<UseCase, Set<string>>;

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
      <section className="space-y-3 max-w-2xl">
        <h1 className="text-[32px] leading-tight tracking-tight font-medium">
          CAD-Bench
        </h1>
        <p className="text-[15px] text-[var(--muted)] leading-relaxed">
          An open benchmark for AI CAD agents. {TASKS.length} tasks across {CATEGORIES.length} categories,
          evaluated on {AGENTS.length} agents.
        </p>
      </section>

      <section>
        <Leaderboard rows={rows} />
      </section>
    </div>
  );
}

function avg(xs: number[]) { return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length; }
