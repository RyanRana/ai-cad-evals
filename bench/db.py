"""Postgres helpers."""
from __future__ import annotations
import json
from contextlib import contextmanager
from pathlib import Path
import psycopg

from .config import POSTGRES_URL


@contextmanager
def conn():
    if not POSTGRES_URL:
        raise RuntimeError("POSTGRES_URL not set")
    with psycopg.connect(POSTGRES_URL) as c:
        yield c


def init_schema():
    sql = (Path(__file__).parent / "sql" / "schema.sql").read_text()
    with conn() as c:
        c.execute(sql)
        c.commit()


def upsert_reference(task_id: str, *, blob_url: str, sha256: str,
                     volume_mm3: float | None, surface_mm2: float | None,
                     bbox_mm: list[float] | None, watertight: bool,
                     manifold: bool, euler: int, genus: int, builder_version: str):
    with conn() as c:
        c.execute(
            """
            INSERT INTO reference_parts
              (task_id, step_blob_url, step_sha256, volume_mm3, surface_mm2, bbox_mm,
               is_watertight, is_manifold, euler, genus, builder_version)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (task_id) DO UPDATE SET
              step_blob_url=EXCLUDED.step_blob_url, step_sha256=EXCLUDED.step_sha256,
              volume_mm3=EXCLUDED.volume_mm3, surface_mm2=EXCLUDED.surface_mm2,
              bbox_mm=EXCLUDED.bbox_mm, is_watertight=EXCLUDED.is_watertight,
              is_manifold=EXCLUDED.is_manifold, euler=EXCLUDED.euler,
              genus=EXCLUDED.genus, builder_version=EXCLUDED.builder_version,
              authored_at=NOW();
            """,
            (task_id, blob_url, sha256, volume_mm3, surface_mm2, bbox_mm,
             watertight, manifold, euler, genus, builder_version),
        )
        c.commit()


def insert_run(agent_id: str, task_id: str, seed: int, *,
               bench_version: str, started, finished, latency_ms: int,
               cost_usd: float, candidate_blob: str | None,
               raw_output: str | None, error: str | None) -> int:
    with conn() as c:
        cur = c.execute(
            """
            INSERT INTO runs
              (agent_id, task_id, seed, bench_version, started_at, finished_at,
               latency_ms, cost_usd, candidate_blob, raw_output, error)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (agent_id, task_id, seed, bench_version) DO UPDATE SET
              started_at=EXCLUDED.started_at, finished_at=EXCLUDED.finished_at,
              latency_ms=EXCLUDED.latency_ms, cost_usd=EXCLUDED.cost_usd,
              candidate_blob=EXCLUDED.candidate_blob, raw_output=EXCLUDED.raw_output,
              error=EXCLUDED.error
            RETURNING id;
            """,
            (agent_id, task_id, seed, bench_version, started, finished,
             latency_ms, cost_usd, candidate_blob, raw_output, error),
        )
        rid = cur.fetchone()[0]
        c.commit()
        return rid


def insert_metrics(run_id: int, metrics: dict[str, float | bool | None]):
    with conn() as c:
        c.execute("DELETE FROM metric_values WHERE run_id=%s", (run_id,))
        rows = []
        for mid, v in metrics.items():
            if v is None:
                rows.append((run_id, mid, None, None))
            elif isinstance(v, bool):
                rows.append((run_id, mid, None, v))
            else:
                rows.append((run_id, mid, float(v), None))
        c.executemany(
            "INSERT INTO metric_values (run_id, metric_id, value_num, value_bool) VALUES (%s,%s,%s,%s)",
            rows,
        )
        c.commit()


def fetch_aggregates() -> list[dict]:
    with conn() as c:
        cur = c.execute(
            "SELECT agent_id, category, n, mean_score, p5, ci_low, ci_high, irt_ability, metric_means FROM aggregates"
        )
        cols = [d.name for d in cur.description]
        return [dict(zip(cols, r)) for r in cur.fetchall()]
