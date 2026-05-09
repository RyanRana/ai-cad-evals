import Link from "next/link";
import { notFound } from "next/navigation";
import { CATEGORIES, categoryById } from "@/lib/data/categories";
import { AGENTS } from "@/lib/data/agents";
import { TASKS } from "@/lib/data/tasks";
import { metricById } from "@/lib/data/metrics";
import { getAggregates } from "@/lib/data/results";
import { ScoreBar } from "@/components/ScoreBar";

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ id: c.id }));
}

export default async function CategoryDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cat = categoryById(id);
  if (!cat) return notFound();
  const aggs = getAggregates().filter((a) => a.category === cat.id).sort((a, b) => b.meanScore - a.meanScore);
  const ts = TASKS.filter((t) => t.category === cat.id);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Link href="/categories" className="text-xs text-[var(--muted)] hover:underline underline-offset-4">← all categories</Link>
        <h1 className="text-2xl tracking-tight">{cat.name}</h1>
        <p className="text-[var(--muted)] text-sm leading-relaxed max-w-3xl">{cat.description}</p>
        <div className="flex flex-wrap gap-2 pt-2">
          {cat.primaryMetrics.map((m) => {
            const md = metricById(m)!;
            return (
              <span key={m} className="text-[11px] font-mono px-2 py-0.5 rounded-sm border" title={md.formula}>
                {md.name} <span className="text-[var(--muted)]">· {md.unit} · {md.higherIsBetter ? "↑" : "↓"}</span>
              </span>
            );
          })}
        </div>
      </header>

      <section>
        <h2 className="text-sm font-mono text-[var(--muted)] mb-3">RANKED AGENTS · 95 % CI</h2>
        <div className="border rounded-md bg-[var(--card)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase font-mono text-[var(--muted)]">
              <tr className="border-b">
                <th className="text-left px-4 py-3 w-10">#</th>
                <th className="text-left px-2 py-3">Agent</th>
                <th className="text-left px-2 py-3 w-72">Score</th>
              </tr>
            </thead>
            <tbody>
              {aggs.map((a, i) => {
                const agent = AGENTS.find((x) => x.id === a.agentId)!;
                return (
                  <tr key={a.agentId} className="border-b last:border-b-0 hover:bg-[var(--background)]">
                    <td className="px-4 py-3 text-[var(--muted)] tabular-nums">{i + 1}</td>
                    <td className="px-2 py-3">
                      <Link href={`/agents/${agent.id}`} className="hover:underline underline-offset-4">{agent.name}</Link>
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 tabular-nums font-mono text-[13px]">{a.meanScore.toFixed(1)}</div>
                        <div className="flex-1">
                          <ScoreBar value={a.meanScore} ciLow={a.ciLow} ciHigh={a.ciHigh} />
                          <div className="text-[10px] tabular-nums text-[var(--muted)] mt-0.5 font-mono">
                            [{a.ciLow.toFixed(1)}, {a.ciHigh.toFixed(1)}] · n={a.n}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-mono text-[var(--muted)] mb-3">TASKS IN THIS CATEGORY</h2>
        <div className="border rounded-md bg-[var(--card)] divide-y">
          {ts.map((t) => (
            <Link key={t.id} href={`/tasks/${t.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--background)] text-[12.5px]">
              <span className="font-mono text-[10px] text-[var(--muted)] w-20">{t.id}</span>
              <span className="flex-1 truncate">{t.title}</span>
              <span className="font-mono text-[10px] text-[var(--muted)]">d{t.difficulty}/5</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
