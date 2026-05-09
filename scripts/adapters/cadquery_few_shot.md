# CadQuery 2.4 — exemplars used in the few-shot prompt

The runner concatenates these into the system prompt for the LLM+CadQuery
adapters. They cover the 8 most common operation classes in the CAD-Bench
suite (extrude, revolve, sweep, loft, fillet, chamfer, hole pattern, shell).
Each is intentionally minimal so the LLM can compose them rather than
copying a closed-form solution.

## ex 1 — hollow cylinder
```python
import cadquery as cq
result = (
    cq.Workplane("XY")
    .circle(30).circle(20)
    .extrude(100)
)
cq.exporters.export(result, "model.step")
```

## ex 2 — hex prism with bevel
```python
import cadquery as cq
result = (
    cq.Workplane("XY")
    .polygon(6, 24, forConstruction=False)
    .extrude(12)
    .edges(">Z").fillet(0.4)
)
cq.exporters.export(result, "model.step")
```

## ex 3 — L-bracket with hole + slot
```python
import cadquery as cq
t = 5
result = (
    cq.Workplane("XY")
    .moveTo(0, 0).lineTo(60, 0).lineTo(60, t).lineTo(t, t).lineTo(t, 40).lineTo(0, 40).close()
    .extrude(30)
    .faces(">Y").workplane().center(0, 0).slot2D(16, 8).cutThruAll()
    .faces(">X").workplane().center(0, 30).hole(6.6)
)
cq.exporters.export(result, "model.step")
```

## ex 4 — stepped shaft
```python
import cadquery as cq
result = (
    cq.Workplane("XY").circle(10).extrude(30)
    .faces(">Z").workplane().circle(8).extrude(25)
    .faces(">Z").workplane().circle(6).extrude(20)
)
cq.exporters.export(result, "model.step")
```

## ex 5 — flange with bolt circle
```python
import cadquery as cq
result = (
    cq.Workplane("XY").circle(50).extrude(8)
    .faces(">Z").workplane().circle(15).extrude(20)
    .faces("<Z").workplane()
    .polarArray(40, 0, 360, 6).circle(3.5).cutThruAll()
)
cq.exporters.export(result, "model.step")
```

## ex 6 — enclosure half (shell)
```python
import cadquery as cq
result = (
    cq.Workplane("XY").box(120, 60, 25)
    .faces("+Z").shell(-2.0)
)
cq.exporters.export(result, "model.step")
```

## ex 7 — revolved goblet
```python
import cadquery as cq
profile = (
    cq.Workplane("XZ")
    .moveTo(0, 0).lineTo(35, 0).lineTo(35, 5).lineTo(5, 5)
    .lineTo(5, 55).lineTo(28, 55).lineTo(30, 100).lineTo(0, 100).close()
)
result = profile.revolve(360, axisStart=(0, 0, 0), axisEnd=(0, 0, 1))
cq.exporters.export(result, "model.step")
```

## ex 8 — lofted blade (NACA 65-(12)10 thickness)
```python
import cadquery as cq, numpy as np

def naca(t, n=24, c=60.0, twist_deg=0.0):
    u = np.linspace(0, 1, n)
    yt = (0.594*np.sqrt(u) - 0.126*u - 0.353*u**2 + 0.292*u**3 - 0.107*u**4) * t
    upper = list(zip((u-0.5)*c, yt))
    lower = list(zip((u-0.5)*c, -yt))[::-1]
    pts = upper + lower
    th = np.deg2rad(twist_deg)
    R = np.array([[np.cos(th), -np.sin(th)], [np.sin(th), np.cos(th)]])
    return [tuple(R @ np.array(p)) for p in pts]

sections = []
for s in np.linspace(0, 80, 10):
    pts = naca(5.0, twist_deg=12.0 * (s / 80))
    sections.append(cq.Workplane("XY").workplane(offset=s).polyline(pts).close())

result = cq.Workplane("XY").placeSketch(sections[0].val()).loft(combine=True, ruled=False)
cq.exporters.export(result, "model.step")
```
