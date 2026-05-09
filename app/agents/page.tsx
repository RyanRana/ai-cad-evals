import Link from "next/link";
import { AGENTS } from "@/lib/data/agents";
import { getAggregates } from "@/lib/data/results";
import { ScoreBar } from "@/components/ScoreBar";

export default function AgentsIndex() {
  const aggregates = getAggregates();
  const rows = AGENTS.map((a) => ({
    agent: a,
    overall: aggregates.find((s) => s.agentId === a.id && s.category === "overall")!,
  })).sort((x, y) => y.overall.meanScore - x.overall.meanScore);
  return (
    <div className="space-y-6">
      <header>
        <div className="font-mono text-xs text-[var(--muted)]">AGENTS</div>
        <h1 className="text-2xl tracking-tight">{AGENTS.length} CAD-generation systems under test</h1>
      </header>
      <div className="grid md:grid-cols-2 gap-4">
        {rows.map(({ agent, overall }) => (
          <Link
            key={agent.id}
            href={`/agents/${agent.id}`}
            className="border rounded-md bg-[var(--card)] p-5 block hover:border-[var(--foreground)] transition-colors"
          >
            <div className="flex items-baseline justify-between mb-2">
              <div>
                <div className="text-base">{agent.name}</div>
                <div className="text-[11px] text-[var(--muted)]">{agent.vendor} · {agent.version}</div>
              </div>
              <div className="font-mono tabular-nums text-sm">{overall.meanScore.toFixed(1)}</div>
            </div>
            <ScoreBar value={overall.meanScore} ciLow={overall.ciLow} ciHigh={overall.ciHigh} />
            <div className="mt-3 text-[11px] text-[var(--muted)] flex gap-4 font-mono">
              <span>{agent.runtime}</span>
              <span>·</span>
              <span>{agent.representation}</span>
              <span>·</span>
              <span>{agent.license}</span>
            </div>
            <p className="mt-3 text-[12px] text-[var(--muted)] leading-relaxed line-clamp-3">{agent.notes}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
