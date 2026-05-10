"""Authored reference parts. Each builder returns a build123d Solid/Compound.

The set of supported task IDs is enumerated in REFERENCES. Anything outside
this map has no canonical reference yet and will be skipped by the runner.
"""
from __future__ import annotations
from typing import Callable, Dict
from . import primitives, boolean, brep

Builder = Callable[[], object]  # returns a build123d Part / Compound

REFERENCES: Dict[str, Builder] = {
    # L1 / primitives
    "PRIM-001": primitives.hollow_cylinder,
    "PRIM-002": primitives.sphere_capped,
    "PRIM-003": primitives.frustum_round,
    "PRIM-004": primitives.frustum_square,
    "PRIM-005": primitives.tilted_box,
    "PRIM-007": primitives.hex_prism_filleted,
    "PRIM-009": primitives.hollow_torus,
    # L1 / boolean robustness
    "BOOL-003": boolean.coplanar_union_filleted,
    "BOOL-009": boolean.lattice_subtraction,
    # L1 / BREP fidelity
    "BREP-004": brep.thinwall_cup,
}
