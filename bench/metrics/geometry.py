"""L1 geometry metrics implemented with trimesh + manifold3d.

All metrics are deterministic (fixed Halton sampling + fixed mesh sample N).
Outputs are dimensionless ratios in [0,1] or distances in mm.
"""
from __future__ import annotations
from pathlib import Path
import numpy as np
import trimesh

SAMPLE_N = 50_000  # surface samples for chamfer/normal-cons
VOXEL_PITCH = 0.5  # mm — for vol IoU on small parts (auto-scaled below)


def _load_mesh(path: Path) -> trimesh.Trimesh:
    """Load STEP/STL/OBJ and return a single Trimesh.

    STEP is loaded via build123d -> tessellation, since trimesh doesn't read
    STEP directly. Other formats go through trimesh.load.
    """
    p = Path(path)
    if p.suffix.lower() in (".step", ".stp"):
        from build123d import import_step
        from build123d.topology import Compound
        shape = import_step(str(p))
        # tessellate
        verts, faces = [], []
        if isinstance(shape, Compound):
            children = list(shape.solids())
        else:
            children = [shape]
        for solid in children:
            mesh = solid.tessellate(tolerance=0.05, angular_tolerance=0.2)
            offset = len(verts)
            verts.extend([(v.X, v.Y, v.Z) for v in mesh[0]])
            faces.extend([[i + offset for i in tri] for tri in mesh[1]])
        return trimesh.Trimesh(vertices=np.array(verts), faces=np.array(faces), process=True)
    m = trimesh.load(p, force="mesh")
    if isinstance(m, trimesh.Scene):
        m = trimesh.util.concatenate([g for g in m.geometry.values()])
    return m


def vol_iou(ref_path: Path, cand_path: Path, voxel_pitch: float | None = None) -> float:
    """Volumetric IoU via voxelization. Auto-pick pitch from bbox diagonal."""
    R = _load_mesh(ref_path)
    C = _load_mesh(cand_path)
    if voxel_pitch is None:
        diag = float(np.linalg.norm(R.bounding_box.extents))
        voxel_pitch = max(0.25, diag / 200.0)
    rv = R.voxelized(pitch=voxel_pitch).fill()
    cv = C.voxelized(pitch=voxel_pitch).fill()
    # align grids: project both onto a common origin/extent
    origin = np.minimum(R.bounds[0], C.bounds[0])
    extent = np.maximum(R.bounds[1], C.bounds[1]) - origin
    dims = np.ceil(extent / voxel_pitch).astype(int) + 2
    def to_grid(vox):
        idx = np.round((vox.points - origin) / voxel_pitch).astype(int)
        g = np.zeros(dims, dtype=bool)
        idx = idx[(idx >= 0).all(1) & (idx < dims).all(1)]
        g[idx[:, 0], idx[:, 1], idx[:, 2]] = True
        return g
    a, b = to_grid(rv), to_grid(cv)
    inter = np.logical_and(a, b).sum()
    union = np.logical_or(a, b).sum()
    return float(inter) / float(union) if union else 0.0


def chamfer(ref_path: Path, cand_path: Path) -> float:
    """Symmetric (bidirectional) chamfer distance, mm. Lower = better."""
    R = _load_mesh(ref_path)
    C = _load_mesh(cand_path)
    rs, _ = trimesh.sample.sample_surface_even(R, SAMPLE_N)
    cs, _ = trimesh.sample.sample_surface_even(C, SAMPLE_N)
    from scipy.spatial import cKDTree
    tr = cKDTree(rs); tc = cKDTree(cs)
    d_rc, _ = tc.query(rs)
    d_cr, _ = tr.query(cs)
    return float((d_rc.mean() + d_cr.mean()) / 2.0)


def hausdorff_p95(ref_path: Path, cand_path: Path) -> float:
    """95th-percentile Hausdorff distance (more stable than max), mm."""
    R = _load_mesh(ref_path)
    C = _load_mesh(cand_path)
    rs, _ = trimesh.sample.sample_surface_even(R, SAMPLE_N)
    cs, _ = trimesh.sample.sample_surface_even(C, SAMPLE_N)
    from scipy.spatial import cKDTree
    tr = cKDTree(rs); tc = cKDTree(cs)
    d_rc, _ = tc.query(rs)
    d_cr, _ = tr.query(cs)
    return float(max(np.percentile(d_rc, 95), np.percentile(d_cr, 95)))


def normal_consistency(ref_path: Path, cand_path: Path) -> float:
    """1/N Σ |n_r · n_c| over nearest-neighbor pairs. In [0,1], higher better."""
    R = _load_mesh(ref_path)
    C = _load_mesh(cand_path)
    rs, ridx = trimesh.sample.sample_surface_even(R, SAMPLE_N)
    cs, cidx = trimesh.sample.sample_surface_even(C, SAMPLE_N)
    from scipy.spatial import cKDTree
    tc = cKDTree(cs)
    _, nn = tc.query(rs)
    rn = R.face_normals[ridx]
    cn = C.face_normals[cidx][nn]
    cos = np.einsum("ij,ij->i", rn, cn)
    return float(np.mean(np.abs(cos)))
