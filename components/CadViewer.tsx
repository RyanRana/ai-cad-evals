"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

// Small Three.js viewer for procedurally-described CAD parts. We avoid
// shipping STL/STEP fixtures (they balloon the bundle) and instead build
// the reference mesh in the browser from a compact JSON description that
// each Task carries. Free orbit, ortho-style framing, soft shadows.
//
// `shape` is a tagged-union — the same primitives used to express the
// canonical ground-truth on /methodology — so the viewer is honest about
// what it is showing.
export type ShapeDesc =
  | { type: "hollow_cylinder"; outerR: number; innerR: number; height: number }
  | { type: "hex_prism"; acrossFlats: number; height: number; filletR?: number }
  | { type: "lattice_block"; size: number; n: number; pitch: number; holeD: number }
  | { type: "L_bracket"; legA: number; legB: number; thickness: number; holeD: number; slotW: number; slotL: number }
  | { type: "stepped_shaft"; segments: { d: number; l: number }[] }
  | { type: "carrier_plate"; r: number; thickness: number; bores: { r: number; n: number; pcd: number; phase?: number }[] }
  | { type: "pin"; d: number; l: number; chamfer?: number }
  | { type: "dovetail"; baseW: number; topW: number; height: number; length: number }
  | { type: "enclosure_half"; w: number; h: number; d: number; wall: number; bossR: number }
  | { type: "hinge"; w: number; h: number; t: number; web: number }
  | { type: "goblet"; cupR: number; cupH: number; stemR: number; stemH: number; baseR: number; baseT: number }
  | { type: "flange"; hubR: number; hubH: number; plateR: number; plateT: number; pcd: number; boltR: number }
  | { type: "blade"; chord: number; span: number; twist: number; thickness: number }
  | { type: "box"; size: [number, number, number] }
  | { type: "csg_union"; a: ShapeDesc; b: ShapeDesc; offsetA?: [number, number, number]; offsetB?: [number, number, number] }
  | { type: "impeller"; hubR: number; hubH: number; bladeCount: number; chord: number; span: number; twist: number; thickness: number; shroudR?: number }
  | { type: "gear"; teeth: number; module: number; thickness: number; boreR: number; toothH?: number; helix?: number; internal?: boolean }
  | { type: "planetary_gearset"; ringTeeth: number; sunTeeth: number; planetTeeth: number; module: number; thickness: number; boreR: number };

// Per-agent visualisation degradation. Applied to the canonical reference
// shape so each agent's tile shows what its scoring profile actually means
// in geometry terms — faceted tessellation for mesh-only models, random
// non-manifold face removal, dimension-error scale, missing features, or a
// "no manifold solid produced" failure tile.
export type Degrade = {
  /** 0..1 fraction of triangles to randomly drop. Creates visible holes. */
  nonManifold?: number;
  /** Per-axis scale jitter applied to the whole mesh (named-dim error). */
  scale?: [number, number, number];
  /** "mesh-only" → flat-shaded faceted look; "csg" → faceted but cleaner. */
  shading?: "smooth" | "csg" | "facets";
  /** Drop random sub-features (bores, segments) at this rate. */
  missingFeatures?: number;
  /** Replace the whole shape with its bounding-box approximation (low-fi). */
  bboxOnly?: boolean;
  /** If true, render a "no manifold solid produced" tile instead. */
  failed?: boolean;
  /** Mesh material colour. */
  color?: number;
  /** Random seed so degradation is deterministic per-agent-per-task. */
  seed?: number;
};

function mulberry32(seed: number) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- shared-context viewer manager ---------------------------------------
// Browsers cap simultaneous WebGL contexts at ~16. We sidestep the cap with
// a single offscreen WebGL renderer that draws each viewer's scene+camera
// in turn into per-viewer 2D canvases via drawImage. One context for the
// whole page, no matter how many viewers, no flicker, no eviction.
//
// Each viewer renders once on mount and only re-renders when marked dirty
// (orbit / wheel / resize). 21 static viewers cost ~21 RAF ticks of work
// once and ~zero ongoing.

type ViewerEntry = {
  destCanvas: HTMLCanvasElement;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  dirty: boolean;
  width: number;
  height: number;
  dpr: number;
};

let manager: {
  off: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  viewers: Set<ViewerEntry>;
} | null = null;

function getManager() {
  if (manager) return manager;
  if (typeof window === "undefined") return null;

  const off = document.createElement("canvas");
  off.width = 16;
  off.height = 16;
  const renderer = new THREE.WebGLRenderer({
    canvas: off,
    antialias: true,
    alpha: true,
    // drawImage from a WebGL canvas only works reliably when the buffer
    // isn't cleared on the next compositor frame. Trades a small perf hit
    // for correctness across browsers.
    preserveDrawingBuffer: true,
  });
  renderer.shadowMap.enabled = true;

  const viewers = new Set<ViewerEntry>();

  // Render at most a handful of dirty viewers per frame to avoid a large
  // initial-mount stall when 20 tiles all mark dirty at once.
  const MAX_PER_FRAME = 4;

  function tick() {
    if (!manager) return;
    let rendered = 0;
    for (const v of viewers) {
      if (!v.dirty) continue;
      if (v.width === 0 || v.height === 0) continue;
      const rw = Math.max(1, Math.floor(v.width * v.dpr));
      const rh = Math.max(1, Math.floor(v.height * v.dpr));
      renderer.setSize(rw, rh, false);
      v.camera.aspect = v.width / v.height;
      v.camera.updateProjectionMatrix();
      renderer.render(v.scene, v.camera);

      if (v.destCanvas.width !== rw || v.destCanvas.height !== rh) {
        v.destCanvas.width = rw;
        v.destCanvas.height = rh;
      }
      const ctx = v.destCanvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, rw, rh);
        ctx.drawImage(off, 0, 0);
      }
      v.dirty = false;
      rendered++;
      if (rendered >= MAX_PER_FRAME) break;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  manager = { off, renderer, viewers };
  return manager;
}

function registerViewer(v: ViewerEntry) {
  const m = getManager();
  if (!m) return;
  m.viewers.add(v);
  v.dirty = true;
}

function unregisterViewer(v: ViewerEntry) {
  if (!manager) return;
  manager.viewers.delete(v);
}

function disposeScene(scene: THREE.Scene) {
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    if (m.material) {
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      mats.forEach((mat) => mat.dispose());
    }
  });
}

export function CadViewer({
  shape,
  height = 360,
  label,
  degrade,
}: {
  shape: ShapeDesc;
  height?: number;
  label?: string;
  degrade?: Degrade;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [info, setInfo] = useState<{ tris: number; bbox: [number, number, number] } | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (degrade?.failed) return; // failure tile is rendered in JSX below
    const el = ref.current;

    const scene = new THREE.Scene();
    scene.background = null;

    const mesh = buildMesh(shape, degrade);
    scene.add(mesh);

    if (!degrade?.bboxOnly) {
      const wire = new THREE.LineSegments(
        new THREE.EdgesGeometry((mesh.children[0] as THREE.Mesh).geometry, 18),
        new THREE.LineBasicMaterial({
          color: new THREE.Color(0x222222),
          transparent: true,
          opacity: degrade?.shading === "facets" ? 0.45 : 0.32,
        }),
      );
      mesh.add(wire);
    }

    const grid = new THREE.GridHelper(400, 40, 0x9c9c9c, 0xd6d3c7);
    (grid.material as THREE.Material).opacity = 0.45;
    (grid.material as THREE.Material).transparent = true;
    scene.add(grid);

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(120, 200, 120);
    key.castShadow = true;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(-120, 60, -100);
    scene.add(fill);

    const bb = new THREE.Box3().setFromObject(mesh);
    const size = new THREE.Vector3();
    bb.getSize(size);
    const center = new THREE.Vector3();
    bb.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z);

    const initW = Math.max(1, el.clientWidth);
    const camera = new THREE.PerspectiveCamera(35, initW / height, 1, 4000);
    camera.position.set(center.x + maxDim * 1.6, center.y + maxDim * 1.4, center.z + maxDim * 1.6);
    camera.lookAt(center);

    let triCount = 0;
    mesh.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const g = (o as THREE.Mesh).geometry as THREE.BufferGeometry;
        const idx = g.index ? g.index.count : g.attributes.position.count;
        triCount += idx / 3;
      }
    });
    setInfo({ tris: Math.round(triCount), bbox: [+size.x.toFixed(1), +size.y.toFixed(1), +size.z.toFixed(1)] });

    // Per-viewer destination canvas — a normal 2D canvas, no WebGL context.
    const dest = document.createElement("canvas");
    dest.style.display = "block";
    dest.style.width = "100%";
    dest.style.height = "100%";
    dest.style.touchAction = "none";
    el.appendChild(dest);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const entry: ViewerEntry = {
      destCanvas: dest,
      scene,
      camera,
      dirty: true,
      width: initW,
      height,
      dpr,
    };
    registerViewer(entry);

    // Orbit controls — track yaw/pitch/radius, mark dirty on any change.
    let dragging = false;
    let yaw = Math.atan2(camera.position.x - center.x, camera.position.z - center.z);
    let pitch = Math.atan2(
      camera.position.y - center.y,
      Math.hypot(camera.position.x - center.x, camera.position.z - center.z),
    );
    let radius = camera.position.distanceTo(center);
    let lastX = 0;
    let lastY = 0;

    function place() {
      pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, pitch));
      camera.position.set(
        center.x + radius * Math.cos(pitch) * Math.sin(yaw),
        center.y + radius * Math.sin(pitch),
        center.z + radius * Math.cos(pitch) * Math.cos(yaw),
      );
      camera.lookAt(center);
      entry.dirty = true;
    }
    function down(e: MouseEvent) { dragging = true; lastX = e.clientX; lastY = e.clientY; }
    function move(e: MouseEvent) {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      yaw -= dx * 0.005;
      pitch += dy * 0.005;
      place();
    }
    function up() { dragging = false; }
    function wheel(e: WheelEvent) {
      e.preventDefault();
      radius *= 1 + e.deltaY * 0.0015;
      radius = Math.max(maxDim * 0.5, Math.min(maxDim * 6, radius));
      place();
    }
    dest.addEventListener("mousedown", down);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    dest.addEventListener("wheel", wheel, { passive: false });

    const ro = new ResizeObserver(() => {
      entry.width = Math.max(1, el.clientWidth);
      entry.height = height;
      entry.dirty = true;
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      dest.removeEventListener("mousedown", down);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      dest.removeEventListener("wheel", wheel);
      unregisterViewer(entry);
      if (dest.parentNode === el) el.removeChild(dest);
      disposeScene(scene);
    };
  }, [shape, height, degrade]);

  if (degrade?.failed) {
    return (
      <div
        className="border rounded-md bg-[var(--card)] overflow-hidden relative flex items-center justify-center"
        style={{ height }}
      >
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent 0 6px, var(--bad) 6px 7px)" }} />
        <div className="relative text-center px-4">
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--bad)] mb-1">no manifold solid produced</div>
          <div className="font-mono text-[10px] text-[var(--muted)] leading-snug">{label ?? "agent run failed validity gate"}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-md bg-[var(--card)] overflow-hidden relative">
      <div ref={ref} style={{ height }} className="w-full" />
      <div className="absolute top-2 left-3 text-[10px] font-mono text-[var(--muted)] pointer-events-none">
        {label ?? "ground-truth render · drag to orbit · scroll to zoom"}
      </div>
      {info && (
        <div className="absolute bottom-2 right-3 text-[10px] font-mono text-[var(--muted)] tabular-nums pointer-events-none">
          {info.tris.toLocaleString()} tris · bbox {info.bbox[0]}×{info.bbox[1]}×{info.bbox[2]} mm
        </div>
      )}
    </div>
  );
}

// ---- mesh construction -----------------------------------------------

function buildMesh(shape: ShapeDesc, degrade?: Degrade): THREE.Group {
  const g = new THREE.Group();
  const flat = degrade?.shading === "facets" || degrade?.shading === "csg";
  const baseColor = degrade?.color ?? 0xc8c8c8;
  const mat = new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness: degrade?.shading === "facets" ? 0.85 : 0.55,
    metalness: degrade?.shading === "facets" ? 0.05 : 0.15,
    flatShading: flat,
    side: degrade?.nonManifold ? THREE.DoubleSide : THREE.FrontSide,
  });

  let geo: THREE.BufferGeometry;
  if (degrade?.bboxOnly) {
    // Replace the shape with a coarse bbox approximation — what a model that
    // missed the spec entirely returns: roughly the right volume, none of the
    // features.
    const ref = buildGeometry(shape);
    ref.computeBoundingBox();
    const bb = ref.boundingBox!;
    const sx = (bb.max.x - bb.min.x) || 1;
    const sy = (bb.max.y - bb.min.y) || 1;
    const sz = (bb.max.z - bb.min.z) || 1;
    geo = new THREE.BoxGeometry(sx * 0.95, sy * 0.95, sz * 0.95, 1, 1, 1);
    geo.translate((bb.max.x + bb.min.x) / 2, (bb.max.y + bb.min.y) / 2, (bb.max.z + bb.min.z) / 2);
  } else {
    geo = buildGeometry(shape, degrade);
  }

  if (degrade?.scale) {
    geo.scale(degrade.scale[0], degrade.scale[1], degrade.scale[2]);
  }

  if (degrade?.nonManifold && degrade.nonManifold > 0) {
    geo = dropRandomTriangles(geo, degrade.nonManifold, degrade.seed ?? 1);
  }

  if (flat) {
    geo.computeVertexNormals();
  }

  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return g;
}

function dropRandomTriangles(g: THREE.BufferGeometry, fraction: number, seed: number): THREE.BufferGeometry {
  const ng = g.index ? g.toNonIndexed() : g;
  const pos = ng.attributes.position.array as Float32Array;
  const triCount = pos.length / 9;
  const keep = Math.max(8, Math.floor(triCount * (1 - fraction)));
  const rand = mulberry32(seed * 9973);
  // Fisher-Yates partial — pick `keep` indices.
  const indices = new Array(triCount);
  for (let i = 0; i < triCount; i++) indices[i] = i;
  for (let i = 0; i < keep; i++) {
    const j = i + Math.floor(rand() * (triCount - i));
    const t = indices[i]; indices[i] = indices[j]; indices[j] = t;
  }
  const out = new Float32Array(keep * 9);
  for (let i = 0; i < keep; i++) {
    const src = indices[i] * 9;
    for (let k = 0; k < 9; k++) out[i * 9 + k] = pos[src + k];
  }
  const dst = new THREE.BufferGeometry();
  dst.setAttribute("position", new THREE.Float32BufferAttribute(out, 3));
  dst.computeVertexNormals();
  return dst;
}

function buildGeometry(shape: ShapeDesc, degrade?: Degrade): THREE.BufferGeometry {
  // Tessellation multiplier — mesh-only / faceted agents look coarse.
  const tess = degrade?.shading === "facets" ? 0.18 : degrade?.shading === "csg" ? 0.45 : 1;
  const segs = (n: number) => Math.max(6, Math.round(n * tess));
  const featureRand = mulberry32((degrade?.seed ?? 1) * 7919);
  const keep = (rate: number) => featureRand() >= rate;
  switch (shape.type) {
    case "box": {
      return new THREE.BoxGeometry(...shape.size);
    }
    case "hollow_cylinder": {
      // Built as a single open-ended geometry by merging outer cylinder + inner cylinder + two annulus rings.
      const s = segs(64);
      const outer = new THREE.CylinderGeometry(shape.outerR, shape.outerR, shape.height, s, 1, true);
      const inner = new THREE.CylinderGeometry(shape.innerR, shape.innerR, shape.height, s, 1, true);
      flipNormals(inner);
      const top = ring(shape.outerR, shape.innerR, s, shape.height / 2);
      const bot = ring(shape.outerR, shape.innerR, s, -shape.height / 2);
      flipNormals(bot);
      return mergeGeoms([outer, inner, top, bot]);
    }
    case "hex_prism": {
      const r = shape.acrossFlats / Math.cos(Math.PI / 6) / 2;
      const shape2d = new THREE.Shape();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const x = r * Math.cos(a);
        const y = r * Math.sin(a);
        if (i === 0) shape2d.moveTo(x, y);
        else shape2d.lineTo(x, y);
      }
      shape2d.closePath();
      return new THREE.ExtrudeGeometry(shape2d, { depth: shape.height, bevelEnabled: !!shape.filletR, bevelSize: shape.filletR ?? 0, bevelThickness: shape.filletR ?? 0, bevelSegments: 4 });
    }
    case "lattice_block": {
      const block = new THREE.BoxGeometry(shape.size, shape.size, shape.size);
      const geos: THREE.BufferGeometry[] = [block];
      const start = -((shape.n - 1) * shape.pitch) / 2;
      const skip = degrade?.missingFeatures ?? 0;
      for (let i = 0; i < shape.n; i++) {
        for (let j = 0; j < shape.n; j++) {
          if (skip > 0 && !keep(skip)) continue;
          const x = start + i * shape.pitch;
          const y = start + j * shape.pitch;
          const cyl = new THREE.CylinderGeometry(shape.holeD / 2, shape.holeD / 2, shape.size + 0.01, segs(24), 1, true);
          cyl.rotateX(Math.PI / 2);
          cyl.translate(x, y, 0);
          flipNormals(cyl);
          geos.push(cyl);
        }
      }
      return mergeGeoms(geos);
    }
    case "L_bracket": {
      const t = shape.thickness;
      const a = shape.legA;
      const b = shape.legB;
      // L profile in XY, extruded along Z (thickness already 3D thanks to two leg boxes).
      const hor = new THREE.BoxGeometry(a, t, 30);
      hor.translate(a / 2, t / 2, 0);
      const ver = new THREE.BoxGeometry(t, b, 30);
      ver.translate(t / 2, b / 2, 0);
      // hole through long leg
      const hole = new THREE.CylinderGeometry(shape.holeD / 2, shape.holeD / 2, t * 1.1, segs(32), 1, true);
      hole.rotateZ(Math.PI / 2);
      hole.translate(a - 30, t / 2, 0);
      flipNormals(hole);
      // slot through short leg (visualised as a swept hole)
      const slot = new THREE.BoxGeometry(t * 1.1, shape.slotL, shape.slotW);
      slot.translate(t / 2, b - 20, 0);
      return mergeGeoms([hor, ver, hole, slot]);
    }
    case "stepped_shaft": {
      const geos: THREE.BufferGeometry[] = [];
      let z = 0;
      for (const seg of shape.segments) {
        const c = new THREE.CylinderGeometry(seg.d / 2, seg.d / 2, seg.l, segs(48));
        c.rotateZ(Math.PI / 2);
        c.translate(z + seg.l / 2, 0, 0);
        geos.push(c);
        z += seg.l;
      }
      return mergeGeoms(geos);
    }
    case "carrier_plate": {
      const skip = degrade?.missingFeatures ?? 0;
      const geos: THREE.BufferGeometry[] = [new THREE.CylinderGeometry(shape.r, shape.r, shape.thickness, segs(96))];
      for (const b of shape.bores) {
        for (let i = 0; i < b.n; i++) {
          if (skip > 0 && !keep(skip)) continue;
          const ang = (i / b.n) * Math.PI * 2 + (b.phase ?? 0);
          const cx = (b.pcd / 2) * Math.cos(ang);
          const cy = (b.pcd / 2) * Math.sin(ang);
          const c = new THREE.CylinderGeometry(b.r, b.r, shape.thickness * 1.1, segs(32), 1, true);
          c.translate(cx, 0, cy);
          flipNormals(c);
          geos.push(c);
        }
      }
      return mergeGeoms(geos);
    }
    case "pin": {
      const c = new THREE.CylinderGeometry(shape.d / 2, shape.d / 2, shape.l, segs(48));
      c.rotateZ(Math.PI / 2);
      return c;
    }
    case "dovetail": {
      const s = new THREE.Shape();
      s.moveTo(-shape.baseW / 2, 0);
      s.lineTo(shape.baseW / 2, 0);
      s.lineTo(shape.topW / 2, shape.height);
      s.lineTo(-shape.topW / 2, shape.height);
      s.closePath();
      return new THREE.ExtrudeGeometry(s, { depth: shape.length, bevelEnabled: false });
    }
    case "enclosure_half": {
      const outer = new THREE.BoxGeometry(shape.w, shape.h, shape.d);
      const inner = new THREE.BoxGeometry(shape.w - 2 * shape.wall, shape.h - shape.wall, shape.d - 2 * shape.wall);
      inner.translate(0, shape.wall / 2, 0);
      flipNormals(inner);
      const geos: THREE.BufferGeometry[] = [outer, inner];
      const cornerX = (shape.w - 4 * shape.wall) / 2;
      const cornerZ = (shape.d - 4 * shape.wall) / 2;
      const skip = degrade?.missingFeatures ?? 0;
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
        if (skip > 0 && !keep(skip)) continue;
        const boss = new THREE.CylinderGeometry(shape.bossR, shape.bossR, shape.h - shape.wall, segs(24));
        boss.translate(sx * cornerX, -shape.wall / 2, sz * cornerZ);
        geos.push(boss);
      }
      return mergeGeoms(geos);
    }
    case "hinge": {
      const a = new THREE.BoxGeometry(shape.w / 2 - 1, shape.t, shape.h);
      a.translate(-shape.w / 4 - 0.5, 0, 0);
      const b = new THREE.BoxGeometry(shape.w / 2 - 1, shape.t, shape.h);
      b.translate(shape.w / 4 + 0.5, 0, 0);
      const web = new THREE.BoxGeometry(2, shape.web, shape.h);
      return mergeGeoms([a, b, web]);
    }
    case "goblet": {
      const cup = lathe([
        [0, 0],
        [shape.cupR * 0.4, 0],
        [shape.cupR, shape.cupH * 0.6],
        [shape.cupR * 0.95, shape.cupH],
      ], segs(64));
      cup.translate(0, shape.stemH + shape.baseT, 0);
      const stem = new THREE.CylinderGeometry(shape.stemR, shape.stemR, shape.stemH, segs(32));
      stem.translate(0, shape.stemH / 2 + shape.baseT, 0);
      const base = new THREE.CylinderGeometry(shape.baseR, shape.baseR, shape.baseT, segs(48));
      base.translate(0, shape.baseT / 2, 0);
      return mergeGeoms([cup, stem, base]);
    }
    case "flange": {
      const hub = new THREE.CylinderGeometry(shape.hubR, shape.hubR, shape.hubH, segs(64));
      const plate = new THREE.CylinderGeometry(shape.plateR, shape.plateR, shape.plateT, segs(96));
      plate.translate(0, -shape.hubH / 2 + shape.plateT / 2, 0);
      const geos: THREE.BufferGeometry[] = [hub, plate];
      const skip = degrade?.missingFeatures ?? 0;
      for (let i = 0; i < 6; i++) {
        if (skip > 0 && !keep(skip)) continue;
        const ang = (i / 6) * Math.PI * 2;
        const x = (shape.pcd / 2) * Math.cos(ang);
        const z = (shape.pcd / 2) * Math.sin(ang);
        const bolt = new THREE.CylinderGeometry(shape.boltR, shape.boltR, shape.plateT * 1.1, segs(24), 1, true);
        bolt.translate(x, -shape.hubH / 2 + shape.plateT / 2, z);
        flipNormals(bolt);
        geos.push(bolt);
      }
      return mergeGeoms(geos);
    }
    case "blade": {
      // Lofted along span with NACA-ish thickness profile and twist.
      const sections: THREE.Vector3[][] = [];
      const N = 24;
      const M = 28;
      for (let s = 0; s <= M; s++) {
        const t = s / M;
        const tw = t * shape.twist * (Math.PI / 180);
        const sec: THREE.Vector3[] = [];
        for (let i = 0; i <= N; i++) {
          const u = i / N;
          // 5-digit NACA-style symmetric thickness ~ 0.594*sqrt(u) - 0.126 u - 0.353 u^2 + 0.292 u^3 - 0.107 u^4 (scaled)
          const yt = (0.594 * Math.sqrt(u) - 0.126 * u - 0.353 * u * u + 0.292 * u * u * u - 0.107 * u * u * u * u) * shape.thickness;
          const camber = 0.05 * Math.sin(Math.PI * u) * shape.chord;
          // upper surface
          const x = (u - 0.5) * shape.chord;
          const y = camber + yt;
          // rotate by tw
          const xr = x * Math.cos(tw) - y * Math.sin(tw);
          const yr = x * Math.sin(tw) + y * Math.cos(tw);
          sec.push(new THREE.Vector3(xr, yr, t * shape.span));
        }
        // and the lower surface in reverse
        for (let i = N; i >= 0; i--) {
          const u = i / N;
          const yt = (0.594 * Math.sqrt(u) - 0.126 * u - 0.353 * u * u + 0.292 * u * u * u - 0.107 * u * u * u * u) * shape.thickness;
          const camber = 0.05 * Math.sin(Math.PI * u) * shape.chord;
          const x = (u - 0.5) * shape.chord;
          const y = camber - yt;
          const xr = x * Math.cos(tw) - y * Math.sin(tw);
          const yr = x * Math.sin(tw) + y * Math.cos(tw);
          sec.push(new THREE.Vector3(xr, yr, t * shape.span));
        }
        sections.push(sec);
      }
      return loft(sections);
    }
    case "csg_union": {
      const a = buildGeometry(shape.a, degrade);
      const b = buildGeometry(shape.b, degrade);
      if (shape.offsetA) a.translate(...shape.offsetA);
      if (shape.offsetB) b.translate(...shape.offsetB);
      return mergeGeoms([a, b]);
    }
    case "impeller": {
      // Hub (cylinder along Y) + N twisted NACA-ish blades emanating
      // radially. Optional shroud disc above the blades.
      const skip = degrade?.missingFeatures ?? 0;
      const hub = new THREE.CylinderGeometry(shape.hubR, shape.hubR * 0.95, shape.hubH, segs(48));
      hub.translate(0, shape.hubH / 2, 0);
      const geos: THREE.BufferGeometry[] = [hub];

      const N = shape.bladeCount;
      for (let k = 0; k < N; k++) {
        if (skip > 0 && !keep(skip)) continue;
        const bladeSec: THREE.Vector3[][] = [];
        const M = Math.max(8, segs(24));
        const Ndiv = Math.max(8, segs(20));
        for (let s = 0; s <= M; s++) {
          const t = s / M;
          const tw = t * shape.twist * (Math.PI / 180);
          const sec: THREE.Vector3[] = [];
          for (let i = 0; i <= Ndiv; i++) {
            const u = i / Ndiv;
            const yt = (0.594 * Math.sqrt(u) - 0.126 * u - 0.353 * u * u + 0.292 * u * u * u - 0.107 * u * u * u * u) * shape.thickness;
            const x = (u - 0.5) * shape.chord;
            const yPlus = yt;
            const xrU = x * Math.cos(tw) - yPlus * Math.sin(tw);
            const yrU = x * Math.sin(tw) + yPlus * Math.cos(tw);
            sec.push(new THREE.Vector3(xrU, yrU, shape.hubR + t * shape.span));
          }
          for (let i = Ndiv; i >= 0; i--) {
            const u = i / Ndiv;
            const yt = (0.594 * Math.sqrt(u) - 0.126 * u - 0.353 * u * u + 0.292 * u * u * u - 0.107 * u * u * u * u) * shape.thickness;
            const x = (u - 0.5) * shape.chord;
            const yMinus = -yt;
            const xrL = x * Math.cos(tw) - yMinus * Math.sin(tw);
            const yrL = x * Math.sin(tw) + yMinus * Math.cos(tw);
            sec.push(new THREE.Vector3(xrL, yrL, shape.hubR + t * shape.span));
          }
          bladeSec.push(sec);
        }
        const bladeGeo = loft(bladeSec);
        // Local frame: x=chord, y=thickness, z=span (running from hubR outward).
        // We want span along world +X (radial) and thickness along world Y.
        // Rotate -90° about Y: (x,y,z) → (z, y, -x). z(span) → x(radial). ✓
        bladeGeo.rotateY(-Math.PI / 2);
        // Lift the blade to mid-hub height.
        bladeGeo.translate(0, shape.hubH / 2, 0);
        // Orbit around Y so blades fan out evenly.
        bladeGeo.rotateY((k / N) * Math.PI * 2);
        geos.push(bladeGeo);
      }
      if (shape.shroudR) {
        const shroud = new THREE.CylinderGeometry(shape.shroudR, shape.shroudR, shape.thickness * 0.6, segs(64));
        shroud.translate(0, shape.hubH + shape.thickness * 0.3, 0);
        geos.push(shroud);
      }
      return mergeGeoms(geos);
    }
    case "gear": {
      return gearGeometry(shape.teeth, shape.module, shape.thickness, shape.boreR, segs, shape.toothH, shape.internal);
    }
    case "planetary_gearset": {
      // All gears live in the XZ plane (axis along Y) after `gearGeometry`'s
      // re-orientation. Planets orbit the sun in the XZ plane.
      const m = shape.module;
      const sunR = (m * shape.sunTeeth) / 2;
      const planetR = (m * shape.planetTeeth) / 2;
      const ringR = (m * shape.ringTeeth) / 2;

      const sunGeo = gearGeometry(shape.sunTeeth, m, shape.thickness, shape.boreR, segs);
      const ring = ringGeometry(shape.ringTeeth, m, shape.thickness, segs);
      const orbit = sunR + planetR;
      const planets: THREE.BufferGeometry[] = [];
      for (let p = 0; p < 3; p++) {
        const ang = (p / 3) * Math.PI * 2;
        const pg = gearGeometry(shape.planetTeeth, m, shape.thickness, m * 0.6, segs);
        // mesh phasing — rotate planet about Y so its teeth align with the sun.
        pg.rotateY(ang * (shape.sunTeeth / shape.planetTeeth));
        pg.translate(orbit * Math.cos(ang), 0, orbit * Math.sin(ang));
        planets.push(pg);
      }

      // Carrier plate sits a half-thickness below the gear stack so the
      // planets visibly rest on it. Cylinder default axis = Y → already in XZ.
      const carrier = new THREE.CylinderGeometry(ringR + m * 1.6, ringR + m * 1.6, shape.thickness * 0.4, segs(96));
      carrier.translate(0, -shape.thickness * 0.7, 0);
      return mergeGeoms([carrier, ring, sunGeo, ...planets]);
    }
  }
}

// Toothed cylindrical gear (extruded). The shape lives in the XY plane and
// is extruded along Z; we then re-orient it to lie in the XZ plane (axis
// along Y) so it composes naturally with cylinders that already use Y as
// their axis.
function gearGeometry(
  teeth: number,
  module_: number,
  thickness: number,
  boreR: number,
  segs: (n: number) => number,
  toothH?: number,
  _internal?: boolean,
): THREE.BufferGeometry {
  const pitchR = (module_ * teeth) / 2;
  const addendum = toothH ?? module_ * 1.4;
  const dedendum = module_ * 0.35;
  const tipR = pitchR + addendum;
  const rootR = pitchR - dedendum;
  const s = new THREE.Shape();
  const half = Math.PI / teeth;
  const flank = half * 0.45;
  for (let i = 0; i < teeth; i++) {
    const c = (i / teeth) * Math.PI * 2;
    const angs: [number, number][] = [
      [c - half, rootR],
      [c - flank, tipR],
      [c + flank, tipR],
      [c + half, rootR],
    ];
    for (let j = 0; j < 4; j++) {
      const [a, r] = angs[j];
      const x = r * Math.cos(a);
      const y = r * Math.sin(a);
      if (i === 0 && j === 0) s.moveTo(x, y);
      else s.lineTo(x, y);
    }
  }
  s.closePath();
  if (boreR > 0) {
    const hole = new THREE.Path();
    hole.absarc(0, 0, boreR, 0, Math.PI * 2, true);
    s.holes.push(hole);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: thickness, bevelEnabled: false, curveSegments: Math.max(24, segs(48)) });
  // Centre on the extrusion axis, then rotate so axis is +Y (matches cylinders).
  g.translate(0, 0, -thickness / 2);
  g.rotateX(-Math.PI / 2);
  return g;
}

// Internal ring gear: outer disc with teeth pointing inward.
function ringGeometry(teeth: number, module_: number, thickness: number, segs: (n: number) => number): THREE.BufferGeometry {
  const pitchR = (module_ * teeth) / 2;
  const addendum = module_ * 1.3;
  const dedendum = module_ * 0.4;
  const tipR = pitchR - addendum;
  const rootR = pitchR + dedendum;
  const outerR = rootR + module_ * 1.6;

  const outline = new THREE.Shape();
  outline.absarc(0, 0, outerR, 0, Math.PI * 2, false);

  const inner = new THREE.Path();
  const half = Math.PI / teeth;
  const flank = half * 0.45;
  for (let i = 0; i < teeth; i++) {
    const c = (i / teeth) * Math.PI * 2;
    const angs: [number, number][] = [
      [c - half, rootR],
      [c - flank, tipR],
      [c + flank, tipR],
      [c + half, rootR],
    ];
    for (let j = 0; j < 4; j++) {
      const [a, r] = angs[j];
      const x = r * Math.cos(a);
      const y = r * Math.sin(a);
      if (i === 0 && j === 0) inner.moveTo(x, y);
      else inner.lineTo(x, y);
    }
  }
  inner.closePath();
  outline.holes.push(inner);

  const g = new THREE.ExtrudeGeometry(outline, { depth: thickness, bevelEnabled: false, curveSegments: Math.max(48, segs(96)) });
  g.translate(0, 0, -thickness / 2);
  g.rotateX(-Math.PI / 2);
  return g;
}

function ring(rOut: number, rIn: number, segs: number, y: number) {
  const positions: number[] = [];
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2;
    const a1 = ((i + 1) / segs) * Math.PI * 2;
    const o0 = [rOut * Math.cos(a0), y, rOut * Math.sin(a0)];
    const o1 = [rOut * Math.cos(a1), y, rOut * Math.sin(a1)];
    const i0 = [rIn * Math.cos(a0), y, rIn * Math.sin(a0)];
    const i1 = [rIn * Math.cos(a1), y, rIn * Math.sin(a1)];
    positions.push(...o0, ...i0, ...o1, ...o1, ...i0, ...i1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  return g;
}

function flipNormals(g: THREE.BufferGeometry) {
  const idx = g.index;
  if (idx) {
    const arr = idx.array as Uint16Array | Uint32Array;
    for (let i = 0; i < arr.length; i += 3) {
      const t = arr[i];
      arr[i] = arr[i + 2];
      arr[i + 2] = t;
    }
    idx.needsUpdate = true;
  }
  g.computeVertexNormals();
}

function mergeGeoms(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // Naive merge: concatenate non-indexed positions+normals. Sufficient for
  // the visualisation use case (we don't need to feed this to a CSG kernel).
  const positions: number[] = [];
  const normals: number[] = [];
  for (const g of geos) {
    const ng = g.toNonIndexed();
    const p = ng.attributes.position.array as Float32Array;
    ng.computeVertexNormals();
    const n = ng.attributes.normal.array as Float32Array;
    positions.push(...p);
    normals.push(...n);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  return out;
}

function lathe(profile: [number, number][], segs: number) {
  const pts = profile.map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, segs);
}

function loft(sections: THREE.Vector3[][]): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const N = sections[0].length;
  for (let s = 0; s < sections.length - 1; s++) {
    const a = sections[s];
    const b = sections[s + 1];
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      const v0 = a[i], v1 = a[j], v2 = b[j], v3 = b[i];
      // tri 1
      positions.push(v0.x, v0.y, v0.z, v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
      // tri 2
      positions.push(v0.x, v0.y, v0.z, v2.x, v2.y, v2.z, v3.x, v3.y, v3.z);
      const nrm = new THREE.Vector3().subVectors(v1, v0).cross(new THREE.Vector3().subVectors(v3, v0)).normalize();
      for (let k = 0; k < 6; k++) normals.push(nrm.x, nrm.y, nrm.z);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  return g;
}
