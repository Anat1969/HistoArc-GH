import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { Building, Model } from '../engine/types';
import { CODE, LYNCH } from '../engine/codes';

const FLOOR = 3.3;
const HEX: Record<string, string> = {
  'var(--cosmic)': '#a8740f',
  'var(--machine)': '#2f5a86',
  'var(--organic)': '#a24a2a',
  'var(--algo)': '#5b6670',
};

/** Merge prisms (convex footprints extruded to floors × 3.3 m) into one geometry. */
function prisms(bs: Building[], base = 0.4): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const push = (a: number[], b: number[], c: number[], n: number[]) => {
    pos.push(...a, ...b, ...c);
    nor.push(...n, ...n, ...n);
  };
  for (const b of bs) {
    const z0 = b.z0 ?? base;
    const h = z0 + (b.h ?? b.floors * FLOOR);
    const p = b.poly;
    const ccw = p.reduce((s, q, i) => s + q[0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * q[1], 0) > 0;
    const P = ccw ? p : [...p].reverse();
    // plan (x, y) -> world (x, z = -y)
    for (let i = 1; i < P.length - 1; i++) {
      push([P[0][0], h, -P[0][1]], [P[i][0], h, -P[i][1]], [P[i + 1][0], h, -P[i + 1][1]], [0, 1, 0]);
    }
    for (let i = 0; i < P.length; i++) {
      const a = P[i];
      const c = P[(i + 1) % P.length];
      const dx = c[0] - a[0];
      const dy = c[1] - a[1];
      const L = Math.hypot(dx, dy) || 1;
      const n = [dy / L, 0, dx / L];
      const A0 = [a[0], z0, -a[1]];
      const C0 = [c[0], z0, -c[1]];
      const A1 = [a[0], h, -a[1]];
      const C1 = [c[0], h, -c[1]];
      push(A0, C0, C1, n);
      push(A0, C1, A1, n);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.computeBoundingSphere();
  return g;
}

function plates(model: Model): THREE.BufferGeometry {
  const pos: number[] = [];
  for (const l of model.lots) {
    if (l.kind === 'green') continue;
    const P = l.poly;
    for (let i = 1; i < P.length - 1; i++) pos.push(P[0][0], 0.2, -P[0][1], P[i][0], 0.2, -P[i][1], P[i + 1][0], 0.2, -P[i + 1][1]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

function greens(model: Model): THREE.BufferGeometry {
  const pos: number[] = [];
  for (const l of model.lots) {
    if (l.kind !== 'green') continue;
    const P = l.poly;
    for (let i = 1; i < P.length - 1; i++) pos.push(P[0][0], 0.2, -P[0][1], P[i][0], 0.2, -P[i][1], P[i + 1][0], 0.2, -P[i + 1][1]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

function axisLines(model: Model): THREE.BufferGeometry {
  const pos: number[] = [];
  for (const s of model.streets) if (s.kind === 'axis') pos.push(s.a[0], 0.6, -s.a[1], s.b[0], 0.6, -s.b[1]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

function Scene({ model, rise }: { model: Model; rise: number }) {
  const group = useRef<THREE.Group>(null);
  const t0 = useRef(performance.now());
  const reduce = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const codeColor = HEX[LYNCH[CODE[model.code].lynch].color];
  const geo = useMemo(() => {
    const of = (...k: string[]) => model.buildings.filter((b) => k.includes(b.kind));
    const fabric = prisms(of('fabric'));
    const special = prisms(of('monument', 'wall'));
    const slab = prisms(of('slab'));
    const glass = prisms(of('glass'));
    const column = prisms(of('column'));
    return { fabric, special, slab, glass, column, plates: plates(model), greens: greens(model), axes: axisLines(model) };
  }, [model]);
  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose());
    },
    [geo],
  );
  useEffect(() => {
    t0.current = performance.now();
  }, [rise]);
  useFrame(() => {
    if (!group.current) return;
    const t = reduce ? 1 : Math.min(1, (performance.now() - t0.current) / 900);
    const e = 1 - (1 - t) ** 3;
    group.current.scale.y = Math.max(0.001, e);
  });
  const R = model.site * 0.75;
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[R * 4, R * 4]} />
        <meshStandardMaterial color="#fbfbf9" />
      </mesh>
      <mesh geometry={geo.plates} receiveShadow>
        <meshStandardMaterial color="#e9e8e2" side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geo.greens} receiveShadow>
        <meshStandardMaterial color="#dfe8d8" side={THREE.DoubleSide} />
      </mesh>
      <lineSegments geometry={geo.axes}>
        <lineBasicMaterial color={codeColor} />
      </lineSegments>
      <group ref={group}>
        <mesh geometry={geo.fabric} castShadow receiveShadow>
          <meshStandardMaterial color="#ffffff" roughness={0.92} side={THREE.DoubleSide} />
        </mesh>
        <mesh geometry={geo.special} castShadow receiveShadow>
          <meshStandardMaterial color={codeColor} roughness={0.8} side={THREE.DoubleSide} />
        </mesh>
        <mesh geometry={geo.slab} castShadow receiveShadow>
          <meshStandardMaterial color="#d9d8d2" roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
        <mesh geometry={geo.column} castShadow>
          <meshStandardMaterial color="#3a3a3a" roughness={0.7} />
        </mesh>
        <mesh geometry={geo.glass}>
          <meshStandardMaterial color="#9fb3c2" roughness={0.15} metalness={0.1} transparent opacity={0.45} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </>
  );
}

function Rig({ site, small }: { site: number; small: boolean }) {
  const { camera } = useThree();
  useEffect(() => {
    const d = small ? Math.max(40, site * 1.5) : Math.max(600, site * 1.55);
    camera.position.set(-d * 0.55, d * 0.7, d * 0.75);
    camera.near = small ? 0.3 : 1;
    camera.far = d * 12;
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [site, small, camera]);
  return null;
}

export default function City3D({ model, rise = 0 }: { model: Model | null; rise?: number }) {
  const site = model?.site ?? 700;
  const small = model?.scale === 'building';
  const sh = small ? Math.max(40, site) : Math.max(500, site * 0.8);
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ fov: 32 }} gl={{ antialias: true, preserveDrawingBuffer: true }} style={{ position: 'absolute', inset: 0 }}>
      <color attach="background" args={['#fbfbf9']} />
      <hemisphereLight args={['#ffffff', '#d8d6cf', 0.9]} />
      <directionalLight
        position={[-sh * 0.6, sh * 1.2, sh * 0.4]}
        intensity={1.9}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-sh}
        shadow-camera-right={sh}
        shadow-camera-top={sh}
        shadow-camera-bottom={-sh}
        shadow-camera-far={sh * 4}
        shadow-bias={-0.0004}
      />
      <Rig site={site} small={small} />
      {model && <Scene model={model} rise={rise} />}
      <OrbitControls makeDefault enableDamping target={[0, small ? site * 0.2 : 0, 0]} maxPolarAngle={Math.PI / 2.1} minDistance={small ? 8 : 60} maxDistance={site * 4} />
    </Canvas>
  );
}
