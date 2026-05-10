"""L1 BREP-fidelity reference parts."""
from __future__ import annotations
from build123d import BuildPart, Cylinder, Mode, Align, Locations, fillet
from build123d.topology import Part


# ----- BREP-004 thin-wall cup ------------------------------------------------

def thinwall_cup() -> Part:
    """OD 30, height 40, wall 1 mm. Stand-in for BREP-004 (thin-wall stress)."""
    bottom_align = (Align.CENTER, Align.CENTER, Align.MIN)
    with BuildPart() as p:
        Cylinder(radius=15, height=40, align=bottom_align)
        # cavity: 1 mm floor at z=0..1, then hollow up to z=40
        with Locations((0, 0, 1)):
            Cylinder(radius=14, height=39, align=bottom_align, mode=Mode.SUBTRACT)
    inner_base = [
        e for e in p.part.edges()
        if abs(e.center().Z - 1) < 0.05
        and 13.5 < (e.center().X**2 + e.center().Y**2) ** 0.5 < 14.5
    ]
    if inner_base:
        try:
            return fillet(inner_base, 0.5)
        except Exception:
            pass
    return p.part
