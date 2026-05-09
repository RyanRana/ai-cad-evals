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
  | { type: "csg_union"; a: ShapeDesc; b: ShapeDesc; offsetA?: [number, number, number]; offsetB?: [number, number, number] };

export function CadViewer({ shape, height = 360, label }: { shape: ShapeDesc; height?: number; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [info, setInfo] = useState<{ tris: number; bbox: [number, number, number] } | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const w = el.clientWidth;
    const h = height;

    const scene = new THREE.Scene();
    scene.background = null;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = true;
    el.appendChild(renderer.domElement);

    const mesh = buildMesh(shape);
    scene.add(mesh);

    // Wireframe overlay to read topology cleanly.
    const wire = new THREE.LineSegments(
      new THREE.EdgesGeometry((mesh.children[0] as THREE.Mesh).geometry, 18),
      new THREE.LineBasicMaterial({ color: new THREE.Color(0x111111), transparent: true, opacity: 0.35 })
    );
    mesh.add(wire);

    // Ground grid.
    const grid = new THREE.GridHelper(400, 40, 0x999999, 0xdddddd);
    (grid.material as THREE.Material).opacity = 0.4;
    (grid.material as THREE.Material).transparent = true;
    scene.add(grid);

    // Lights.
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(120, 200, 120);
    key.castShadow = true;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(-120, 60, -100);
    scene.add(fill);

    // Frame to bbox.
    const bb = new THREE.Box3().setFromObject(mesh);
    const size = new THREE.Vector3();
    bb.getSize(size);
    const center = new THREE.Vector3();
    bb.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z);
    const camera = new THREE.PerspectiveCamera(35, w / h, 1, 4000);
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

    // Free-spin orbit (mouse drag rotates yaw/pitch around centroid; wheel zooms).
    let dragging = false;
    let yaw = Math.atan2(camera.position.x - center.x, camera.position.z - center.z);
    let pitch = Math.atan2(camera.position.y - center.y, Math.hypot(camera.position.x - center.x, camera.position.z - center.z));
    let radius = camera.position.distanceTo(center);
    let lastX = 0, lastY = 0;

    function place() {
      pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, pitch));
      camera.position.set(
        center.x + radius * Math.cos(pitch) * Math.sin(yaw),
        center.y + radius * Math.sin(pitch),
        center.z + radius * Math.cos(pitch) * Math.cos(yaw),
      );
      camera.lookAt(center);
    }
    function down(e: MouseEvent) { dragging = true; lastX = e.clientX; lastY = e.clientY; }
    function move(e: MouseEvent) {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      yaw -= dx * 0.005;
      pitch += dy * 0.005;
      place();
    }
    function up() { dragging = false; }
    function wheel(e: WheelEvent) { e.preventDefault(); radius *= (1 + e.deltaY * 0.0015); radius = Math.max(maxDim * 0.5, Math.min(maxDim * 6, radius)); place(); }
    renderer.domElement.addEventListener("mousedown", down);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    renderer.domElement.addEventListener("wheel", wheel, { passive: false });

    let raf: number;
    function tick() {
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    }
    tick();

    function onResize() {
      const w2 = el.clientWidth;
      camera.aspect = w2 / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w2, h);
    }
    const ro = new ResizeObserver(onResize);
    ro.observe(el);

    return () => {
      ro.disconnect();
      renderer.domElement.removeEventListener("mousedown", down);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      renderer.domElement.removeEventListener("wheel", wheel);
      cancelAnimationFrame(raf);
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [shape, height]);

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

function buildMesh(shape: ShapeDesc): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xc8c8c8, roughness: 0.55, metalness: 0.15, flatShading: false });
  const geo = buildGeometry(shape);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return g;
}

function buildGeometry(shape: ShapeDesc): THREE.BufferGeometry {
  switch (shape.type) {
    case "box": {
      return new THREE.BoxGeometry(...shape.size);
    }
    case "hollow_cylinder": {
      // Built as a single open-ended geometry by merging outer cylinder + inner cylinder + two annulus rings.
      const segs = 64;
      const outer = new THREE.CylinderGeometry(shape.outerR, shape.outerR, shape.height, segs, 1, true);
      const inner = new THREE.CylinderGeometry(shape.innerR, shape.innerR, shape.height, segs, 1, true);
      // flip inner normals
      flipNormals(inner);
      const top = ring(shape.outerR, shape.innerR, segs, shape.height / 2);
      const bot = ring(shape.outerR, shape.innerR, segs, -shape.height / 2);
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
      // Approximate visualization: solid block with bored cylindrical features rendered as additional inner walls.
      const block = new THREE.BoxGeometry(shape.size, shape.size, shape.size);
      const geos: THREE.BufferGeometry[] = [block];
      const start = -((shape.n - 1) * shape.pitch) / 2;
      for (let i = 0; i < shape.n; i++) {
        for (let j = 0; j < shape.n; j++) {
          const x = start + i * shape.pitch;
          const y = start + j * shape.pitch;
          const cyl = new THREE.CylinderGeometry(shape.holeD / 2, shape.holeD / 2, shape.size + 0.01, 24, 1, true);
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
      const hole = new THREE.CylinderGeometry(shape.holeD / 2, shape.holeD / 2, t * 1.1, 32, 1, true);
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
        const c = new THREE.CylinderGeometry(seg.d / 2, seg.d / 2, seg.l, 48);
        c.rotateZ(Math.PI / 2);
        c.translate(z + seg.l / 2, 0, 0);
        geos.push(c);
        z += seg.l;
      }
      return mergeGeoms(geos);
    }
    case "carrier_plate": {
      const geos: THREE.BufferGeometry[] = [new THREE.CylinderGeometry(shape.r, shape.r, shape.thickness, 96)];
      for (const b of shape.bores) {
        for (let i = 0; i < b.n; i++) {
          const ang = (i / b.n) * Math.PI * 2 + (b.phase ?? 0);
          const cx = (b.pcd / 2) * Math.cos(ang);
          const cy = (b.pcd / 2) * Math.sin(ang);
          const c = new THREE.CylinderGeometry(b.r, b.r, shape.thickness * 1.1, 32, 1, true);
          c.translate(cx, 0, cy);
          flipNormals(c);
          geos.push(c);
        }
      }
      return mergeGeoms(geos);
    }
    case "pin": {
      const c = new THREE.CylinderGeometry(shape.d / 2, shape.d / 2, shape.l, 48);
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
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
        const boss = new THREE.CylinderGeometry(shape.bossR, shape.bossR, shape.h - shape.wall, 24);
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
      ], 64);
      cup.translate(0, shape.stemH + shape.baseT, 0);
      const stem = new THREE.CylinderGeometry(shape.stemR, shape.stemR, shape.stemH, 32);
      stem.translate(0, shape.stemH / 2 + shape.baseT, 0);
      const base = new THREE.CylinderGeometry(shape.baseR, shape.baseR, shape.baseT, 48);
      base.translate(0, shape.baseT / 2, 0);
      return mergeGeoms([cup, stem, base]);
    }
    case "flange": {
      const hub = new THREE.CylinderGeometry(shape.hubR, shape.hubR, shape.hubH, 64);
      const plate = new THREE.CylinderGeometry(shape.plateR, shape.plateR, shape.plateT, 96);
      plate.translate(0, -shape.hubH / 2 + shape.plateT / 2, 0);
      const geos: THREE.BufferGeometry[] = [hub, plate];
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        const x = (shape.pcd / 2) * Math.cos(ang);
        const z = (shape.pcd / 2) * Math.sin(ang);
        const bolt = new THREE.CylinderGeometry(shape.boltR, shape.boltR, shape.plateT * 1.1, 24, 1, true);
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
      const a = buildGeometry(shape.a);
      const b = buildGeometry(shape.b);
      if (shape.offsetA) a.translate(...shape.offsetA);
      if (shape.offsetB) b.translate(...shape.offsetB);
      return mergeGeoms([a, b]);
    }
  }
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
