import Link from "next/link";
import { CATEGORIES } from "@/lib/data/categories";
import { metricById } from "@/lib/data/metrics";

export default function CategoriesIndex() {
  return (
    <div className="space-y-6">
      <header>
        <div className="font-mono text-xs text-[var(--muted)]">CATEGORIES</div>
        <h1 className="text-2xl tracking-tight">{CATEGORIES.length} task categories · weighted composite</h1>
        <p className="text-[var(--muted)] text-sm mt-2 max-w-3xl leading-relaxed">
          The CAD-Bench composite is a category-weighted mean. Weights were set so that engineering-relevant skills
          (parametric mechanical parts, mating, DFM) dominate over noise-floor categories (primitives) and rare ones
          (free-form). Each category lists the metrics that govern its score.
        </p>
      </header>
      <div className="grid md:grid-cols-2 gap-4">
        {CATEGORIES.map((c) => (
          <Link href={`/categories/${c.id}`} key={c.id} className="border rounded-md bg-[var(--card)] p-5 block hover:border-[var(--foreground)] transition-colors">
            <div className="flex items-baseline justify-between mb-1">
              <div className="text-base">{c.name}</div>
              <div className="font-mono text-[12px] text-[var(--muted)]">w={c.weight.toFixed(2)} · n={c.taskCount}</div>
            </div>
            <p className="text-[12.5px] text-[var(--muted)] leading-relaxed mb-3">{c.description}</p>
            <div className="flex flex-wrap gap-1">
              {c.primaryMetrics.map((m) => (
                <span key={m} className="text-[10px] font-mono px-2 py-0.5 rounded-sm border" title={metricById(m)?.formula}>
                  {metricById(m)?.name}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
