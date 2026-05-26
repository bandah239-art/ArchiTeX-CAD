import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface Column {
  id: string;
  start: number;
  end: number;
  width: number;
  depth: number;
}

interface Beam {
  id: string;
  start: number;
  end: number;
  width: number;
  depth: number;
}

interface Slab {
  id: string;
  level: number;
  width: number;
  length: number;
  thickness: number;
}

interface Node {
  id: number;
  x: number;
  y: number;
  z: number;
}

interface Wall {
  id: string;
  start: number;
  end: number;
  span_node: number;
  material: string;
}

interface WindowObj {
  id: string;
  start: number;
  end: number;
  span_node: number;
}

interface Roof {
  id: string;
  type: string;
  level: number;
  width: number;
  length: number;
  ridge_height: number;
}

export interface BIMModel {
  nodes: Node[];
  columns: Column[];
  beams: Beam[];
  slabs: Slab[];
  walls?: Wall[];
  windows?: WindowObj[];
  roofs?: Roof[];
}

type ResolvedModel = ReturnType<typeof resolveBimMeshes>;

function resolveBimMeshes(model: BIMModel) {
  const nodeMap = new Map(model.nodes.map((n) => [n.id, n]));

  const columns = model.columns
    .map((c) => {
      const n1 = nodeMap.get(c.start);
      const n2 = nodeMap.get(c.end);
      if (!n1 || !n2) return null;
      const height = n2.y - n1.y;
      return { ...c, x: n1.x, y: n1.y + height / 2, z: n1.z, height };
    })
    .filter(Boolean);

  const beams = model.beams
    .map((b) => {
      const n1 = nodeMap.get(b.start);
      const n2 = nodeMap.get(b.end);
      if (!n1 || !n2) return null;
      const length = Math.hypot(n2.x - n1.x, n2.z - n1.z);
      const cx = (n1.x + n2.x) / 2;
      const cy = n1.y - b.depth / 2;
      const cz = (n1.z + n2.z) / 2;
      const angle = Math.atan2(n2.z - n1.z, n2.x - n1.x);
      return { ...b, cx, cy, cz, length, angle };
    })
    .filter(Boolean);

  const slabs = model.slabs.map((s) => ({
    ...s,
    cx: s.width / 2,
    cy: s.level,
    cz: s.length / 2,
  }));

  const walls = (model.walls ?? [])
    .map((w) => {
      const start = nodeMap.get(w.start);
      const end = nodeMap.get(w.end);
      const span = nodeMap.get(w.span_node);
      if (!start || !end || !span) return null;
      const height = end.y - start.y;
      const length = Math.hypot(span.x - end.x, span.z - end.z);
      const cx = (end.x + span.x) / 2;
      const cy = (start.y + end.y) / 2;
      const cz = (end.z + span.z) / 2;
      const angle = Math.atan2(span.z - end.z, span.x - end.x);
      return { ...w, cx, cy, cz, length, height, angle, thickness: 0.2 };
    })
    .filter(Boolean);

  const windows = (model.windows ?? [])
    .map((w) => {
      const start = nodeMap.get(w.start);
      const end = nodeMap.get(w.end);
      const span = nodeMap.get(w.span_node);
      if (!start || !end || !span) return null;
      const height = (end.y - start.y) * 0.5;
      const length = Math.hypot(span.x - end.x, span.z - end.z) * 0.6;
      const cx = (end.x + span.x) / 2;
      const cy = (start.y + end.y) / 2;
      const cz = (end.z + span.z) / 2;
      const angle = Math.atan2(span.z - end.z, span.x - end.x);
      return { ...w, cx, cy, cz, length, height, angle, thickness: 0.25 };
    })
    .filter(Boolean);

  const roofs = (model.roofs ?? []).map((r) => ({
    ...r,
    cx: r.width / 2,
    cy: r.level,
    cz: r.length / 2,
  }));

  const offset = model.slabs[0]
    ? new THREE.Vector3(-model.slabs[0].width / 2, 0, -model.slabs[0].length / 2)
    : new THREE.Vector3(0, 0, 0);

  return { columns, beams, slabs, walls, windows, roofs, offset };
}

function addBox(
  group: THREE.Group,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  rotY: number,
  color: number,
  opts?: { opacity?: number; metalness?: number; roughness?: number },
) {
  const geom = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({
    color,
    transparent: opts?.opacity !== undefined && opts.opacity < 1,
    opacity: opts?.opacity ?? 1,
    metalness: opts?.metalness ?? 0.1,
    roughness: opts?.roughness ?? 0.7,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  group.add(mesh);
}

function buildSceneGroup(resolved: ResolvedModel): THREE.Group {
  const root = new THREE.Group();
  root.position.copy(resolved.offset);

  for (const col of resolved.columns) {
    if (!col) continue;
    addBox(root, col.width, col.height, col.depth, col.x, col.y, col.z, 0, 0x64748b);
  }

  for (const beam of resolved.beams) {
    if (!beam) continue;
    addBox(root, beam.length, beam.depth, beam.width, beam.cx, beam.cy, beam.cz, -beam.angle, 0x475569);
  }

  for (const slab of resolved.slabs) {
    addBox(
      root,
      slab.width,
      slab.thickness,
      slab.length,
      slab.cx,
      slab.cy - slab.thickness / 2,
      slab.cz,
      0,
      0x334155,
      { opacity: 0.6 },
    );
  }

  for (const wall of resolved.walls) {
    if (!wall) continue;
    addBox(
      root,
      wall.length,
      wall.height,
      wall.thickness,
      wall.cx,
      wall.cy,
      wall.cz,
      -wall.angle,
      wall.material === 'brick' ? 0x7f1d1d : 0xf8fafc,
    );
  }

  for (const win of resolved.windows) {
    if (!win) continue;
    addBox(
      root,
      win.length,
      win.height,
      win.thickness,
      win.cx,
      win.cy,
      win.cz,
      -win.angle,
      0x38bdf8,
      { opacity: 0.5, metalness: 0.8, roughness: 0.1 },
    );
  }

  for (const roof of resolved.roofs) {
    if (roof.type !== 'pitched') continue;
    const roofLength = Math.hypot(roof.length / 2, roof.ridge_height);
    const pitch = Math.atan2(roof.ridge_height, roof.length / 2);
    const roofGroup = new THREE.Group();
    roofGroup.position.set(roof.cx, roof.cy, roof.cz);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });

    const frontPitch = new THREE.Mesh(new THREE.BoxGeometry(roof.width + 1, 0.2, roofLength), roofMat);
    frontPitch.position.set(0, roof.ridge_height / 2, -roof.length / 4);
    frontPitch.rotation.x = pitch;
    roofGroup.add(frontPitch);

    const backPitch = new THREE.Mesh(new THREE.BoxGeometry(roof.width + 1, 0.2, roofLength), roofMat);
    backPitch.position.set(0, roof.ridge_height / 2, roof.length / 4);
    backPitch.rotation.x = -pitch;
    roofGroup.add(backPitch);

    const gableMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, side: THREE.DoubleSide });
    const gableR = new THREE.Mesh(new THREE.PlaneGeometry(roof.length, roof.ridge_height), gableMat);
    gableR.position.set(roof.width / 2, roof.ridge_height / 2, 0);
    gableR.rotation.y = Math.PI / 2;
    roofGroup.add(gableR);
    const gableL = gableR.clone();
    gableL.position.x = -roof.width / 2;
    gableL.rotation.y = -Math.PI / 2;
    roofGroup.add(gableL);

    root.add(roofGroup);
  }

  return root;
}

export function BIMCanvas({ model }: { model: BIMModel | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const resolved = useMemo(() => (model ? resolveBimMeshes(model) : null), [model]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !resolved) return;

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 300;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    camera.position.set(30, 20, 30);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(10, 20, 10);
    scene.add(sun);

    const grid = new THREE.GridHelper(200, 40, 0x1e293b, 0x0f172a);
    scene.add(grid);

    const building = buildSceneGroup(resolved);
    scene.add(building);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(
      resolved.slabs[0]?.width ? resolved.slabs[0].width / 2 + resolved.offset.x : 0,
      5,
      resolved.slabs[0]?.length ? resolved.slabs[0].length / 2 + resolved.offset.z : 0,
    );
    controls.update();

    let frameId = 0;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = container.clientWidth || width;
      const h = container.clientHeight || height;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onResize);
      controls.dispose();
      renderer.dispose();
      building.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => m.dispose());
        }
      });
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [resolved]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-infra-darker relative rounded overflow-hidden border border-infra-accent/30"
    />
  );
}
