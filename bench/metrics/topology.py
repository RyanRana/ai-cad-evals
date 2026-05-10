"""Topology / BREP-integrity metrics."""
from __future__ import annotations
from pathlib import Path
import trimesh

from .geometry import _load_mesh


def watertight(path: Path) -> bool:
    return bool(_load_mesh(path).is_watertight)


def manifold(path: Path) -> bool:
    m = _load_mesh(path)
    # edge-manifold: every edge bounded by exactly 2 faces
    return bool(m.is_winding_consistent and m.is_watertight)


def euler(path: Path) -> int:
    m = _load_mesh(path)
    V = len(m.vertices)
    E = len(m.edges_unique)
    F = len(m.faces)
    return V - E + F


def euler_compliance(ref_step: Path, cand_step: Path) -> bool:
    return euler(ref_step) == euler(cand_step)
