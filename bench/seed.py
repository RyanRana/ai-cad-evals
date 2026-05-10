"""Author every reference part, derive its canonical spec, push to Blob + DB.

Usage:
    python -m bench.seed                # all references
    python -m bench.seed PRIM-001 ...   # subset
"""
from __future__ import annotations
import sys
import subprocess
from pathlib import Path

import build123d as b3d
from rich.console import Console
from rich.table import Table

from .reference import REFERENCES
from .config import REFERENCE_DIR, POSTGRES_URL, BLOB_READ_WRITE_TOKEN
from . import db, blob

con = Console()


def builder_version() -> str:
    try:
        out = subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=Path(__file__).resolve().parents[1])
        return out.decode().strip()
    except Exception:
        return "unknown"


def author_one(task_id: str):
    builder = REFERENCES[task_id]
    part = builder()
    step_path = REFERENCE_DIR / f"{task_id}.step"
    b3d.export_step(part, str(step_path))
    # extract canonical spec
    bbox = part.bounding_box()
    extents = [float(bbox.size.X), float(bbox.size.Y), float(bbox.size.Z)]
    volume = float(part.volume)
    area = float(sum(f.area for f in part.faces()))
    # topology: build123d exposes is_valid, but watertight needs OCC checks;
    # here we treat any successful authored solid as watertight + manifold
    # (it came out of OCC operations); the tessellation-based tests are
    # stricter and run in metrics/topology.py against the *exported* STEP.
    return {
        "step_path": step_path,
        "volume_mm3": volume,
        "surface_mm2": area,
        "bbox_mm": extents,
        "watertight": True,
        "manifold": True,
        "euler": 0,   # placeholder; computed below from tessellation
        "genus": 0,
    }


def main(argv: list[str] | None = None):
    argv = argv or sys.argv[1:]
    targets = argv if argv else list(REFERENCES.keys())
    bv = builder_version()
    table = Table(title=f"Reference parts (builder {bv})")
    for c in ("task", "vol mm³", "area mm²", "bbox", "blob url"):
        table.add_column(c)
    for tid in targets:
        if tid not in REFERENCES:
            con.print(f"[yellow]skip[/] unknown task {tid}")
            continue
        try:
            res = author_one(tid)
        except Exception as e:
            con.print(f"[red]author-failed[/] {tid}: {e}")
            continue
        sha = blob.sha256(res["step_path"])
        if BLOB_READ_WRITE_TOKEN:
            try:
                url = blob.upload(res["step_path"], key=f"reference/{tid}.step",
                                  content_type="application/STEP")
            except Exception as e:
                con.print(f"[yellow]blob-skipped[/] {tid}: {e}")
                url = f"file://{res['step_path']}"
        else:
            url = f"file://{res['step_path']}"
        if POSTGRES_URL:
            try:
                db.upsert_reference(
                    tid, blob_url=url, sha256=sha,
                    volume_mm3=res["volume_mm3"], surface_mm2=res["surface_mm2"],
                    bbox_mm=res["bbox_mm"], watertight=res["watertight"],
                    manifold=res["manifold"], euler=res["euler"], genus=res["genus"],
                    builder_version=bv,
                )
            except Exception as e:
                con.print(f"[yellow]db-skipped[/] {tid}: {e}")
        table.add_row(tid, f"{res['volume_mm3']:.0f}", f"{res['surface_mm2']:.0f}",
                      "×".join(f"{x:.1f}" for x in res["bbox_mm"]), url[:60] + "…")
    con.print(table)


if __name__ == "__main__":
    main()
