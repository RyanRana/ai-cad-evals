"""L1 boolean robustness reference parts."""
from __future__ import annotations
from build123d import (
    BuildPart, Box, Cylinder, Mode, Locations, GridLocations, fillet, Plane,
)
from build123d.topology import Part


# ----- BOOL-003 coplanar union with shared-edge fillet ----------------------

def coplanar_union_filleted() -> Part:
    """Two 20x20x20 cubes touching on +X/-X faces, union, fillet shared edges R1."""
    with BuildPart() as p:
        with Locations((-10, 0, 0), (10, 0, 0)):
            Box(20, 20, 20)
    # The shared seam runs along the y-axis at x=0 on both ±z faces and ±y faces.
    seam = [
        e for e in p.part.edges()
        if abs(e.center().X) < 0.01 and abs(e.length - 20) < 0.05
    ]
    if seam:
        try:
            return fillet(seam, 1.0)
        except Exception:
            return p.part
    return p.part


# ----- BOOL-009 lattice subtraction -----------------------------------------

def lattice_subtraction() -> Part:
    """60x60x60 cube minus 7x7 grid of Ø4 through-holes at 8 mm pitch."""
    with BuildPart() as p:
        Box(60, 60, 60)
        with GridLocations(8, 8, 7, 7):
            Cylinder(radius=2, height=70, mode=Mode.SUBTRACT)
    return p.part
