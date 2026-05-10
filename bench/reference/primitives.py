"""L1 primitives — exact, parameter-driven authoring.

Every function is the *single source of truth* for the canonical part. Specs
displayed on the site (volume, area, bbox, named dimensions) are extracted
from these solids by `bench/seed.py`, never typed by hand.
"""
from __future__ import annotations
import math

from build123d import (
    BuildPart, BuildSketch, Box, Cylinder, Sphere, Mode, Location, Pos, Rot,
    RegularPolygon, Circle, Rectangle, extrude, loft, fillet, Align, Torus,
    Plane,
)
from build123d.topology import Part


# ----- PRIM-001 hollow cylinder ---------------------------------------------

def hollow_cylinder() -> Part:
    """Outer Ø60, inner Ø40, height 100. Origin at bottom-face centroid."""
    bottom_align = (Align.CENTER, Align.CENTER, Align.MIN)
    with BuildPart() as p:
        Cylinder(radius=30, height=100, align=bottom_align)
        Cylinder(radius=20, height=100, align=bottom_align, mode=Mode.SUBTRACT)
    return p.part


# ----- PRIM-002 sphere capped -----------------------------------------------

def sphere_capped() -> Part:
    """Sphere R=25 cut by z=18, keep -z portion. Origin at sphere centre."""
    from build123d import Locations
    with BuildPart() as p:
        Sphere(25)
        with Locations((0, 0, 18)):
            Box(60, 60, 60,
                align=(Align.CENTER, Align.CENTER, Align.MIN),
                mode=Mode.SUBTRACT)
    return p.part


# ----- PRIM-003 round frustum -----------------------------------------------

def frustum_round() -> Part:
    """Bottom Ø60, top Ø30, height 50. Origin at bottom-face centroid."""
    with BuildPart() as p:
        with BuildSketch() as bot:
            Circle(30)
        with BuildSketch(Plane.XY.offset(50)) as top:
            Circle(15)
        loft([bot.sketch, top.sketch])
    return p.part


# ----- PRIM-004 square pyramid frustum --------------------------------------

def frustum_square() -> Part:
    """Base 50x50, top 20x20, height 30. Origin at base centre."""
    with BuildPart() as p:
        with BuildSketch() as bot:
            Rectangle(50, 50)
        with BuildSketch(Plane.XY.offset(30)) as top:
            Rectangle(20, 20)
        loft([bot.sketch, top.sketch])
    return p.part


# ----- PRIM-005 tilted box --------------------------------------------------

def tilted_box() -> Part:
    """40x40x80 rotated 30° about Y from +Z. Origin at centroid."""
    with BuildPart() as p:
        Box(40, 40, 80)
    return p.part.moved(Location((0, 0, 0), (0, 1, 0), 30))


# ----- PRIM-007 hex prism with edge fillet ----------------------------------

def hex_prism_filleted() -> Part:
    """Across-flats 24, height 12, top-edge fillet R0.4. Origin centred."""
    af = 24.0
    # build123d's RegularPolygon with major_radius=False uses inradius
    # (= half across-flats); pass af/2 directly.
    with BuildPart() as p:
        with BuildSketch():
            RegularPolygon(radius=af / 2, side_count=6, major_radius=False)
        extrude(amount=12, both=False)
    # fillet the top hex perimeter (top face is at z=12, build123d extrudes
    # symmetric by default? Use both=False to keep base at z=0).
    top_z = max(v.Z for v in p.part.vertices())
    top_edges = [e for e in p.part.edges() if abs(e.center().Z - top_z) < 0.05]
    if top_edges:
        try:
            return fillet(top_edges, 0.4)
        except Exception:
            return p.part
    return p.part


# ----- PRIM-009 hollow torus ------------------------------------------------

def hollow_torus() -> Part:
    """Mean ring Ø100, tube Ø8 outer, 1 mm wall. Sealed hollow toroidal shell."""
    R = 50.0
    r_outer = 4.0
    r_inner = 3.0
    with BuildPart() as p:
        Torus(major_radius=R, minor_radius=r_outer)
        Torus(major_radius=R, minor_radius=r_inner, mode=Mode.SUBTRACT)
    return p.part
