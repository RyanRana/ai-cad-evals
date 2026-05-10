"""Vercel Blob upload (REST). Returns the public URL."""
from __future__ import annotations
import hashlib
from pathlib import Path
import httpx

from .config import BLOB_READ_WRITE_TOKEN


def upload(path: Path, *, key: str, content_type: str = "application/octet-stream") -> str:
    """Uploads `path` to the configured Blob store at the given key."""
    if not BLOB_READ_WRITE_TOKEN:
        raise RuntimeError("BLOB_READ_WRITE_TOKEN not set")
    url = f"https://blob.vercel-storage.com/{key}"
    headers = {
        "Authorization": f"Bearer {BLOB_READ_WRITE_TOKEN}",
        "x-content-type": content_type,
        "x-add-random-suffix": "0",
    }
    data = path.read_bytes()
    r = httpx.put(url, headers=headers, content=data, timeout=60)
    r.raise_for_status()
    return r.json()["url"]


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    h.update(Path(path).read_bytes())
    return h.hexdigest()
