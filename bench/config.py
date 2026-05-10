"""Bench-wide config. All paths/keys flow through here."""
from __future__ import annotations
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env.local")
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

ROOT = Path(__file__).resolve().parents[1]
BENCH_DIR = ROOT / "bench"
ARTIFACTS_DIR = BENCH_DIR / "_artifacts"
REFERENCE_DIR = ARTIFACTS_DIR / "reference"
CANDIDATES_DIR = ARTIFACTS_DIR / "candidates"

for d in (ARTIFACTS_DIR, REFERENCE_DIR, CANDIDATES_DIR):
    d.mkdir(parents=True, exist_ok=True)

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
GOOGLE_GENERATIVE_AI_API_KEY = os.environ.get("GOOGLE_GENERATIVE_AI_API_KEY")
ZOO_API_KEY = os.environ.get("ZOO_API_KEY")
AI_GATEWAY_API_KEY = os.environ.get("AI_GATEWAY_API_KEY")

POSTGRES_URL = os.environ.get("POSTGRES_URL") or os.environ.get("DATABASE_URL")
BLOB_READ_WRITE_TOKEN = os.environ.get("BLOB_READ_WRITE_TOKEN")
BLOB_STORE_BASE = os.environ.get("BLOB_STORE_BASE")  # e.g. https://<store>.public.blob.vercel-storage.com

DEFAULT_SEEDS = int(os.environ.get("BENCH_SEEDS", "1"))
DEFAULT_TIMEOUT_S = int(os.environ.get("BENCH_TIMEOUT_S", "180"))
