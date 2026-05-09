"use client";

import Link from "next/link";
import { useState } from "react";
import type { Agent, UseCase, Tier } from "@/lib/types";
import { ScoreBar } from "./ScoreBar";

export type LeaderboardRow = {
  agent: Agent;
  tier: Tier;
  rank: Record<UseCase, number>;
  scores: Record<UseCase, { mean: number; p5: number }>;
  irt: number;
  ciLow: number;
  ciHigh: number;
  pass1: number;
  cost: number;
  latency: number;
  paretoIn: Record<UseCase, boolean>;
};

const USE_CASES: { id: UseCase; label: string }[] = [
  { id: "production", label: "Production" },
  { id: "exploration", label: "Exploration" },
  { id: "hobbyist", label: "Hobbyist" },
];

export function Leaderboard({ rows }: { rows: LeaderboardRow[] }) {
  const [uc, setUc] = useState<UseCase>("production");
  const sorted = [...rows].sort((a, b) => a.rank[uc] - b.rank[uc]);
  return (
    <div className="space-y-4">
      <div className="flex gap-1 text-[13px]">
        {USE_CASES.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => setUc(u.id)}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              uc === u.id
                ? "bg-[var(--foreground)] text-white"
                : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--background-2)]"
            }`}
          >
            {u.label}
          </button>
        ))}
      </div>
      <div className="border border-[var(--border)] rounded-md overflow-hidden">
        <table className="w-full text-[14px]">
          <thead className="text-[12px] text-[var(--muted)] bg-[var(--background-2)]">
            <tr className="border-b border-[var(--border)]">
              <th className="text-left font-normal px-4 py-2.5 w-10">#</th>
              <th className="text-left font-normal px-2 py-2.5">Agent</th>
              <th className="text-left font-normal px-2 py-2.5">Score</th>
              <th className="text-right font-normal px-2 py-2.5">Pass@1</th>
              <th className="text-right font-normal px-2 py-2.5 hidden sm:table-cell">Latency</th>
              <th className="text-right font-normal px-4 py-2.5 hidden sm:table-cell">$/task</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={row.agent.id} className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--background-2)]">
                <td className="px-4 py-3 text-[var(--muted)] tabular-nums">{i + 1}</td>
                <td className="px-2 py-3">
                  <Link href={`/agents/${row.agent.id}`} className="hover:underline underline-offset-4">
                    {row.agent.name}
                  </Link>
                  <div className="text-[12px] text-[var(--muted)]">{row.agent.vendor}</div>
                </td>
                <td className="px-2 py-3 w-72">
                  <div className="flex items-center gap-3">
                    <div className="w-10 tabular-nums text-[13px]">{row.scores[uc].mean.toFixed(1)}</div>
                    <div className="flex-1">
                      <ScoreBar value={row.scores[uc].mean} ciLow={row.ciLow} ciHigh={row.ciHigh} />
                    </div>
                  </div>
                </td>
                <td className="px-2 py-3 text-right tabular-nums">{row.pass1.toFixed(0)}%</td>
                <td className="px-2 py-3 text-right tabular-nums hidden sm:table-cell">{row.latency.toFixed(1)}s</td>
                <td className="px-4 py-3 text-right tabular-nums hidden sm:table-cell">${row.cost.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
