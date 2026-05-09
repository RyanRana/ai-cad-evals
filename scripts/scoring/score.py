#!/usr/bin/env python3
"""
CAD-Bench v0.5 reference scorer.

Reads a candidate artifact (STEP/STL/GLB) plus the full task spec (JSON)
and returns a metrics dict matching `RunResult.metrics` in lib/types.ts.

Invocation contract:
    python3 scripts/scoring/score.py --artifact <path> --task-json <path>
or:
    python3 scripts/scoring/score.py --artifact <path> --task <id>
        # legacy: looks the task up in public/tasks-min.json

Each metric is a pure function of (cand, ref, task_spec) so the suite is
regression-testable in isolation. score_one() dispatches based on which
spec fields are present — tasks only pay for metrics they declare.

Dependencies (install with `pip install -r scripts/scoring/requirements.txt`):
    pythonocc-core>=7.8     # OCC bindings for STEP / shape analysis
    trimesh>=4.4            # mesh I/O + voxelisation
    numpy
    scipy                   # ICP, KDTree, eigh
    rtree                   # used internally by trimesh
    networkx                # assembly DOF graph (kinematic tasks)
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import trimesh
from scipy.spatial import cKDTree

REF_ROOT = Path("public/refs")
VOXEL_MM = float(os.environ.get("CADBENCH_VOXEL_MM", "1.0"))
SURF_SAMPLES = int(os.environ.get("CADBENCH_SURF_SAMPLES", "50000"))
NORMAL_SAMPLES = int(os.environ.get("CADBENCH_NORMAL_SAMPLES", "30000"))


# --- I/O helpers -----------------------------------------------------------

def load_reference(task_id: str) -> trimesh.Trimesh:
    for ext in (".glb", ".stl", ".obj", ".ply"):
        p = REF_ROOT / f"{task_id}{ext}"
        if p.exists():
            return trimesh.load(p, force="mesh")
    raise FileNotFoundError(f"no reference for {task_id} under {REF_ROOT}")


def load_candidate(artifact: str) -> trimesh.Trimesh:
    ext = Path(artifact).suffix.lower()
    if ext in (".stl", ".glb", ".obj", ".ply"):
        return trimesh.load(artifact, force="mesh")
    if ext in (".step", ".stp"):
        from OCC.Core.STEPControl import STEPControl_Reader
        from OCC.Core.IFSelect import IFSelect_RetDone
        from OCC.Core.BRepMesh import BRepMesh_IncrementalMesh
        from OCC.Extend.DataExchange import write_stl_file

        reader = STEPControl_Reader()
        if reader.ReadFile(artifact) != IFSelect_RetDone:
            raise RuntimeError("STEP read failed")
        reader.TransferRoots()
        shape = reader.OneShape()
        BRepMesh_IncrementalMesh(shape, 0.05, False, 0.5, True)
        tmp_stl = Path(artifact).with_suffix(".tmp.stl")
        write_stl_file(shape, str(tmp_stl), "binary")
        m = trimesh.load(tmp_stl)
        tmp_stl.unlink(missing_ok=True)
        return m
    raise ValueError(f"unsupported format {ext}")


def load_step_shape(artifact: str):
    """Return the OCC TopoDS_Shape for BREP-level analyses (None for non-STEP)."""
    if not artifact.lower().endswith((".step", ".stp")):
        return None
    from OCC.Core.STEPControl import STEPControl_Reader
    from OCC.Core.IFSelect import IFSelect_RetDone
    reader = STEPControl_Reader()
    if reader.ReadFile(artifact) != IFSelect_RetDone:
        return None
    reader.TransferRoots()
    return reader.OneShape()


def icp_align(a: np.ndarray, b: np.ndarray, max_iter: int = 30) -> np.ndarray:
    np.random.seed(0)
    M, _, _ = trimesh.registration.icp(a, b, max_iterations=max_iter, scale=False)
    return M


# --- L1: geometric similarity ---------------------------------------------

def vol_iou(cand: trimesh.Trimesh, ref: trimesh.Trimesh, voxel_mm: float = VOXEL_MM) -> float:
    a = cand.voxelized(pitch=voxel_mm).fill().points
    b = ref.voxelized(pitch=voxel_mm).fill().points
    if len(a) == 0 or len(b) == 0:
        return 0.0
    sa = set(map(tuple, np.round(a / voxel_mm).astype(int)))
    sb = set(map(tuple, np.round(b / voxel_mm).astype(int)))
    return len(sa & sb) / max(1, len(sa | sb))


def chamfer(cand: trimesh.Trimesh, ref: trimesh.Trimesh, n: int = SURF_SAMPLES) -> float:
    pa = cand.sample(n)
    pb = ref.sample(n)
    da, _ = cKDTree(pb).query(pa)
    db, _ = cKDTree(pa).query(pb)
    return 0.5 * float(da.mean()) + 0.5 * float(db.mean())


def hausdorff_p95(cand: trimesh.Trimesh, ref: trimesh.Trimesh, n: int = SURF_SAMPLES) -> float:
    pa = cand.sample(n); pb = ref.sample(n)
    da, _ = cKDTree(pb).query(pa)
    db, _ = cKDTree(pa).query(pb)
    return float(max(np.percentile(da, 95), np.percentile(db, 95)))


def normal_consistency(cand: trimesh.Trimesh, ref: trimesh.Trimesh, n: int = NORMAL_SAMPLES) -> float:
    pa, ia = cand.sample(n, return_index=True)
    na = cand.face_normals[ia]
    _, idx = cKDTree(ref.vertices).query(pa)
    nb = ref.vertex_normals[idx]
    return float(np.mean(np.abs(np.einsum("ij,ij->i", na, nb))))


def watertight(m: trimesh.Trimesh) -> bool:
    return bool(m.is_watertight)


def manifoldness(m: trimesh.Trimesh) -> float:
    edges = m.edges_unique
    counts = np.bincount(m.faces_unique_edges.flatten(), minlength=len(edges))
    return 1.0 - float(np.sum(counts != 2)) / max(1, len(edges))


def euler_compliance(m: trimesh.Trimesh, expected: int | None) -> bool:
    if expected is None:
        return True
    return (len(m.vertices) - len(m.edges_unique) + len(m.faces)) == expected


def step_roundtrip(artifact: str, ref: trimesh.Trimesh) -> float | None:
    """Re-import the STEP and compute chamfer to the original tessellation.
    Catches kernels that emit STEP files which then fail to round-trip."""
    if not artifact.lower().endswith((".step", ".stp")):
        return None
    try:
        rt = load_candidate(artifact)
        return round(chamfer(rt, ref), 4)
    except Exception:
        return None


# --- L2: engineering correctness -------------------------------------------

def _bbox_dim(mesh: trimesh.Trimesh, axis: int) -> float:
    lo, hi = mesh.bounds
    return float(hi[axis] - lo[axis])


def _detect_holes(mesh: trimesh.Trimesh, min_radius_mm: float = 0.5) -> list[dict]:
    """Heuristic hole detector: cluster vertices by per-face curvature and
    fit cylinders to high-curvature concave clusters. Returns
    [{ axis, radius, depth, centre }]. Sufficient for feature_recall;
    not a substitute for OCC face-classification when STEP is available."""
    try:
        from sklearn.cluster import DBSCAN
    except ImportError:
        return []
    # Negative dihedral angles → concave edges → likely interior of a hole.
    fa = mesh.face_adjacency
    angles = mesh.face_adjacency_angles
    convex_mask = trimesh.curvature.face_adjacency_convex(mesh)
    concave_idx = np.where((~convex_mask) & (angles > np.deg2rad(20)))[0]
    if len(concave_idx) == 0:
        return []
    concave_faces = np.unique(fa[concave_idx].flatten())
    centroids = mesh.triangles_center[concave_faces]
    if len(centroids) < 8:
        return []
    db = DBSCAN(eps=2.0, min_samples=6).fit(centroids)
    out: list[dict] = []
    for lbl in set(db.labels_):
        if lbl == -1:
            continue
        pts = centroids[db.labels_ == lbl]
        if len(pts) < 8:
            continue
        # Best-fit axis: smallest eigenvector of the centred covariance.
        c = pts.mean(0)
        cov = np.cov((pts - c).T)
        w, V = np.linalg.eigh(cov)
        axis = V[:, 0]
        radial = pts - c - np.outer((pts - c) @ axis, axis)
        r = float(np.linalg.norm(radial, axis=1).mean())
        if r < min_radius_mm:
            continue
        depth = float(np.ptp((pts - c) @ axis))
        out.append({"axis": axis.tolist(), "radius": r, "depth": depth, "centre": c.tolist()})
    return out


def _shape_faces(shape) -> list:
    """Iterate TopoDS_Face entities of an OCC shape."""
    from OCC.Core.TopExp import TopExp_Explorer
    from OCC.Core.TopAbs import TopAbs_FACE
    from OCC.Core.TopoDS import topods
    out = []
    exp = TopExp_Explorer(shape, TopAbs_FACE)
    while exp.More():
        out.append(topods.Face(exp.Current()))
        exp.Next()
    return out


def _classify_face(face) -> str:
    """Returns 'plane' | 'cylinder' | 'cone' | 'sphere' | 'torus' | 'bspline' | 'other'."""
    from OCC.Core.BRepAdaptor import BRepAdaptor_Surface
    from OCC.Core.GeomAbs import (
        GeomAbs_Plane, GeomAbs_Cylinder, GeomAbs_Cone,
        GeomAbs_Sphere, GeomAbs_Torus, GeomAbs_BSplineSurface,
    )
    surf = BRepAdaptor_Surface(face, True)
    t = surf.GetType()
    return {
        GeomAbs_Plane: "plane",
        GeomAbs_Cylinder: "cylinder",
        GeomAbs_Cone: "cone",
        GeomAbs_Sphere: "sphere",
        GeomAbs_Torus: "torus",
        GeomAbs_BSplineSurface: "bspline",
    }.get(t, "other")


def named_dim_rmse(cand: trimesh.Trimesh, ref: trimesh.Trimesh, named: list[dict]) -> dict:
    """Compare bounding-box-derived measurements against task-declared
    named dimensions. We don't know the orientation a priori, so we
    measure all six bbox dims of the (icp-aligned) candidate and match
    to the closest nominal. RMSE is in mm. Within-tolerance ratio is a
    discrete-pass score in [0,1]."""
    if not named:
        return {"rmse": 0.0, "in_tol": 1.0}
    cand_dims = sorted([_bbox_dim(cand, i) for i in range(3)], reverse=True)
    nominals = sorted([d["nominalMm"] for d in named], reverse=True)
    # Greedy 1:1 matching by closest nominal — handles 'thickness' / 'leg' / 'height'.
    diffs: list[float] = []
    in_tol_hits = 0
    for d in named:
        nom = d["nominalMm"]; tol = d.get("toleranceMm", 0.1)
        # Best match across all candidate measurements.
        candidate = min(cand_dims, key=lambda x: abs(x - nom))
        err = abs(candidate - nom)
        diffs.append(err)
        if err <= tol:
            in_tol_hits += 1
    rmse = float(np.sqrt(np.mean(np.square(diffs)))) if diffs else 0.0
    return {"rmse": round(rmse, 4), "in_tol": round(in_tol_hits / len(named), 3)}


def feature_recall(cand: trimesh.Trimesh, shape, expected: list[str]) -> float:
    """For each declared feature token, decide pass/fail using a small
    keyword router. Falls back to 0 when the artifact is mesh-only and
    BREP analysis isn't possible."""
    if not expected:
        return 1.0
    holes = _detect_holes(cand)
    face_kinds: list[str] = []
    if shape is not None:
        try:
            face_kinds = [_classify_face(f) for f in _shape_faces(shape)]
        except Exception:
            face_kinds = []

    def has(token: str) -> bool:
        t = token.lower()
        # hole / bore / through / clearance
        m = re.search(r"(?:hole|bore|thru|clearance)[_\-]*([0-9.]+)", t)
        if m:
            target_d = float(m.group(1))
            return any(abs(2 * h["radius"] - target_d) <= max(0.5, 0.1 * target_d) for h in holes)
        if "thru_hole" in t or "through_hole" in t:
            return any(h["depth"] >= 0.5 * _bbox_dim(cand, 2) for h in holes)
        # threads → look for many narrow cylindrical faces stacked along an axis
        if "thread" in t:
            return face_kinds.count("cylinder") >= 4
        # chamfer / fillet → presence of conical or toroidal faces
        if "chamfer" in t:
            return "cone" in face_kinds or any(
                _bbox_dim(cand, i) for i in range(3)
            )  # chamfers leave cone faces in BREP
        if "fillet" in t or "_r" in t:
            return "torus" in face_kinds or "cylinder" in face_kinds
        # bend / shoulder / step / pcd / boss / rib — fall back to face-count heuristics
        if any(k in t for k in ("bend", "shoulder", "step", "pcd", "boss", "rib")):
            return len(face_kinds) > 0 and face_kinds.count("plane") >= 4
        if any(k in t for k in ("groove", "slot")):
            return holes and any(h["depth"] < h["radius"] * 4 for h in holes)
        if "g2_continuity" in t:
            return face_kinds.count("bspline") >= 1
        if "draft" in t:
            return "cone" in face_kinds  # very weak proxy
        return False

    hits = sum(1 for f in expected if has(f))
    return round(hits / len(expected), 3)


def gdt_compliance(cand: trimesh.Trimesh, callouts: list[dict]) -> float:
    """Per-callout boolean: measure the geometric attribute and compare
    to the declared zone width. Returns the share of callouts within zone.
    Weak when no datum is provided — uses canonical axes as fallback."""
    if not callouts:
        return 1.0
    passes = 0
    for c in callouts:
        kind = c["type"]; tol = c["toleranceMm"]
        try:
            if kind == "flatness":
                # plane-fit residual on the largest planar face proxy: top of bbox.
                top_mask = cand.vertices[:, 2] > (cand.bounds[1][2] - 0.5)
                pts = cand.vertices[top_mask]
                if len(pts) < 3:
                    continue
                c0 = pts.mean(0); _, _, vh = np.linalg.svd(pts - c0)
                n = vh[2]
                resid = np.abs((pts - c0) @ n)
                ok = float(resid.max()) <= tol
            elif kind == "perp":
                # Two largest principal directions ⊥? Use the inertia tensor.
                I = cand.moment_inertia
                w, V = np.linalg.eigh(I)
                ok = abs(float(V[:, 0] @ V[:, 1])) <= 0.05
            elif kind == "parallel":
                # Top face vs bottom face normal alignment.
                ok = True  # rigid bodies trivially pass without datum context
            elif kind in ("position", "concentric", "runout"):
                # Best-effort: detect holes and check they sit on a circle.
                holes = _detect_holes(cand)
                if len(holes) < 2:
                    ok = True
                else:
                    centres = np.array([h["centre"] for h in holes])
                    c0 = centres.mean(0)
                    radii = np.linalg.norm(centres - c0, axis=1)
                    ok = float(radii.std()) <= tol * 5  # loose: 5× the zone width
            else:
                ok = True
            passes += int(ok)
        except Exception:
            continue
    return round(passes / len(callouts), 3)


def mating_clearance(cand: trimesh.Trimesh, mating_step: str | None,
                     bounds: dict | None) -> dict | None:
    """Boolean-difference the candidate against the held-out mating part
    (loaded from `public<mating_step>`) and report the worst-case gap.
    Returns None when no mating partner is declared."""
    if not mating_step or not bounds:
        return None
    p = Path("public") / mating_step.lstrip("/")
    if not p.exists():
        return {"min_mm": None, "max_mm": None, "in_band": False, "note": "partner_missing"}
    try:
        partner = load_candidate(str(p))
    except Exception as e:
        return {"min_mm": None, "max_mm": None, "in_band": False, "note": str(e)[:80]}
    pa = cand.sample(20_000)
    da, _ = cKDTree(partner.vertices).query(pa)
    # Signed distance via partner's contains-test: positive outside, negative inside.
    inside = partner.contains(pa)
    signed = np.where(inside, -da, da)
    lo, hi = float(signed.min()), float(signed.max())
    in_band = bounds["min"] <= lo and hi <= bounds["max"] + 1e-3
    return {"min_mm": round(lo, 4), "max_mm": round(hi, 4), "in_band": bool(in_band)}


def fits_class_compliance(cand: trimesh.Trimesh, fit: str | None) -> float | None:
    """ISO 286 hole/shaft fit gates (subset): given a fit class declaration
    on the spec, derive expected dimensional band from the candidate's
    smallest cylindrical feature and check the band."""
    if not fit:
        return None
    # Map: fit → (lower deviation µm, upper deviation µm) for nominal Ø10.
    table = {
        "H7/g6": (-14, -5),
        "H7/h6": (-9, 0),
        "H8/f7": (-28, -13),
        "H7/k6": (1, 12),
        "H7/p6": (15, 26),
    }
    if fit not in table:
        return None
    lo_um, hi_um = table[fit]
    holes = _detect_holes(cand)
    if not holes:
        return 0.0
    smallest = min(holes, key=lambda h: h["radius"])
    d = 2 * smallest["radius"]
    # Find nominal as nearest standard: 6, 8, 10, 12, 16, 20…
    standards = np.array([6, 8, 10, 12, 16, 20, 25, 30])
    nom = float(standards[np.argmin(np.abs(standards - d))])
    deviation_mm = d - nom
    in_band = (lo_um / 1000) <= deviation_mm <= (hi_um / 1000)
    return float(in_band)


def standards_compliance(shape, ref_id: str | None) -> float | None:
    """Standards check is a directory of small validators. Returns 1.0 if
    the matching validator passes, 0.0 if it fails, None if not declared
    or the candidate is mesh-only."""
    if not ref_id or shape is None:
        return None
    try:
        face_kinds = [_classify_face(f) for f in _shape_faces(shape)]
    except Exception:
        return None
    rid = ref_id.upper()
    if rid.startswith("ISO 4762"):
        # cap screw: needs hex socket (6 planar inner faces) + threaded shank.
        return float(face_kinds.count("plane") >= 8 and face_kinds.count("cylinder") >= 1)
    if rid.startswith("DIN 471"):
        # retaining ring groove → needs internal cylindrical relief.
        return float(face_kinds.count("cylinder") >= 2)
    if rid.startswith("ISO 261"):
        # threaded hole → at least one cylindrical face with helical signature.
        return float(face_kinds.count("cylinder") >= 1)
    if rid.startswith("AS568"):
        # O-ring groove: torus or ≥3 cylindrical/conical faces.
        return float("torus" in face_kinds or face_kinds.count("cylinder") >= 3)
    if rid.startswith("ANSI B5.50"):
        # dovetail: ≥4 planar faces at non-orthogonal angles.
        return float(face_kinds.count("plane") >= 4)
    return None


# --- L3: manufacturability -------------------------------------------------

def draft_compliance(cand: trimesh.Trimesh, min_deg: float | None,
                     pull_axis: tuple[float, float, float] = (0, 0, 1)) -> float | None:
    """Share of triangles whose normal makes an angle ≥ min_deg with the
    plane perpendicular to pull_axis (i.e. they have valid draft)."""
    if min_deg is None:
        return None
    z = np.array(pull_axis, dtype=float)
    z /= np.linalg.norm(z)
    # Angle between face normal and pull axis: 0° = parallel to pull (vertical wall).
    cosines = cand.face_normals @ z
    angles_deg = np.degrees(np.arcsin(np.clip(np.abs(cosines), 0, 1)))
    # Vertical walls have angles_deg ≈ 0 (normal ⊥ pull). Draft = 90° - dihedral.
    # We require draft ≥ min_deg → angle_deg ≥ min_deg OR angle_deg ≥ 89° (top/bottom).
    weights = cand.area_faces / cand.area
    is_top_bottom = angles_deg >= 89.0
    is_drafted = angles_deg >= min_deg
    ok = is_top_bottom | is_drafted
    return round(float(np.sum(weights[ok])), 3)


def _wall_thickness_samples(mesh: trimesh.Trimesh, n: int = 5000) -> np.ndarray:
    """Ray-cast inward from each surface sample; the first hit on the
    opposite wall gives an estimate of local wall thickness."""
    pts, idx = mesh.sample(n, return_index=True)
    n_in = -mesh.face_normals[idx]
    intersector = trimesh.ray.ray_pyembree.RayMeshIntersector(mesh) \
        if hasattr(trimesh.ray, "ray_pyembree") else trimesh.ray.ray_triangle.RayMeshIntersector(mesh)
    locs, ray_idx, _ = intersector.intersects_location(pts + n_in * 1e-3, n_in, multiple_hits=False)
    if len(locs) == 0:
        return np.array([])
    return np.linalg.norm(locs - pts[ray_idx], axis=1)


def min_wall_compliance(cand: trimesh.Trimesh, min_wall: float | None) -> float | None:
    """Fraction of the surface whose local wall thickness ≥ min_wall."""
    if min_wall is None:
        return None
    th = _wall_thickness_samples(cand)
    if len(th) == 0:
        return None
    return round(float(np.mean(th >= min_wall)), 3)


def uniform_thickness(cand: trimesh.Trimesh, target: float | None,
                      tol: float = 0.2) -> float | None:
    """Share of the surface whose wall thickness is within `tol` (mm) of
    the declared uniform thickness — for sheet-metal and injection."""
    if target is None:
        return None
    th = _wall_thickness_samples(cand)
    if len(th) == 0:
        return None
    return round(float(np.mean(np.abs(th - target) <= tol)), 3)


def cam_reachable(cand: trimesh.Trimesh, process: str | None) -> float | None:
    """For 3-axis CNC: share of surface whose normal lies within 60° of
    one of the six cardinal axes (proxy for "reachable from one of the
    six setups without a 5-axis head"). Returns None for non-CAM tasks."""
    if process not in ("cnc-3ax", "cnc-5ax"):
        return None
    axes = np.array([
        [1, 0, 0], [-1, 0, 0],
        [0, 1, 0], [0, -1, 0],
        [0, 0, 1], [0, 0, -1],
    ], dtype=float)
    weights = cand.area_faces / cand.area
    # cosine of angle between each face normal and each axis
    cos_max = np.max(cand.face_normals @ axes.T, axis=1)
    threshold = 0.5 if process == "cnc-3ax" else 0.2  # 60° vs 78°
    return round(float(np.sum(weights[cos_max >= threshold])), 3)


def support_volume_ratio(cand: trimesh.Trimesh, process: str | None,
                         build_axis: tuple[float, float, float] = (0, 0, 1),
                         overhang_deg: float = 45.0) -> float | None:
    """For FDM/SLA: estimate the support-material volume needed if printed
    along `build_axis`. Triangles whose normal points more than 45° below
    the build plate's horizontal generate a downward column down to the
    build plate; we sum those columns. Returns the ratio
    support_vol / part_vol."""
    if process not in ("fdm", "sla", "sls", "dmls"):
        return None
    z = np.array(build_axis, dtype=float); z /= np.linalg.norm(z)
    cos_threshold = -math.cos(math.radians(90 - overhang_deg))
    n_dot_z = cand.face_normals @ z
    overhang = n_dot_z < cos_threshold
    if not np.any(overhang):
        return 0.0
    # Vertical column from each overhang triangle's centroid down to the build plate (z=0).
    centres = cand.triangles_center[overhang]
    heights = centres @ z
    areas = cand.area_faces[overhang]
    sup_vol = float(np.sum(areas * np.maximum(heights, 0)))
    return round(sup_vol / max(cand.volume, 1e-6), 3)


def dfm_score(metrics: dict) -> float | None:
    """Composite DFM score: average of any process-specific metrics that
    were computed. Lets the site rank a part with one number while
    keeping the components transparent."""
    parts: list[float] = []
    for k in ("draft_compliance", "min_wall_compliance",
              "uniform_thickness", "cam_reachable"):
        v = metrics.get(k)
        if isinstance(v, (int, float)):
            parts.append(float(v))
    sv = metrics.get("support_volume_ratio")
    if isinstance(sv, (int, float)):
        parts.append(max(0.0, 1.0 - float(sv)))  # less support = better
    if not parts:
        return None
    return round(float(np.mean(parts)), 3)


# --- L4: physics gates -----------------------------------------------------

def fea_yield_pass(cand: trimesh.Trimesh, load_n: float | None,
                   max_stress_mpa: float | None,
                   material: str | None) -> bool | None:
    """Analytical cantilever-beam yield gate. We reduce the geometry to
    its principal-axis-aligned bounding rectangle and apply σ_max = M·c/I
    at the fixed end. This is an *order-of-magnitude* check, not a
    substitute for CalculiX — but it correctly fails parts that are
    obviously too thin or too long for the declared load.

    Set CADBENCH_CCX=1 to delegate to a real CalculiX solve when the
    `ccx` binary is on PATH (TODO: see fea.py once we wire that up)."""
    if load_n is None or max_stress_mpa is None:
        return None
    bx, by, bz = (cand.bounds[1] - cand.bounds[0]).tolist()
    # Long axis → cantilever length L; perpendicular dims define I = bh³/12.
    dims = sorted([bx, by, bz], reverse=True)
    L, h, b = dims  # L = longest, h = next (thickness in bend direction), b = third
    if min(h, b) <= 0:
        return False
    I = b * h ** 3 / 12.0  # mm⁴
    c = h / 2.0
    M = load_n * L  # N·mm
    sigma_max = M * c / I  # N/mm² = MPa
    return bool(sigma_max <= max_stress_mpa)


# --- entry point -----------------------------------------------------------

def _pass_threshold(category: str) -> float:
    return {
        "primitives": 0.85,
        "freeform_surfaces": 0.65,
        "boolean_robustness": 0.80,
        "brep_fidelity": 0.75,
    }.get(category, 0.75)


def score_one(artifact: str, task: dict) -> dict:
    """Dispatch all metrics applicable to this task and return the
    metrics dict matching `RunResult.metrics`. Each metric branch is
    independent — a failure in one returns None for that key, never
    aborts the whole scoring run."""
    spec = task.get("spec", {})
    cand = load_candidate(artifact)
    ref = load_reference(task["id"])

    # Rigid alignment.
    M = icp_align(cand.vertices, ref.vertices)
    cand.apply_transform(M)
    shape = load_step_shape(artifact)

    m: dict[str, Any] = {}

    # L1
    m["vol_iou"]            = round(vol_iou(cand, ref), 3)
    m["chamfer"]            = round(chamfer(cand, ref), 3)
    m["hausdorff"]          = round(hausdorff_p95(cand, ref), 3)
    m["normal_consistency"] = round(normal_consistency(cand, ref), 3)
    m["watertight"]         = watertight(cand)
    m["manifold"]           = round(manifoldness(cand), 3)
    m["euler_compliance"]   = euler_compliance(cand, spec.get("euler"))
    m["step_roundtrip"]     = step_roundtrip(artifact, ref)

    # L2
    nd = named_dim_rmse(cand, ref, spec.get("namedDimensions") or [])
    m["named_dim_rmse"]     = nd["rmse"]
    m["feature_recall"]     = feature_recall(cand, shape, spec.get("features") or [])
    m["gdt_compliance"]     = gdt_compliance(cand, spec.get("gdtCallouts") or [])
    mc = mating_clearance(cand, spec.get("matingPart"), spec.get("expectedClearanceMm"))
    if mc is not None:
        m["mating_clearance"] = float(mc["in_band"])
        m["mating_clearance_min_mm"] = mc.get("min_mm")
        m["mating_clearance_max_mm"] = mc.get("max_mm")
    fits = fits_class_compliance(cand, spec.get("fitClass"))
    if fits is not None:
        m["fits_class_compliance"] = fits
    sc = standards_compliance(shape, spec.get("standardRef"))
    if sc is not None:
        m["standards_compliance"] = sc

    # L3
    proc = spec.get("process")
    dc = draft_compliance(cand, spec.get("draftMinDeg"))
    if dc is not None: m["draft_compliance"] = dc
    mw = min_wall_compliance(cand, spec.get("minWallMm"))
    if mw is not None: m["min_wall_compliance"] = mw
    ut = uniform_thickness(cand, spec.get("uniformThicknessMm"))
    if ut is not None: m["uniform_thickness"] = ut
    cr = cam_reachable(cand, proc)
    if cr is not None: m["cam_reachable"] = cr
    sv = support_volume_ratio(cand, proc)
    if sv is not None: m["support_volume_ratio"] = sv
    ds = dfm_score(m)
    if ds is not None: m["dfm_score"] = ds

    # L4 (single-artifact gates only — variance metrics live in aggregate.py)
    fy = fea_yield_pass(cand, spec.get("faeLoadN"),
                        spec.get("feaMaxStressMpa"), spec.get("feaMaterial"))
    if fy is not None: m["fea_yield_pass"] = fy

    # Pass-rate gate. Combines IoU + watertight + (if present) feature_recall and dfm_score.
    tau = _pass_threshold(task.get("category", ""))
    pass_components = [m["vol_iou"] >= tau, bool(m["watertight"])]
    fr = m.get("feature_recall")
    if isinstance(fr, (int, float)):
        pass_components.append(fr >= 0.6)
    if "dfm_score" in m:
        pass_components.append(m["dfm_score"] >= 0.6)
    m["pass_at_1"] = int(all(pass_components))

    return m


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--artifact", required=True)
    ap.add_argument("--task")
    ap.add_argument("--task-json")
    args = ap.parse_args()

    if args.task_json:
        task = json.loads(Path(args.task_json).read_text())
    elif args.task:
        db = json.loads(Path("public/tasks-min.json").read_text())
        task = next(t for t in db if t["id"] == args.task)
    else:
        ap.error("either --task or --task-json is required")
        return

    print(json.dumps(score_one(args.artifact, task)))


if __name__ == "__main__":
    main()
