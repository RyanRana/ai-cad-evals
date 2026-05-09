import Link from "next/link";

const SECTIONS = [
  { href: "/categories", label: "Categories", desc: "20 categories across 4 layers." },
  { href: "/tasks", label: "Tasks", desc: "The full prompt corpus." },
  { href: "/agents", label: "Agents", desc: "Systems under test." },
  { href: "/design", label: "Design", desc: "Why CAD-Bench looks like this." },
  { href: "/methodology", label: "Methodology", desc: "Scoring, IRT, CIs." },
];

export default function Docs() {
  return (
    <div className="space-y-10">
      <header className="space-y-2 max-w-2xl">
        <h1 className="text-[32px] leading-tight tracking-tight font-medium">Documentation</h1>
        <p className="text-[15px] text-[var(--muted)]">
          Everything behind the leaderboard.
        </p>
      </header>

      <div className="grid sm:grid-cols-2 gap-3">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="border border-[var(--border)] rounded-md p-5 hover:border-[var(--foreground)] transition-colors"
          >
            <div className="text-[15px] font-medium">{s.label}</div>
            <div className="text-[13px] text-[var(--muted)] mt-1">{s.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
