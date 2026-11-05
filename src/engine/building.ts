/**
 * Building-scale generator. Same contract as the city generator: (code, θ) → model → measured θ → error.
 * The five indicators, read at the scale of one building (spec section 4.2):
 *   O  symmetry and modularity: 0.6 × mirror symmetry of the plan (rescaled: 0.5 overlap → 0) + 0.4 × share of bays on the module
 *   I  volume to footprint: Σ floor area / footprint
 *   E  solid to void: solid share of the exterior wall length
 *   H  dominance of one space: 1 − median room area / largest room area
 *   G  module: median exterior bay width (m)
 * R  "the wall carries the building": 1 when no free-standing structural columns exist.
 * T  dominant central hall · massive core · free-standing structural column.
 */
import type { Building, CodeId, Knobs, Lot, Measured, Model, Poly, Theta } from './types';
import { CODE } from './codes';
import { area, centroid } from './geom';
import { hs } from './rng';
import { meanError, paramErrors } from './measure';

type V = [number, number];
const STOREY = 3.6;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

interface Room {
  poly: Poly;
  core?: boolean;
}
interface Out {
  els: Building[];
  rooms: Room[]; // main-floor spaces
  floorArea: number;
  footprint: Poly[]; // main-floor footprint pieces (for symmetry and footprint area)
  ext: { len: number; solid: boolean }[];
  bays: number[];
}

const rect = (x0: number, y0: number, x1: number, y1: number): Poly => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

function el(poly: Poly, kind: Building['kind'], z0: number, h: number): Building {
  return { poly, kind, floors: Math.max(1, Math.round(h / STOREY)), w: 0, z0, h };
}

/** a straight wall from a to b, thickness t, split into bays of about g metres with an opening share (1 − E) */
function facade(o: Out, a: V, b: V, t: number, g: number, E: number, z0: number, h: number, kind: Building['kind'] = 'fabric') {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (L < 0.3) return;
  const ux = (b[0] - a[0]) / L;
  const uy = (b[1] - a[1]) / L;
  const nx = -uy * (t / 2);
  const ny = ux * (t / 2);
  const n = Math.max(1, Math.round(L / g));
  const bay = L / n;
  const seg = (s0: number, s1: number, k: Building['kind']) => {
    if (s1 - s0 < 0.05) return;
    const p0: V = [a[0] + ux * s0, a[1] + uy * s0];
    const p1: V = [a[0] + ux * s1, a[1] + uy * s1];
    o.els.push(el([[p0[0] - nx, p0[1] - ny], [p1[0] - nx, p1[1] - ny], [p1[0] + nx, p1[1] + ny], [p0[0] + nx, p0[1] + ny]], k, z0, h));
  };
  const open = clamp(1 - E, 0, 0.95) * bay;
  for (let i = 0; i < n; i++) {
    const s = i * bay;
    const pier = (bay - open) / 2;
    seg(s, s + pier, kind);
    seg(s + pier, s + pier + open, 'glass');
    seg(s + pier + open, s + bay, kind);
    o.ext.push({ len: bay - open, solid: true }, { len: open, solid: false });
    o.bays.push(bay);
  }
}

function partition(o: Out, a: V, b: V, z0: number, h: number, kind: Building['kind'] = 'fabric') {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (L < 0.3) return;
  const t = 0.25;
  const nx = (-(b[1] - a[1]) / L) * (t / 2);
  const ny = ((b[0] - a[0]) / L) * (t / 2);
  o.els.push(el([[a[0] - nx, a[1] - ny], [b[0] - nx, b[1] - ny], [b[0] + nx, b[1] + ny], [a[0] + nx, a[1] + ny]], kind, z0, h));
}

/** walls around a set of axis-aligned rectangles: exterior edges get the facade, shared edges a partition */
function wallsAround(o: Out, rects: { r: [number, number, number, number]; hall?: boolean }[], g: number, E: number, z0: number, h: number) {
  const edges: { a: V; b: V; hall: boolean }[] = [];
  for (const { r, hall } of rects) {
    const [x0, y0, x1, y1] = r;
    edges.push({ a: [x0, y0], b: [x1, y0], hall: !!hall }, { a: [x1, y0], b: [x1, y1], hall: !!hall }, { a: [x1, y1], b: [x0, y1], hall: !!hall }, { a: [x0, y1], b: [x0, y0], hall: !!hall });
  }
  const covered = (p: V) => rects.some(({ r }) => p[0] > r[0] + 0.01 && p[0] < r[2] - 0.01 && p[1] > r[1] + 0.01 && p[1] < r[3] - 0.01);
  const seen = new Set<string>();
  for (const e of edges) {
    const mid: V = [(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2];
    const dx = e.b[0] - e.a[0];
    const dy = e.b[1] - e.a[1];
    const L = Math.hypot(dx, dy);
    const out: V = [mid[0] + (dy / L) * 0.3, mid[1] - (dx / L) * 0.3];
    const inn: V = [mid[0] - (dy / L) * 0.3, mid[1] + (dx / L) * 0.3];
    const shared = covered(out) && covered(inn);
    const key = [Math.round(Math.min(e.a[0], e.b[0]) * 10), Math.round(Math.min(e.a[1], e.b[1]) * 10), Math.round(Math.max(e.a[0], e.b[0]) * 10), Math.round(Math.max(e.a[1], e.b[1]) * 10)].join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    const kind = e.hall ? 'monument' : 'fabric';
    if (shared) partition(o, e.a, e.b, z0, h, kind);
    else facade(o, e.a, e.b, 0.5, g, E, z0, h, kind);
  }
}

const blank = (): Out => ({ els: [], rooms: [], floorArea: 0, footprint: [], ext: [], bays: [] });

function palladian(th: Theta, a: number, k: number): Out {
  const o = blank();
  const g = th.G;
  const c = (1 + 2.6 * k) * g; // the hall
  const cols = [g, g, c, g * (1 + 0.7 * a), g * (1 + 1.2 * a)]; // asymmetry stretches one wing
  const rows = [g, c, g];
  const W = cols.reduce((s, x) => s + x, 0);
  const D = rows.reduce((s, x) => s + x, 0);
  const xs = [-W / 2];
  for (const w of cols) xs.push(xs[xs.length - 1] + w);
  const ys = [-D / 2];
  for (const d of rows) ys.push(ys[ys.length - 1] + d);
  const floors = clamp(Math.round(th.I), 1, 3);
  const rects: { r: [number, number, number, number]; hall?: boolean }[] = [];
  for (let i = 0; i < 5; i++)
    for (let j = 0; j < 3; j++) {
      const hall = i === 2 && j === 1;
      rects.push({ r: [xs[i], ys[j], xs[i + 1], ys[j + 1]], hall });
      o.rooms.push({ poly: rect(xs[i], ys[j], xs[i + 1], ys[j + 1]) });
    }
  for (let f = 0; f < floors; f++) wallsAround(o, rects, g, th.E, f * STOREY, STOREY);
  // dome over the hall when it dominates (T: central hall)
  if (k > 0.35) {
    const r = c / 2;
    const ring: Poly = [];
    for (let q = 0; q < 16; q++) ring.push([Math.cos((q / 16) * 2 * Math.PI) * r, Math.sin((q / 16) * 2 * Math.PI) * r]);
    o.els.push(el(ring, 'monument', floors * STOREY, 2 + 4 * k));
  }
  // porticos: free columns of the order, part of the masonry (not structure of the plan)
  const nPort = k > 0.7 ? 4 : 2;
  const sides: [V, V, V][] = [
    [[xs[2], ys[0]], [xs[3], ys[0]], [0, -1]],
    [[xs[2], ys[3]], [xs[3], ys[3]], [0, 1]],
    [[xs[0], ys[1]], [xs[0], ys[2]], [-1, 0]],
    [[xs[5], ys[1]], [xs[5], ys[2]], [1, 0]],
  ];
  for (let s = 0; s < nPort; s++) {
    const [p, q, n] = sides[s];
    for (let m = 0; m < 6; m++) {
      const t = m / 5;
      const cx = p[0] + (q[0] - p[0]) * t + n[0] * g * 0.9;
      const cy = p[1] + (q[1] - p[1]) * t + n[1] * g * 0.9;
      o.els.push(el(rect(cx - 0.35, cy - 0.35, cx + 0.35, cy + 0.35), 'fabric', 0, floors * STOREY * 0.8));
    }
  }
  o.footprint = [rect(xs[0], ys[0], xs[5], ys[3])];
  o.floorArea = floors * W * D;
  return o;
}

function prairie(th: Theta, a: number, k: number): Out {
  const o = blank();
  const g = th.G;
  const hw = 2 * g; // half width of the arms
  const core = Math.max(2.4, 0.9 * g + 0.6 * g * k); // the chimney mass
  const L = 6 * g;
  const arms = { E: L * (1 + 1.6 * k), W: L * (1 - 0.15 * a) + 0.37 * g * a, N: L * 0.6, S: L * 0.6 };
  const sh = 5.5 * g * a; // arms slide off the axis: the cross loses its symmetry, not its rooms
  const rects: { r: [number, number, number, number] }[] = [
    { r: [-hw, -hw, hw, hw] },
    { r: [hw, -hw + sh * 0.5, hw + arms.E, hw + sh * 0.5] },
    { r: [-hw - arms.W, -hw, -hw, hw] },
    { r: [-hw + sh, hw, hw + sh, hw + arms.N] },
    { r: [-hw - sh * 0.7, -hw - arms.S, hw - sh * 0.7, -hw] },
  ];
  for (const r of rects) o.rooms.push({ poly: rect(...r.r) });
  o.rooms.push({ poly: rect(-core / 2, -core / 2, core / 2, core / 2), core: true });
  wallsAround(o, rects, g, th.E, 0, STOREY);
  const fpA = rects.reduce((s, { r }) => s + (r[2] - r[0]) * (r[3] - r[1]), 0);
  // upper storey over the centre, sized to reach I
  const up = clamp(th.I - 1, 0, 1) * fpA;
  let upArea = 0;
  if (up > 4) {
    const ux = Math.min(hw + arms.E, Math.sqrt(up * 2) / 2 + hw / 2);
    const uy = Math.min(hw, up / (2 * ux) / 1);
    const r2: { r: [number, number, number, number] }[] = [{ r: [-ux * 0.6, -uy, ux, uy] }];
    wallsAround(o, r2, g, th.E, STOREY, STOREY);
    upArea = (r2[0].r[2] - r2[0].r[0]) * (r2[0].r[3] - r2[0].r[1]);
    o.els.push(el(rect(-ux * 0.6 - 1.4 * g, -uy - 1.4 * g, ux + 1.4 * g, uy + 1.4 * g), 'slab', 2 * STOREY, 0.3));
  }
  // overhanging roofs: the box breaks open (T)
  for (const { r } of rects) o.els.push(el(rect(r[0] - 1.4 * g, r[1] - 1.4 * g, r[2] + 1.4 * g, r[3] + 1.4 * g), 'slab', STOREY, 0.3));
  o.els.push(el(rect(-core / 2, -core / 2, core / 2, core / 2), 'monument', 0, STOREY * (up > 4 ? 2 : 1) + 1.8));
  o.footprint = rects.map(({ r }) => rect(...r));
  o.floorArea = fpA + upArea;
  return o;
}

function frame(th: Theta, a: number, k: number): Out {
  const o = blank();
  const g = th.G;
  const nx = 5;
  const ny = 3;
  const W = nx * g;
  const D = ny * g;
  const floors = clamp(Math.round(th.I), 1, 8);
  // free plan: zones separated by non-structural partitions; k makes one zone dominate
  // free plan: three zones; k lets one dominate, a slides the partitions off the axis
  const w3 = W * (1 / 3 + 0.45 * k);
  const w1 = ((W - w3) / 2) * (1 + 0.25 * a);
  const zx = [-W / 2, -W / 2 + w1, -W / 2 + w1 + (W - w3 - w1), W / 2];
  for (let i = 0; i < 3; i++) o.rooms.push({ poly: rect(zx[i], -D / 2, zx[i + 1], D / 2) });
  const coreX = g * (1.5 * a);
  o.rooms.push({ poly: rect(coreX - g * 0.45, -g * 0.45, coreX + g * 0.45, g * 0.45), core: true });
  // a cantilevered wing on one side breaks the symmetry
  const wing = 1.8 * g * a;
  const e = 0.6;
  const plates: { r: [number, number, number, number] }[] = [{ r: [-W / 2 - e, -D / 2 - e, W / 2 + e, D / 2 + e] }];
  if (wing > 0.3) plates.push({ r: [W / 2 + e, -D / 2 - e, W / 2 + e + wing, e] });
  for (let f = 0; f < floors; f++) {
    const z = f * STOREY;
    for (const p of plates) o.els.push(el(rect(...p.r), 'slab', z + STOREY - 0.3, 0.3));
    for (let i = 0; i <= nx; i++)
      for (let j = 0; j <= ny; j++) {
        const x = -W / 2 + i * g;
        const y = -D / 2 + j * g;
        o.els.push(el(rect(x - 0.2, y - 0.2, x + 0.2, y + 0.2), 'column', z, STOREY - 0.3));
      }
    // the free façade: a curtain 0.6 m outside the column line (R: the wall no longer carries)
    wallsAround(o, plates, g, th.E, z, STOREY - 0.3);
    if (wing > 0.3)
      for (let j = 0; j <= 1; j++) {
        const x = W / 2 + wing - 0.2;
        const y = -D / 2 + j * (D / 2);
        o.els.push(el(rect(x - 0.2, y - 0.2, x + 0.2, y + 0.2), 'column', z, STOREY - 0.3));
      }
    for (let i = 1; i < 3; i++) partition(o, [zx[i], -D / 2 + 0.8], [zx[i], D / 2 - 0.8], z, STOREY - 0.3);
  }
  o.els.push(el(rect(coreX - g * 0.45, -g * 0.45, coreX + g * 0.45, g * 0.45), 'monument', 0, floors * STOREY + 1.5));
  o.footprint = plates.map((p) => rect(...p.r));
  o.floorArea = floors * plates.reduce((s2, p) => s2 + (p.r[2] - p.r[0]) * (p.r[3] - p.r[1]), 0);
  return o;
}

function capsule(th: Theta, a: number, k: number): Out {
  const o = blank();
  const g = th.G; // capsule width
  const cw = g;
  const cl = 1.6 * g;
  const core = (1.6 + 2.2 * k) * g;
  const perFloor = 8 * cw * cl + 2 * core * core * 0.5;
  const fpGuess = 8 * cw * cl + 2 * core * core;
  const floors = clamp(Math.round(th.I / (perFloor / fpGuess)), 3, 24);
  const cores: V[] = [
    [-core * 0.75, 0],
    [core * 0.75, cl * 0.3],
  ];
  for (const [cx, cy] of cores) {
    o.els.push(el(rect(cx - core / 2, cy - core / 2, cx + core / 2, cy + core / 2), 'monument', 0, floors * cw + 4));
    o.rooms.push({ poly: rect(cx - core / 2, cy - core / 2, cx + core / 2, cy + core / 2), core: true });
  }
  const fps: Poly[] = [];
  let fa = 0;
  for (let f = 0; f < floors; f++) {
    const z = f * cw;
    cores.forEach(([cx, cy], ci) => {
      for (let s = 0; s < 4; s++) {
        if (hs(f, s + ci * 4, 31) < -0.6 + 0.8 * (1 - a)) {
          // occasional gaps break the symmetry
        }
        const flip = hs(f * 7 + s, ci, 41) * a > 0.25;
        const off = (core / 2 + cl / 2) * (flip ? 1.0 : 1.0);
        const dir: V = [[1, 0], [0, 1], [-1, 0], [0, -1]][s] as V;
        const tan: V = [-dir[1], dir[0]];
        const shift = hs(f, s + 9 * ci, 51) * a * core * 0.35;
        const mx = cx + dir[0] * off + tan[0] * shift;
        const my = cy + dir[1] * off + tan[1] * shift;
        const hx = Math.abs(dir[0]) ? cl / 2 : cw / 2;
        const hy = Math.abs(dir[0]) ? cw / 2 : cl / 2;
        const p = rect(mx - hx, my - hy, mx + hx, my + hy);
        o.els.push(el(p, 'fabric', z, cw - 0.15));
        // one round window per capsule on its outer face
        const ww = cw * clamp(1 - th.E, 0.05, 0.9);
        const wx = mx + dir[0] * (Math.abs(dir[0]) ? cl / 2 : 0);
        const wy = my + dir[1] * (Math.abs(dir[1]) ? cl / 2 : 0);
        const gx = Math.abs(dir[0]) ? 0.12 : ww / 2;
        const gy = Math.abs(dir[0]) ? ww / 2 : 0.12;
        o.els.push(el(rect(wx - gx, wy - gy, wx + gx, wy + gy), 'glass', z + (cw - ww) / 2, ww));
        o.ext.push({ len: cw - ww, solid: true }, { len: ww, solid: false });
        o.bays.push(cw);
        if (f === 0) {
          o.rooms.push({ poly: p });
          fps.push(p);
        }
        fa += cw * cl;
      }
    });
  }
  for (const [cx, cy] of cores) fps.push(rect(cx - core / 2, cy - core / 2, cx + core / 2, cy + core / 2));
  o.footprint = fps;
  o.floorArea = fa + floors * cores.length * core * core * 0.5;
  return o;
}

function continuous(th: Theta, a: number, k: number): Out {
  const o = blank();
  const g = th.G;
  const R = 26;
  let N = 64;
  const blob = (s: number): Poly => {
    const p: Poly = [];
    for (let q = 0; q < N; q++) {
      const t = (q / N) * 2 * Math.PI;
      const lobe = Math.exp(-((((t - 1.1 + Math.PI) % (2 * Math.PI)) - Math.PI) ** 2) / 0.35);
      const r = R * s * (1 + 0.5 * Math.sin(2 * t + 0.4) * a + 0.3 * Math.cos(t - 0.9) * a + 1.8 * lobe * a + 0.06 * Math.sin(4 * t) * (1 - a));
      p.push([Math.cos(t) * r * 1.35 + R * 0.35 * a * s * Math.sin(t), Math.sin(t) * r]);
    }
    return p;
  };
  // panels of about g metres along the actual perimeter
  const per0 = blob(1).reduce((acc, p, i, arr) => acc + Math.hypot(arr[(i + 1) % arr.length][0] - p[0], arr[(i + 1) % arr.length][1] - p[1]), 0);
  N = Math.max(24, Math.round(per0 / g));
  {
    // curved panels vary in length: correct N so the median panel equals the module
    const b1 = blob(1);
    const lens = b1.map((p, i) => Math.hypot(b1[(i + 1) % N][0] - p[0], b1[(i + 1) % N][1] - p[1])).sort((x, y) => x - y);
    N = Math.max(24, Math.round((N * lens[Math.floor(N / 2)]) / g));
  }
  const rings = 6;
  const floors = clamp(Math.round(th.I / 0.7), 1, 5);
  for (let i = 0; i < rings; i++) {
    const s = 1 - i / rings;
    const h = (floors * STOREY + R * 0.9) * Math.sin(((i + 1) / rings) * (Math.PI / 2)) * (0.6 + 0.4 * k);
    o.els.push(el(blob(s), i === 0 ? 'fabric' : 'fabric', 0, Math.max(2, h)));
  }
  // glazed fold at the foot of the shell
  const outer = blob(1.01);
  for (let q = 0; q < N; q++) {
    const A = outer[q];
    const B = outer[(q + 1) % N];
    const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const open = hs(q, 3, 61) * 0.5 + 0.5 < 1 - th.E;
    if (open) o.els.push(el([A, B, [B[0] * 0.995, B[1] * 0.995], [A[0] * 0.995, A[1] * 0.995]], 'glass', 0, STOREY * 1.5));
    o.ext.push({ len: L, solid: !open });
    o.bays.push(L);
  }
  // interior zones: one great hall and smaller rooms; k enlarges the hall
  const hall = blob(0.13 + 0.3 * k);
  o.rooms.push({ poly: hall });
  for (let z = 0; z < 4; z++) {
    const cx = Math.cos(z * 1.6) * R * 0.75;
    const cy = Math.sin(z * 1.6) * R * 0.55;
    o.rooms.push({ poly: rect(cx - 4, cy - 3, cx + 4, cy + 3) });
  }
  o.footprint = [blob(1)];
  o.floorArea = floors * Math.abs(area(blob(1))) * 0.7;
  return o;
}

const GEN: Partial<Record<CodeId, (th: Theta, a: number, k: number) => Out>> = { palladian, prairie, frame, capsule, continuous };

/** mirror symmetry of the footprint: best IoU over the x and y axes through its centroid, on a 0.5 m raster */
export function symmetry(fp: Poly[]): number {
  const pts = fp.flat();
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const step = Math.max(0.5, Math.max(x1 - x0, y1 - y0) / 120);
  const inside = (x: number, y: number) =>
    fp.some((p) => {
      let c = false;
      for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
        if (p[i][1] > y !== p[j][1] > y && x < ((p[j][0] - p[i][0]) * (y - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) c = !c;
      }
      return c;
    });
  const cells: [number, number][] = [];
  for (let x = x0 + step / 2; x < x1; x += step) for (let y = y0 + step / 2; y < y1; y += step) if (inside(x, y)) cells.push([x, y]);
  if (!cells.length) return 0;
  const cx = cells.reduce((s, c) => s + c[0], 0) / cells.length;
  const cy = cells.reduce((s, c) => s + c[1], 0) / cells.length;
  const score = (mx: boolean) => cells.filter(([x, y]) => inside(mx ? 2 * cx - x : x, mx ? y : 2 * cy - y)).length / cells.length;
  // any compact shape overlaps its mirror by about half: rescale so 0.5 → 0 and 1 → 1 [ה]
  return clamp((Math.max(score(true), score(false)) - 0.5) / 0.5, 0, 1);
}

function measureB(o: Out, codeId: CodeId): Measured {
  const fpArea = o.footprint.reduce((s, p) => s + Math.abs(area(p)), 0);
  const I = o.floorArea / Math.max(fpArea, 1);
  const tot = o.ext.reduce((s, e) => s + e.len, 0);
  const E = tot ? o.ext.filter((e) => e.solid).reduce((s, e) => s + e.len, 0) / tot : 1;
  const sortedBays = [...o.bays].sort((x, y) => x - y);
  const G = sortedBays.length ? sortedBays[Math.floor(sortedBays.length / 2)] : 1;
  const spaces = o.rooms.map((r) => Math.abs(area(r.poly))).filter((x) => x > 0.5);
  const sorted = [...spaces].sort((x, y) => x - y);
  const Amax = sorted[sorted.length - 1] ?? 1;
  const Amed = sorted[Math.floor(sorted.length / 2)] ?? 1;
  const H = spaces.length > 1 ? clamp(1 - Amed / Amax, 0, 1) : 0;
  // modularity: share of exterior bays that equal the module (lengths that are whole multiples of G)
  const onModule = o.bays.length ? o.bays.filter((b) => Math.abs(b / G - 1) < 0.15).length / o.bays.length : 0;
  const O = 0.6 * symmetry(o.footprint) + 0.4 * onModule;
  // T and R, read from the elements
  const big = o.rooms.reduce((b, r) => (Math.abs(area(r.poly)) > Math.abs(area(b.poly)) ? r : b), o.rooms[0]);
  const fpc = centroid(o.footprint.flat());
  const bc = centroid(big.poly);
  const span = Math.sqrt(fpArea);
  const center = !big.core && Math.hypot(bc[0] - fpc[0], bc[1] - fpc[1]) < 0.2 * span && Amax / Amed >= 2;
  const core = o.els.some((e) => {
    if (e.kind !== 'monument') return false;
    const xs = e.poly.map((p) => p[0]);
    const ys = e.poly.map((p) => p[1]);
    return Math.abs(area(e.poly)) > 2.5 && Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) > 1.5 && (e.z0 ?? 0) < 1;
  });
  const columns = o.els.filter((e) => e.kind === 'column').length >= 4;
  void codeId;
  return { O, I, E, H, G, wall: columns ? 0 : 1, phi: 0, phiRel: 0, center: center ? 1 : 0, deadEnd: core ? 1 : 0, court: columns ? 1 : 0 };
}

export function clampThetaB(t: Theta, codeId: CodeId): Theta {
  const b = CODE[codeId].bounds;
  return {
    O: clamp(t.O, b.O[0], b.O[1]),
    H: clamp(t.H, b.H[0], b.H[1]),
    G: clamp(t.G, b.G[0], b.G[1]),
    E: clamp(t.E, b.E![0], b.E![1]),
    I: clamp(t.I, b.I![0], b.I![1]),
  };
}

export function generateBuilding(target: Theta, codeId: CodeId, knobs?: Knobs): Model {
  const gen = GEN[codeId]!;
  const th = clampThetaB(target, codeId);
  const run = (a: number, k: number) => {
    const o = gen(th, a, k);
    return { o, m: measureB(o, codeId) };
  };
  let kn = knobs;
  if (!kn) {
    // O: bisect the asymmetry a (O falls as a grows); then H: bisect the dominance k
    let lo = 0;
    let hi = 1;
    let a = 0;
    if (run(0, 0.5).m.O <= th.O) a = 0;
    else if (run(1, 0.5).m.O >= th.O) a = 1;
    else {
      for (let it = 0; it < 12; it++) {
        const mid = (lo + hi) / 2;
        if (run(mid, 0.5).m.O > th.O) lo = mid;
        else hi = mid;
      }
      a = (lo + hi) / 2;
    }
    lo = 0;
    hi = 1;
    let k = 0;
    if (run(a, 0).m.H >= th.H) k = 0;
    else if (run(a, 1).m.H <= th.H) k = 1;
    else {
      for (let it = 0; it < 12; it++) {
        const mid = (lo + hi) / 2;
        if (run(a, mid).m.H < th.H) lo = mid;
        else hi = mid;
      }
      k = (lo + hi) / 2;
    }
    kn = { a, k };
  }
  const { o, m } = run(kn.a, kn.k);
  const errors = paramErrors(m, target);
  const pts = o.els.flatMap((e) => e.poly);
  const top = Math.max(...o.els.map((e) => (e.z0 ?? 0) + (e.h ?? 0)), 1);
  const ext = Math.max(...pts.map((p) => Math.max(Math.abs(p[0]), Math.abs(p[1]))), top * 0.6, 10);
  const lots: Lot[] = o.rooms.filter((r) => !r.core).map((r) => ({ poly: r.poly, kind: 'built' }));
  return {
    scale: 'building',
    code: codeId,
    target,
    clamped: th,
    site: ext * 2.2,
    siteArea: o.footprint.reduce((s, p) => s + Math.abs(area(p)), 0),
    siteShape: 'square',
    radius: ext,
    buildings: o.els,
    streets: [],
    lots,
    measured: m,
    knobs: kn,
    error: meanError(errors),
    errors,
    cells: o.rooms.length,
  };
}
