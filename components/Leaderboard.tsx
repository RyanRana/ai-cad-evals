"use client";

import Link from "next/link";
import { useState } from "react";
import type { Agent, UseCase, Tier } from "@/lib/types";
import { ScoreBar } from "./ScoreBar";
import { TierBadge } from "./TierBadge";

export type LeaderboardRow = {
  agent: Agent;
  tier: Tier;
  rank: Record<UseCase, number>;
  scores: Record<UseCase, { mean: number; p5: number }>;
  irt: number; // 0..100 normalized IRT ability
  ciLow: number;
  ciHigh: number;
  pass1: number; // 0..100
  cost: number; // $/task
  latency: number; // seconds
  paretoIn: Record<UseCase, boolean>;
};

const USE_CASES: { id: UseCase; label: string; sub: string }[] = [
  { id: "production", label: "Production engineering", sub: "L2 + L3 weighted" },
  { id: "exploration", label: "Design exploration", sub: "L4 + L1 weighted" },
  { id: "hobbyist", label: "Hobbyist / maker", sub: "FDM + cost weighted" },
];

export function Leaderboard({ rows }: { rows: LeaderboardRow[] }) {
  const [uc, setUc] = useState<UseCase>("production");
  const sorted = [...rows].sort((a, b) => a.rank[uc] - b.rank[uc]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5 text-[11px] font-mono">
        {USE_CASES.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => setUc(u.id)}
            className={`px-3 py-1.5 rounded-sm border transition-colors ${uc === u.id ? "bg-[var(--accent)] text-[var(--background)] border-[var(--accent)]" : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--accent-dim)]"}`}
            title={u.sub}
          >
            {u.label}
            <span className={`ml-2 text-[10px] ${uc === u.id ? "opacity-80" : "opacity-60"}`}>{u.sub}</span>
          </button>
        ))}
      </div>
      <div className="surface rounded-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wide text-[var(--muted)]">
            <tr className="border-b">
              <th className="text-left font-medium px-4 py-3 w-10">#</th>
              <th className="text-left font-medium px-2 py-3">Agent</th>
              <th className="text-left font-medium px-2 py-3 hidden md:table-cell">Tier</th>
              <th className="text-left font-medium px-2 py-3" title="Use-case-weighted composite (mean, 95% CI bar) and worst-case p5 score, both 0–100.">Composite · p5</th>
              <th className="text-right font-medium px-2 py-3 hidden lg:table-cell" title="2PL Item-Response-Theory ability (logit-scale, normalized to 0–100). Calibrated against task difficulty so harder tasks weigh more.">IRT θ</th>
              <th className="text-right font-medium px-2 py-3" title="Pass@1 — single-sample gating predicate, see /methodology.">Pass@1</th>
              <th className="text-right font-medium px-2 py-3 hidden sm:table-cell">p50 lat.</th>
              <th className="text-right font-medium px-4 py-3 hidden sm:table-cell">$/task</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => {
              const onPareto = row.paretoIn[uc];
              return (
                <tr key={row.agent.id} className="border-b last:border-b-0 hover:bg-[var(--background)]">
                  <td className="px-4 py-3 text-[var(--muted)] tabular-nums">{i + 1}</td>
                  <td className="px-2 py-3">
                    <Link href={`/agents/${row.agent.id}`} className="hover:text-[var(--accent)] inline-flex items-center gap-2">
                      {row.agent.name}
                      {onPareto && <span title="On the (capability, $/task) Pareto frontier" className="text-[10px] font-mono px-1.5 py-px rounded-sm bg-[var(--accent)] text-[var(--background)]">PARETO</span>}
                    </Link>
                    <div className="text-[11px] text-[var(--muted)]">{row.agent.vendor}</div>
                  </td>
                  <td className="px-2 py-3 hidden md:table-cell">
                    <TierBadge tier={row.tier} />
                  </td>
                  <td className="px-2 py-3 w-80">
                    <div className="flex items-center gap-3">
                      <div className="w-12 tabular-nums font-mono text-[13px]">{row.scores[uc].mean.toFixed(1)}</div>
                      <div className="flex-1">
                        <ScoreBar value={row.scores[uc].mean} ciLow={row.ciLow} ciHigh={row.ciHigh} />
                        <div className="text-[10px] tabular-nums text-[var(--muted)] mt-0.5 font-mono">
                          [{row.ciLow.toFixed(1)}, {row.ciHigh.toFixed(1)}] · p5={row.scores[uc].p5.toFixed(1)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums font-mono hidden lg:table-cell">{row.irt.toFixed(1)}</td>
                  <td className="px-2 py-3 text-right tabular-nums font-mono">{row.pass1.toFixed(0)}%</td>
                  <td className="px-2 py-3 text-right tabular-nums font-mono hidden sm:table-cell">{row.latency.toFixed(1)}s</td>
                  <td className="px-4 py-3 text-right tabular-nums font-mono hidden sm:table-cell">${row.cost.toFixed(3)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
