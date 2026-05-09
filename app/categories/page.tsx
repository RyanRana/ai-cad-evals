import Link from "next/link";
import { CATEGORIES, LAYER_WEIGHTS } from "@/lib/data/categories";
import { metricById } from "@/lib/data/metrics";

const LAYERS = [
  { id: "L1_geometry", name: "L1 · Geometry", desc: "Automatic geometric metrics. Cheap, deterministic, no domain reasoning needed. The noise floor of the suite." },
  { id: "L2_engineering", name: "L2 · Engineering", desc: "Named-dimension matching, GD&T parsers, partner-part assembly simulation. Requires CAD-kernel reasoning about engineering intent." },
  { id: "L3_manufacturing", name: "L3 · Manufacturing", desc: "Process-specific analyzers — DFM rules, CAM postprocessor, draft / wall / overhang checks. Different per process." },
  { id: "L4_cognition", name: "L4 · Cognition", desc: "Robustness and intent. Paraphrase variance, parametric range survival, FEA-pass at spec'd loads, calibration of self-reported confidence." },
] as const;

export default function CategoriesIndex() {
  return (
    <div className="space-y-8">
      <header>
        <div className="font-mono text-xs text-[var(--muted)]">CATEGORIES</div>
        <h1 className="text-2xl tracking-tight">{CATEGORIES.length} categories across 4 layers</h1>
        <p className="text-[var(--muted)] text-sm mt-2 max-w-3xl leading-relaxed">
          The CAD-Bench composite is a layer-weighted mean. The four layers each have a different *correct judging modality* —
          mixing them obscures what an agent is actually good at. Default layer weights: L1 0.20, L2 0.35, L3 0.25, L4 0.20.
          The leaderboard re-weights these per use case (production / exploration / hobbyist).
          See <Link href="/design" className="underline underline-offset-4">/design</Link> for the rationale.
        </p>
      </header>
      {LAYERS.map((lay) => (
        <section key={lay.id}>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-base">{lay.name}</h2>
            <span className="font-mono text-[10px] text-[var(--muted)]">w_layer = {LAYER_WEIGHTS[lay.id].toFixed(2)} · {CATEGORIES.filter((c) => c.layer === lay.id).length} categories</span>
          </div>
          <p className="text-[12.5px] text-[var(--muted)] leading-relaxed mb-3 max-w-3xl">{lay.desc}</p>
          <div className="grid md:grid-cols-2 gap-3">
            {CATEGORIES.filter((c) => c.layer === lay.id).map((c) => (
              <Link href={`/categories/${c.id}`} key={c.id} className="border rounded-md bg-[var(--card)] p-4 block hover:border-[var(--foreground)] transition-colors">
                <div className="flex items-baseline justify-between mb-1">
                  <div className="text-sm">{c.name}</div>
                  <div className="font-mono text-[11px] text-[var(--muted)]">w={c.weight.toFixed(2)} · n={c.taskCount}</div>
                </div>
                <div className="text-[11px] font-mono text-[var(--muted)] mb-2">judging: {c.judgingModality}</div>
                <p className="text-[12px] text-[var(--muted)] leading-relaxed mb-3">{c.description}</p>
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
        </section>
      ))}
    </div>
  );
}
