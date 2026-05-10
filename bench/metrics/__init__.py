"""Metric pipeline. Each metric takes (reference_step, candidate_step) paths
and returns a scalar (0..1 for ratios, mm for distances, bool for flags)."""
from __future__ import annotations
from . import geometry, topology, step

__all__ = ["geometry", "topology", "step"]
