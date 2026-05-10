"""STEP round-trip and BREP-fidelity probes."""
from __future__ import annotations
from pathlib import Path
import tempfile

from .geometry import _load_mesh, chamfer


def step_roundtrip(cand_path: Path) -> float:
    """Read STEP -> write STEP -> re-read; chamfer between original and round-tripped.

    Returns 1.0 / (1 + chamfer_mm) so values are in (0,1] with higher better.
    A clean BREP round-trip should be ~1.0.
    """
    p = Path(cand_path)
    if p.suffix.lower() not in (".step", ".stp"):
        return 0.0  # mesh-only outputs cannot round-trip BREP
    from build123d import import_step, export_step
    shape = import_step(str(p))
    with tempfile.NamedTemporaryFile(suffix=".step", delete=False) as f:
        out = Path(f.name)
    export_step(shape, str(out))
    d = chamfer(p, out)
    return 1.0 / (1.0 + d)
