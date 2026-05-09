"use client";

import { useState, type ReactNode } from "react";
import type { UseCase } from "@/lib/types";

const USE_CASES: { id: UseCase; label: string; sub: string }[] = [
  { id: "production", label: "Production engineering", sub: "L2 + L3 weighted" },
  { id: "exploration", label: "Design exploration", sub: "L4 + L1 weighted" },
  { id: "hobbyist", label: "Hobbyist / maker", sub: "FDM + cost weighted" },
];

export function UseCaseTabs({ children }: { children: (uc: UseCase) => ReactNode }) {
  const [uc, setUc] = useState<UseCase>("production");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1 text-[11px] font-mono">
        {USE_CASES.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => setUc(u.id)}
            className={`px-2.5 py-1 rounded-sm border transition-colors ${uc === u.id ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]" : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)]"}`}
            title={u.sub}
          >
            {u.label}
            <span className={`ml-2 text-[10px] ${uc === u.id ? "opacity-70" : "opacity-60"}`}>{u.sub}</span>
          </button>
        ))}
      </div>
      {children(uc)}
    </div>
  );
}
