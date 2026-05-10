-- CAD-Bench v0.7 results schema. Designed for Postgres (Neon/Vercel).
-- All foreign keys use TEXT ids that match the TS data files in lib/data/.

CREATE TABLE IF NOT EXISTS reference_parts (
    task_id           TEXT PRIMARY KEY,
    step_blob_url     TEXT NOT NULL,
    step_sha256       TEXT NOT NULL,
    volume_mm3        DOUBLE PRECISION,
    surface_mm2       DOUBLE PRECISION,
    bbox_mm           DOUBLE PRECISION[],     -- {x,y,z}
    is_watertight     BOOLEAN,
    is_manifold       BOOLEAN,
    euler             INTEGER,
    genus             INTEGER,
    authored_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    builder_version   TEXT NOT NULL          -- git sha of bench/reference/
);

CREATE TABLE IF NOT EXISTS runs (
    id                BIGSERIAL PRIMARY KEY,
    agent_id          TEXT NOT NULL,
    task_id           TEXT NOT NULL,
    seed              INTEGER NOT NULL,
    bench_version     TEXT NOT NULL,
    started_at        TIMESTAMPTZ NOT NULL,
    finished_at       TIMESTAMPTZ NOT NULL,
    latency_ms        INTEGER NOT NULL,
    cost_usd          DOUBLE PRECISION NOT NULL DEFAULT 0,
    candidate_blob    TEXT,                  -- null on hard failure
    raw_output        TEXT,                  -- LLM response, optional
    error             TEXT,
    UNIQUE (agent_id, task_id, seed, bench_version)
);

CREATE INDEX IF NOT EXISTS runs_agent_task ON runs (agent_id, task_id);
CREATE INDEX IF NOT EXISTS runs_task ON runs (task_id);

CREATE TABLE IF NOT EXISTS metric_values (
    run_id            BIGINT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    metric_id         TEXT NOT NULL,         -- vol_iou, chamfer, ...
    value_num         DOUBLE PRECISION,
    value_bool        BOOLEAN,
    PRIMARY KEY (run_id, metric_id)
);

-- Materialised aggregates (rebuilt by `bench/aggregate.py`).
CREATE TABLE IF NOT EXISTS aggregates (
    agent_id          TEXT NOT NULL,
    category          TEXT NOT NULL,         -- 'overall' | 'L1_geometry' | category id
    n                 INTEGER NOT NULL,
    mean_score        DOUBLE PRECISION NOT NULL,
    p5                DOUBLE PRECISION NOT NULL,
    ci_low            DOUBLE PRECISION NOT NULL,
    ci_high           DOUBLE PRECISION NOT NULL,
    irt_ability       DOUBLE PRECISION NOT NULL DEFAULT 0,
    metric_means      JSONB NOT NULL,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (agent_id, category)
);
