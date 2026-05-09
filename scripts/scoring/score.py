#!/usr/bin/env python3
"""
CAD-Bench v0.4 reference scorer.

Reads a candidate artifact (STEP/STL/GLB) and a task id, returns a JSON
dict matching RunResult.metrics. Used by scripts/run-evals.ts via subprocess.

Dependencies (install with `pip install -r scripts/scoring/requirements.txt`):
    pythonocc-core>=7.8     # OCC bindings for STEP / shape analysis
    trimesh>=4.4            # mesh I/O + voxelisation
    numpy
    scipy                   # ICP, KDTree
    rtree                   # used internally by trimesh

The scorer is intentionally split into pure functions so each metric can
be regression-tested in isolation.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import sys
from pathlib import Path

import numpy as np
import trimesh
from scipy.spatial import cKDTree

# --- helpers ---------------------------------------------------------------

REF_ROOT = Path("public/refs")
TASK_DB  = Path("lib/data/tasks.ts")  # parsed via a small TS-to-JSON dump


def load_reference(task_id: str) -> trimesh.Trimesh:
    """The ground-truth tessellation lives at public/refs/<task_id>.glb."""
    p = REF_ROOT / f"{task_id}.glb"
    if not p.exists():
        # fall back to STL
        p = REF_ROOT / f"{task_id}.stl"
    if not p.exists():
        raise FileNotFoundError(f"no reference for {task_id}")
    return trimesh.load(p, force="mesh")


def load_candidate(artifact: str) -> trimesh.Trimesh:
    ext = Path(artifact).suffix.lower()
    if ext in (".stl", ".glb", ".obj", ".ply"):
        return trimesh.load(artifact, force="mesh")
    if ext in (".step", ".stp"):
        # Convert via OpenCascade to a fine tessellation.
        from OCC.Core.STEPControl import STEPControl_Reader
        from OCC.Core.IFSelect import IFSelect_RetDone
        from OCC.Core.BRepMesh import BRepMesh_IncrementalMesh
        from OCC.Core.TopoDS import TopoDS_Shape
        from OCC.Extend.DataExchange import write_stl_file

        reader = STEPControl_Reader()
        if reader.ReadFile(artifact) != IFSelect_RetDone:
            raise RuntimeError("STEP read failed")
        reader.TransferRoots()
        shape: TopoDS_Shape = reader.OneShape()
        BRepMesh_IncrementalMesh(shape, 0.05, False, 0.5, True)
        tmp_stl = Path(artifact).with_suffix(".tmp.stl")
        write_stl_file(shape, str(tmp_stl), "binary")
        m = trimesh.load(tmp_stl)
        tmp_stl.unlink(missing_ok=True)
        return m
    raise ValueError(f"unsupported format {ext}")


def icp_align(a: np.ndarray, b: np.ndarray, max_iter: int = 30) -> np.ndarray:
    """Returns a 4×4 transform that aligns point cloud `a` onto `b`. Trimesh
    ships a battle-tested ICP — we just use it."""
    M, _, _ = trimesh.registration.icp(a, b, max_iterations=max_iter, scale=False)
    return M


# --- metrics ---------------------------------------------------------------

def vol_iou(cand: trimesh.Trimesh, ref: trimesh.Trimesh, voxel_mm: float = 1.0) -> float:
    pitch = voxel_mm
    a = cand.voxelized(pitch=pitch).fill().points
    b = ref.voxelized(pitch=pitch).fill().points
    if len(a) == 0 or len(b) == 0:
        return 0.0
    sa = set(map(tuple, np.round(a / pitch).astype(int)))
    sb = set(map(tuple, np.round(b / pitch).astype(int)))
    inter = len(sa & sb)
    union = len(sa | sb)
    return inter / max(1, union)


def chamfer(cand: trimesh.Trimesh, ref: trimesh.Trimesh, n: int = 50_000) -> float:
    pa = cand.sample(n)
    pb = ref.sample(n)
    ka = cKDTree(pa)
    kb = cKDTree(pb)
    da, _ = kb.query(pa)
    db, _ = ka.query(pb)
    return 0.5 * float(da.mean()) + 0.5 * float(db.mean())


def hausdorff_p95(cand: trimesh.Trimesh, ref: trimesh.Trimesh, n: int = 50_000) -> float:
    pa = cand.sample(n)
    pb = ref.sample(n)
    ka = cKDTree(pa)
    kb = cKDTree(pb)
    da, _ = kb.query(pa)
    db, _ = ka.query(pb)
    return float(max(np.percentile(da, 95), np.percentile(db, 95)))


def normal_consistency(cand: trimesh.Trimesh, ref: trimesh.Trimesh, n: int = 30_000) -> float:
    pa, ia = cand.sample(n, return_index=True)
    na = cand.face_normals[ia]
    kb = cKDTree(ref.vertices)
    _, idx = kb.query(pa)
    nb = ref.vertex_normals[idx]
    return float(np.mean(np.abs(np.einsum("ij,ij->i", na, nb))))


def watertight(m: trimesh.Trimesh) -> bool:
    return bool(m.is_watertight)


def manifoldness(m: trimesh.Trimesh) -> float:
    edges = m.edges_unique
    counts = np.bincount(m.faces_unique_edges.flatten(), minlength=len(edges))
    nm = np.sum(counts != 2)
    return 1.0 - nm / max(1, len(edges))


def euler_compliance(m: trimesh.Trimesh, expected: int | None) -> bool:
    if expected is None:
        return True
    V = len(m.vertices)
    F = len(m.faces)
    E = len(m.edges_unique)
    return (V - E + F) == expected


def step_roundtrip(artifact: str, ref: trimesh.Trimesh) -> float | None:
    """Export → re-import via OCC, return chamfer to the original tessellation."""
    if not artifact.lower().endswith((".step", ".stp")):
        return None
    try:
        round_trip = load_candidate(artifact)
        return chamfer(round_trip, ref)
    except Exception:
        return None


# --- entry point -----------------------------------------------------------

def score_one(artifact: str, task: dict) -> dict:
    cand = load_candidate(artifact)
    ref  = load_reference(task["id"])

    # rigid alignment
    M = icp_align(cand.vertices, ref.vertices)
    cand.apply_transform(M)

    metrics: dict = {}
    metrics["vol_iou"]            = round(vol_iou(cand, ref), 3)
    metrics["chamfer"]            = round(chamfer(cand, ref), 3)
    metrics["hausdorff"]          = round(hausdorff_p95(cand, ref), 3)
    metrics["normal_consistency"] = round(normal_consistency(cand, ref), 3)
    metrics["watertight"]         = watertight(cand)
    metrics["manifold"]           = round(manifoldness(cand), 3)
    metrics["euler_compliance"]   = euler_compliance(cand, task.get("euler"))
    metrics["step_roundtrip"]     = step_roundtrip(artifact, ref)

    # pass@1 gating (matches the metric definition published on /methodology)
    tau = 0.85 if task["category"] == "primitives" else 0.65 if task["category"] == "freeform_surfaces" else 0.75
    metrics["pass_at_1"] = int(metrics["vol_iou"] >= tau and metrics["watertight"])

    return metrics


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--artifact", required=True)
    ap.add_argument("--task", required=True)
    args = ap.parse_args()
    # tiny task DB (id → category) — full task list lives in lib/data/tasks.ts
    db = json.loads(Path("public/tasks-min.json").read_text())
    task = next(t for t in db if t["id"] == args.task)
    print(json.dumps(score_one(args.artifact, task)))


if __name__ == "__main__":
    main()
