import { CATEGORIES } from "@/lib/data/categories";
import type { AggregateScore } from "@/lib/types";

// Horizontal small-multiples bar chart: per-category score for one agent.
export function CategoryBars({ aggregates }: { aggregates: AggregateScore[] }) {
  const byCat = new Map(aggregates.filter((a) => a.category !== "overall").map((a) => [a.category, a]));
  return (
    <div className="grid grid-cols-1 gap-1.5">
      {CATEGORIES.map((c) => {
        const a = byCat.get(c.id);
        const v = a?.meanScore ?? 0;
        return (
          <div key={c.id} className="flex items-center gap-3 text-[12px]">
            <div className="w-44 truncate text-[var(--muted)]">{c.name}</div>
            <div className="flex-1 h-1.5 bg-[var(--border)] rounded-sm relative">
              {a && (
                <div
                  className="absolute inset-y-0 bg-[var(--foreground)]/15"
                  style={{ left: `${a.ciLow}%`, width: `${Math.max(0.5, a.ciHigh - a.ciLow)}%` }}
                />
              )}
              <div className="absolute inset-y-0 bg-[var(--foreground)]" style={{ width: `${v}%` }} />
            </div>
            <div className="w-12 text-right tabular-nums font-mono">{v.toFixed(1)}</div>
          </div>
        );
      })}
    </div>
  );
}
