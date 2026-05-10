// Data-source resolution order, highest priority first:
//   1. Postgres `aggregates` / `runs` tables (when POSTGRES_URL is set)
//   2. bench/_artifacts/runs.json on disk (local sweep output)
//   3. Synthetic deterministic generator in ./results (preview fallback)
//
// 2 lets us show real numbers from a local sweep without provisioning DB+Blob.

import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import type { AggregateScore, RunResult, CategoryId, MetricId, Layer, UseCase } from "../types";
import { getAggregates as syntheticAggregates, getRuns as syntheticRuns, aggregate as aggregateRuns } from "./results";

const RUNS_JSON_PATH = path.join(process.cwd(), "bench", "_artifacts", "runs.json");

type JsonRun = {
  agent_id: string; task_id: string; seed: number;
  finished_at: string;
  latency_ms: number; cost_usd: number;
  candidate_blob: string | null; error: string | null;
  metrics: Record<string, number | boolean | null>;
};

let _jsonCache: { mtimeMs: number; runs: RunResult[] } | null = null;
function loadJsonRuns(): RunResult[] | null {
  try {
    const stat = fs.statSync(RUNS_JSON_PATH);
    if (_jsonCache && _jsonCache.mtimeMs === stat.mtimeMs) return _jsonCache.runs;
    const raw = JSON.parse(fs.readFileSync(RUNS_JSON_PATH, "utf-8")) as { runs: JsonRun[] };
    const runs: RunResult[] = raw.runs.map((r) => ({
      agentId: r.agent_id,
      taskId: r.task_id,
      seed: r.seed,
      timestamp: r.finished_at,
      latencyMs: r.latency_ms,
      costUsd: Number(r.cost_usd),
      metrics: r.metrics as Partial<Record<MetricId, number | boolean | null>>,
      error: r.error ?? undefined,
    }));
    _jsonCache = { mtimeMs: stat.mtimeMs, runs };
    return runs;
  } catch {
    return null;
  }
}

/**
 * Merge real bench runs over the synthetic baseline, keyed by (agentId,
 * taskId, seed). The synthetic data gives every (agent, task) cell a value;
 * any cell with a real run wins. As coverage grows, real data crowds out
 * synthetic until none is left.
 */
function mergedRuns(): RunResult[] | null {
  const real = loadJsonRuns();
  if (!real || real.length === 0) return null;
  const synthetic = syntheticRuns();
  const key = (r: RunResult) => `${r.agentId}|${r.taskId}|${r.seed}`;
  const map = new Map<string, RunResult>();
  for (const r of synthetic) map.set(key(r), r);
  for (const r of real) map.set(key(r), r);
  return [...map.values()];
}

let _sql: ReturnType<typeof postgres> | null | undefined;
function sql() {
  if (_sql !== undefined) return _sql;
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) { _sql = null; return null; }
  _sql = postgres(url, { ssl: "require", max: 4, idle_timeout: 20 });
  return _sql;
}

export async function getAggregatesAsync(): Promise<AggregateScore[]> {
  const s = sql();
  if (!s) {
    const merged = mergedRuns();
    if (merged) return aggregateRuns(merged);
    return syntheticAggregates();
  }
  try {
    const rows = await s<Array<{
      agent_id: string; category: string; n: number;
      mean_score: number; p5: number; ci_low: number; ci_high: number;
      irt_ability: number; metric_means: Record<string, number>;
    }>>`SELECT agent_id, category, n, mean_score, p5, ci_low, ci_high, irt_ability, metric_means FROM aggregates`;
    if (rows.length === 0) return syntheticAggregates();
    return rows.map((r) => ({
      agentId: r.agent_id,
      category: r.category as CategoryId | Layer | "overall",
      n: r.n,
      meanScore: Number(r.mean_score),
      p5: Number(r.p5),
      ciLow: Number(r.ci_low),
      ciHigh: Number(r.ci_high),
      irtAbility: Number(r.irt_ability),
      metricMeans: (r.metric_means || {}) as Partial<Record<MetricId, number>>,
    }));
  } catch (e) {
    console.warn("[results-db] falling back to synthetic:", (e as Error).message);
    return syntheticAggregates();
  }
}

export async function getRunsAsync(): Promise<RunResult[]> {
  const s = sql();
  if (!s) {
    const merged = mergedRuns();
    return merged ?? syntheticRuns();
  }
  try {
    const rows = await s<Array<{
      id: number; agent_id: string; task_id: string; seed: number;
      finished_at: string;
      latency_ms: number; cost_usd: number; error: string | null;
      metric_id: string | null; value_num: number | null; value_bool: boolean | null;
    }>>`
      SELECT r.id, r.agent_id, r.task_id, r.seed,
             r.finished_at::text AS finished_at,
             r.latency_ms, r.cost_usd, r.error,
             m.metric_id, m.value_num, m.value_bool
      FROM runs r LEFT JOIN metric_values m ON m.run_id = r.id
    `;
    if (rows.length === 0) return syntheticRuns();
    const byRun = new Map<number, RunResult>();
    for (const row of rows) {
      let r = byRun.get(row.id);
      if (!r) {
        r = {
          agentId: row.agent_id,
          taskId: row.task_id,
          seed: row.seed,
          timestamp: row.finished_at,
          latencyMs: row.latency_ms,
          costUsd: Number(row.cost_usd),
          metrics: {},
          error: row.error ?? undefined,
        };
        byRun.set(row.id, r);
      }
      if (row.metric_id) {
        const v = row.value_bool ?? row.value_num;
        (r.metrics as Record<string, number | boolean | null>)[row.metric_id] = v;
      }
    }
    return [...byRun.values()];
  } catch (e) {
    console.warn("[results-db] falling back to synthetic:", (e as Error).message);
    return syntheticRuns();
  }
}

export async function overallForUseCaseAsync(_runs: RunResult[], useCase: UseCase) {
  // For now keep the use-case re-weighting in the synthetic helper — once
  // real runs cover all categories, port the same math from results.ts here.
  const { overallForUseCase } = await import("./results");
  return overallForUseCase(_runs, useCase);
}

export async function paretoFrontAsync(points: { id: string; capability: number; cost: number }[]) {
  const { paretoFront } = await import("./results");
  return paretoFront(points);
}

export async function classifyTierAsync(agentId: string, aggregates: AggregateScore[]) {
  const { classifyTier } = await import("./results");
  return classifyTier(agentId, aggregates);
}
