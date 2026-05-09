import Link from "next/link";
import { TASKS } from "@/lib/data/tasks";
import { CATEGORIES, categoryById } from "@/lib/data/categories";

export default function TasksIndex() {
  return (
    <div className="space-y-8">
      <header>
        <div className="font-mono text-xs text-[var(--muted)]">TASKS · pilot subset</div>
        <h1 className="text-2xl tracking-tight">{TASKS.length} prompts across {CATEGORIES.length} categories</h1>
        <p className="text-[var(--muted)] text-sm mt-2 max-w-3xl leading-relaxed">
          Each task carries a verbatim natural-language prompt, a canonical reference STEP (sha-256 in the listing),
          numerical ground-truth quantities (volume, surface area, Euler χ, genus, named features), and a
          difficulty class 1-5. Click a task to see the held-out reference, candidate output viewers, and
          metric scores per agent.
        </p>
      </header>
      {CATEGORIES.map((c) => {
        const ts = TASKS.filter((t) => t.category === c.id);
        if (ts.length === 0) return null;
        return (
          <section key={c.id}>
            <h2 className="text-sm font-mono mb-3 flex items-baseline gap-3">
              <span>{c.name}</span>
              <span className="text-[var(--muted)] text-xs">w = {c.weight.toFixed(2)} · {ts.length}/{c.taskCount} shown</span>
            </h2>
            <div className="border rounded-md bg-[var(--card)] divide-y">
              {ts.map((t) => (
                <Link
                  key={t.id}
                  href={`/tasks/${t.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--background)] text-[12.5px]"
                >
                  <span className="font-mono text-[10px] text-[var(--muted)] w-20">{t.id}</span>
                  <span className="flex-1 truncate">{t.title}</span>
                  <span className="font-mono text-[10px] text-[var(--muted)]">d{t.difficulty}/5</span>
                  <span className="font-mono text-[10px] text-[var(--muted)] hidden sm:inline">{t.groundTruthHash}</span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
// silence the unused-import lint; categoryById is part of the public lib API.
void categoryById;
