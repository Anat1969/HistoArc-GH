import type { Building, Code, CodeId, Knobs, Lot, Model, Poly, Street, Theta } from './types';
import { CODE } from './codes';
import { area, bilinear, centroid, distLine, insetConvex, isConvexCCW, lerp, scaleAbout, type V } from './geom';
import { hash3, hs, vnoise } from './rng';
import { coverage, deadEndShare, hierarchyOf, meanError, orderOf, paramErrors } from './measure';

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

export function clampTheta(t: Theta, c: Code): Theta {
  const E = c.bounds.E ? clamp(t.E, c.bounds.E[0], c.bounds.E[1]) : clamp(t.E, 0.01, 0.98);
  return {
    O: clamp(t.O, c.bounds.O[0], c.bounds.O[1]),
    H: clamp(t.H, c.bounds.H[0], c.bounds.H[1]),
    G: clamp(t.G, c.bounds.G[0], c.bounds.G[1]),
    E,
    I: clamp(t.I, 0.02, c.floorsMax * E),
  };
}

export function siteFor(G: number, code?: CodeId) {
  if (code === 'ideal') return { N: 1, S: Math.max(700, 5 * G) };
  const N = Math.max(3, Math.min(30, Math.round(Math.max(600, 3 * G) / G)));
  return { N, S: N * G };
}

/** replace a non-convex quad by its convex hull (drops the reflex vertex) */
function hullOf(p: Poly): Poly {
  const pts = [...p].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: V, a: V, b: V) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: V[] = [];
  for (const q of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: V[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const q = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

interface Cell {
  poly: Poly;
  widths: number[];
  kind: Lot['kind'];
}

interface Skeleton {
  cells: Cell[];
  streets: Street[];
  siteArea: number;
  siteShape: 'square' | 'circle';
  radius: number;
  axes: { o: V; e: V; w: number }[];
  walls: Building[];
  center: boolean; // T: a sacred or civic centre is part of the plan
  gArea: number; // area over which grain is averaged (excludes a central piazza)
}

const SEED = 7;

function baseWidth(code: CodeId, G: number) {
  if (code === 'tower') return clamp(0.06 * G, 14, 40);
  if (code === 'organic') return clamp(0.07 * G, 2.5, 10);
  if (code === 'medina') return clamp(0.05 * G, 2, 6);
  if (code === 'grand') return clamp(0.09 * G, 4, 22);
  return clamp(0.12 * G, 4, 30);
}

function displace(code: CodeId, x: number, y: number, G: number, a: number, i: number, j: number, S: number): V {
  let warpA = 0;
  let lam = 1;
  let jit = 0;
  switch (code) {
    case 'organic':
    case 'medina':
    case 'grand':
      warpA = a * 1.5 * G;
      lam = 2.4 * G;
      jit = a * 0.3 * G;
      break;
    case 'garden':
      lam = Math.min(3 * G, S * 0.45);
      warpA = a * 0.9 * lam;
      jit = a * 0.08 * G;
      break;
    case 'field': {
      const A = a * 1.5 * G;
      const L = 5.5 * G;
      return [x + A * Math.sin((2 * Math.PI * y) / L + 0.6), y + 0.7 * A * Math.sin((2 * Math.PI * x) / (L * 1.3))];
    }
    default:
      warpA = a * 0.45 * G;
      lam = 5 * G;
      jit = a * 0.3 * G;
  }
  const dx = warpA * vnoise(x / lam, y / lam, SEED) + jit * hs(i, j, SEED + 11);
  const dy = warpA * vnoise(x / lam + 31.7, y / lam - 17.3, SEED + 1) + jit * hs(i, j, SEED + 12);
  return [x + dx, y + dy];
}

function lineKind(code: CodeId, idx: number, N: number): Street['kind'] {
  const mid = Math.round(N / 2);
  switch (code) {
    case 'cosmic':
      return idx === mid ? 'axis' : 'local';
    case 'grid':
      return idx % 4 === 0 ? 'main' : 'local';
    case 'tower':
      return idx % 2 === 0 ? 'main' : 'local';
    case 'organic':
      return idx % 5 === 2 ? 'main' : 'local';
    case 'medina':
      return idx % 6 === 3 ? 'main' : 'local';
    case 'garden':
    case 'field':
      return idx % 3 === 0 ? 'main' : 'local';
    default:
      return 'local';
  }
}

function widthOf(kind: Street['kind'], s: number, k: number) {
  if (kind === 'axis') return s * (1 + 4 * k);
  if (kind === 'main') return s * (1 + 1.6 * k);
  return s;
}

function orthoSkeleton(code: CodeId, G0: number, a: number, k: number): Skeleton {
  const { N, S } = siteFor(G0);
  const G = S / N;
  const s = baseWidth(code, G);
  const nodes: V[][] = [];
  for (let i = 0; i <= N; i++) {
    nodes.push([]);
    for (let j = 0; j <= N; j++) {
      const x = -S / 2 + i * G;
      const y = -S / 2 + j * G;
      nodes[i].push(displace(code, x, y, G, a, i, j, S));
    }
  }
  const streets: Street[] = [];
  const wH: number[][] = [];
  const wV: number[][] = [];
  for (let i = 0; i <= N; i++) {
    wH.push([]);
    wV.push([]);
    for (let j = 0; j <= N; j++) {
      const kh = lineKind(code, j, N);
      const kv = lineKind(code, i, N);
      // medina: interior lanes are closed off at random, leaving cul-de-sacs (T: dead-end street)
      const shutH = code === 'medina' && kh === 'local' && j > 0 && j < N && hash3(i, j, SEED + 61) < 0.42;
      const shutV = code === 'medina' && kv === 'local' && i > 0 && i < N && hash3(i, j, SEED + 62) < 0.42;
      wH[i].push(shutH ? 0 : widthOf(kh, s, k));
      wV[i].push(shutV ? 0 : widthOf(kv, s, k));
      if (i < N && !shutH) streets.push({ a: nodes[i][j], b: nodes[i + 1][j], w: wH[i][j], kind: kh });
      if (j < N && !shutV) streets.push({ a: nodes[i][j], b: nodes[i][j + 1], w: wV[i][j], kind: kv });
    }
  }
  const cells: Cell[] = [];
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const poly: Poly = [nodes[i][j], nodes[i + 1][j], nodes[i + 1][j + 1], nodes[i][j + 1]];
      const widths = [wH[i][j], wV[i + 1][j], wH[i][j + 1], wV[i][j]];
      const c = centroid(poly);
      const r = Math.hypot(c[0], c[1]);
      let kind: Lot['kind'] = 'built';
      if (code === 'cosmic' && r < 0.8 * G) kind = 'monument';
      if ((code === 'organic' || code === 'medina') && (hash3(i, j, SEED + 40) < 0.04 || r < 0.5 * G)) kind = 'open';
      if (code === 'garden' && N >= 5 && Math.max(Math.abs(c[0]), Math.abs(c[1])) > 0.36 * S) kind = 'green';
      if (code === 'tower' && N >= 4 && r < 0.6 * G && k > 0.4) kind = 'open';
      cells.push({ poly, widths, kind });
    }
  }
  const axes: Skeleton['axes'] = [];
  if (code === 'grand') {
    const nA = 2 + (k > 0.85 ? 1 : 0);
    const base = [18, 108, 63, 153];
    const w = 12 + 16 * k;
    for (let n = 0; n < nA; n++) {
      const ang = (base[n] * Math.PI) / 180;
      const e: V = [Math.cos(ang), Math.sin(ang)];
      const o: V = [n === 0 ? 0 : (n % 2 ? 1 : -1) * 0.12 * S, n === 0 ? 0 : 0.08 * S * (n - 1.5)];
      axes.push({ o, e, w });
      // split into pieces so the axis counts by length, clipped to the square
      const half = S * 0.75;
      const steps = Math.max(2, Math.round((2 * half) / G));
      for (let q = 0; q < steps; q++) {
        const t0 = -half + (2 * half * q) / steps;
        const t1 = -half + (2 * half * (q + 1)) / steps;
        const A: V = [o[0] + e[0] * t0, o[1] + e[1] * t0];
        const B: V = [o[0] + e[0] * t1, o[1] + e[1] * t1];
        const inside = (p: V) => Math.abs(p[0]) <= S / 2 && Math.abs(p[1]) <= S / 2;
        if (inside(A) && inside(B)) streets.push({ a: A, b: B, w, kind: 'axis' });
      }
    }
  }
  const walls: Building[] = [];
  if (code === 'cosmic') {
    const t = 8;
    const R = S / 2 + 10;
    const sq: V[] = [
      [-R, -R],
      [R, -R],
      [R, R],
      [-R, R],
    ];
    for (let n = 0; n < 4; n++) {
      const A = sq[n];
      const B = sq[(n + 1) % 4];
      const e: V = [(B[0] - A[0]) / (2 * R), (B[1] - A[1]) / (2 * R)];
      const nn: V = [-e[1], e[0]];
      walls.push({
        poly: [A, B, [B[0] - nn[0] * t, B[1] - nn[1] * t], [A[0] - nn[0] * t, A[1] - nn[1] * t]].reverse() as Poly,
        floors: 4,
        kind: 'wall',
        w: 0,
      });
    }
  }
  return { cells, streets, siteArea: S * S, siteShape: 'square', radius: S / 2, axes, walls, center: code === 'cosmic', gArea: S * S };
}

function idealSkeleton(G0: number, a: number, k: number): Skeleton {
  const { S } = siteFor(G0, 'ideal');
  const r0 = Math.max(0.9 * G0, 36);
  const K = Math.max(1, Math.floor((S / 2 - r0) / G0));
  const G = (S / 2 - r0) / K;
  const s = baseWidth('ideal', G);
  const M0 = 9;
  const rot = Math.PI / 2;
  const cells: Cell[] = [];
  const streets: Street[] = [];
  const p = (r: number, al: number, kk: number, m: number, M: number): V => {
    const key = Math.round(((m % M) / M) * 3600); // same angle, same jitter: rings stay connected
    const jr = a * 0.3 * G * hs(kk, key, SEED + 21);
    const ja = (a * 0.3 * G * hs(kk, key, SEED + 22)) / Math.max(r, 1);
    return [(r + jr) * Math.cos(al + ja), (r + jr) * Math.sin(al + ja)];
  };
  for (let kk = 0; kk < K; kk++) {
    const r1 = r0 + kk * G;
    const r2 = r1 + G;
    const rm = (r1 + r2) / 2;
    const M = M0 * 2 ** Math.max(0, Math.round(Math.log2((2 * Math.PI * rm) / (M0 * G))));
    const step = M / M0;
    for (let m = 0; m < M; m++) {
      const a1 = rot + (2 * Math.PI * m) / M;
      const a2 = rot + (2 * Math.PI * (m + 1)) / M;
      const P1 = p(r1, a1, kk, m, M);
      const P2 = p(r1, a2, kk, m + 1, M);
      const P3 = p(r2, a2, kk + 1, m + 1, M);
      const P4 = p(r2, a1, kk + 1, m, M);
      const radKind1: Street['kind'] = m % step === 0 ? 'axis' : 'local';
      const radKind2: Street['kind'] = (m + 1) % step === 0 ? 'axis' : 'local';
      const wr = s;
      const w1 = radKind1 === 'axis' ? s * (1 + 2.5 * k) : s;
      const w2 = radKind2 === 'axis' ? s * (1 + 2.5 * k) : s;
      // CW order -> reverse to CCW; edges: P1P2 ring, P2P3 radial2, P3P4 ring, P4P1 radial1
      const poly: Poly = [P4, P3, P2, P1];
      const widths = [wr, w2, wr, w1];
      cells.push({ poly, widths, kind: 'built' });
      streets.push({ a: P1, b: P4, w: w1, kind: radKind1 });
      streets.push({ a: P1, b: P2, w: wr, kind: 'local' });
      if (kk === K - 1) streets.push({ a: P4, b: P3, w: wr, kind: 'local' });
    }
  }
  const R = r0 + K * G;
  const walls: Building[] = [];
  const nW = 9;
  for (let n = 0; n < nW; n++) {
    const a1 = rot + (2 * Math.PI * n) / nW;
    const a2 = rot + (2 * Math.PI * (n + 1)) / nW;
    const Ro = R / Math.cos(Math.PI / nW) + 14;
    const Ri = Ro - 10;
    walls.push({
      poly: [
        [Ri * Math.cos(a1), Ri * Math.sin(a1)],
        [Ro * Math.cos(a1), Ro * Math.sin(a1)],
        [Ro * Math.cos(a2), Ro * Math.sin(a2)],
        [Ri * Math.cos(a2), Ri * Math.sin(a2)],
      ].reverse() as Poly,
      floors: 4,
      kind: 'wall',
      w: 0,
    });
  }
  return { cells, streets, siteArea: Math.PI * R * R, siteShape: 'circle', radius: R, axes: [], walls, center: true, gArea: Math.PI * (R * R - r0 * r0) };
}

function skeleton(code: CodeId, G: number, a: number, k: number): Skeleton {
  return code === 'ideal' ? idealSkeleton(G, a, k) : orthoSkeleton(code, G, a, k);
}

function normalise(c: Cell): Cell {
  if (area(c.poly) >= 0) return c;
  const poly = [...c.poly].reverse();
  // edge i of reversed polygon corresponds to edge (n-2-i) mod n of the original
  const n = c.widths.length;
  const widths = c.widths.map((_, i) => c.widths[(n - 2 - i + 2 * n) % n]);
  return { ...c, poly, widths };
}

/** split a convex quad into a grid of house plots of about `size` metres */
function splitLot(lot: Poly, size: number): Poly[] {
  if (lot.length !== 4) return [lot];
  const Lu = (Math.hypot(lot[1][0] - lot[0][0], lot[1][1] - lot[0][1]) + Math.hypot(lot[2][0] - lot[3][0], lot[2][1] - lot[3][1])) / 2;
  const Lv = (Math.hypot(lot[3][0] - lot[0][0], lot[3][1] - lot[0][1]) + Math.hypot(lot[2][0] - lot[1][0], lot[2][1] - lot[1][1])) / 2;
  const m = Math.max(1, Math.round(Lu / size));
  const n = Math.max(1, Math.round(Lv / size));
  const out: Poly[] = [];
  for (let i = 0; i < m; i++)
    for (let j = 0; j < n; j++)
      out.push([bilinear(lot, i / m, j / n), bilinear(lot, (i + 1) / m, j / n), bilinear(lot, (i + 1) / m, (j + 1) / n), bilinear(lot, i / m, (j + 1) / n)]);
  return out;
}

function ringArea(lot: Poly, d: number, A: number): number {
  const q = insetConvex(lot, d);
  return q ? A - area(q) : A;
}

function perimeterParcels(code: Code, lot: Poly, c: number, G: number, salt: number, pwOverride?: number): { parcels: Poly[]; frontage: number; court: boolean } {
  const A = area(lot);
  const target = c * A;
  let inner: Poly | null;
  const [dmin, dmax] = code.depth!;
  if (c >= 0.97) inner = null;
  else {
    let lo = 0;
    let hi = Math.min(dmax, 400);
    for (let it = 0; it < 18; it++) {
      const mid = (lo + hi) / 2;
      if (ringArea(lot, mid, A) < target) lo = mid;
      else hi = mid;
    }
    const d = clamp((lo + hi) / 2, dmin, dmax);
    inner = insetConvex(lot, d);
  }
  const parcels: Poly[] = [];
  const court = !!inner;
  if (!inner) {
    // full coverage: a ring of parcels around a solid core, no courtyard
    inner = scaleAbout(lot, centroid(lot), 0.4);
    parcels.push(inner);
  }
  let frontage = 0;
  const pw = pwOverride ?? clamp(G * 0.22, 6, 26);
  for (let i = 0; i < lot.length; i++) {
    const a = lot[i];
    const b = lot[(i + 1) % lot.length];
    const a2 = inner[i];
    const b2 = inner[(i + 1) % lot.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    frontage += L;
    const n = Math.max(1, Math.round(L / pw));
    const ts: number[] = [0];
    for (let q = 1; q < n; q++) {
      const jitter = code.id === 'organic' ? 0.35 * hs(salt, i * 50 + q, SEED + 5) : 0;
      ts.push((q + jitter) / n);
    }
    ts.push(1);
    for (let q = 0; q < n; q++) {
      parcels.push([lerp(a, b, ts[q]), lerp(a, b, ts[q + 1]), lerp(a2, b2, ts[q + 1]), lerp(a2, b2, ts[q])]);
    }
  }
  return { parcels, frontage, court };
}

function pavilions(code: Code, lot0: Poly, c: number, fEst: number): Poly[] {
  const lot: Poly = lot0.length === 4 ? lot0 : lot0.length === 3 ? [lot0[0], lot0[1], lot0[2], lerp(lot0[2], lot0[0], 0.5)] : [lot0[0], lot0[1], lot0[2], lot0[3]];
  const A = area(lot0);
  const [smin, smax] = code.pavilion!.side;
  const gap = code.pavilion!.gap;
  const Lu = (Math.hypot(lot[1][0] - lot[0][0], lot[1][1] - lot[0][1]) + Math.hypot(lot[2][0] - lot[3][0], lot[2][1] - lot[3][1])) / 2;
  const Lv = (Math.hypot(lot[3][0] - lot[0][0], lot[3][1] - lot[0][1]) + Math.hypot(lot[2][0] - lot[1][0], lot[2][1] - lot[1][1])) / 2;
  const sc = Math.sqrt(Math.max(c, 1e-4));
  let s0 = code.id === 'tower' ? clamp(18 + fEst * 0.7, smin, smax) : clamp(9 + fEst, smin, smax);
  if (sc < 1) s0 = Math.max(s0, Math.min(smax, (gap * sc) / (1 - sc)));
  const pitch = Math.max(s0 / sc, s0 + gap);
  const m = Math.max(1, Math.round(Lu / pitch));
  const n = Math.max(1, Math.round(Lv / pitch));
  const side = Math.min(smax * (code.id === 'tower' ? 1.6 : 1), Math.sqrt((c * A) / (m * n)), Math.min(Lu / m, Lv / n) - gap * 0.6);
  if (side < 4) return [];
  const e0: V = [lot[1][0] - lot[0][0], lot[1][1] - lot[0][1]];
  const L0 = Math.hypot(e0[0], e0[1]);
  const u: V = [e0[0] / L0, e0[1] / L0];
  const v: V = [-u[1], u[0]];
  const h = side / 2;
  const out: Poly[] = [];
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      const cpt = bilinear(lot, (i + 0.5) / m, (j + 0.5) / n);
      out.push([
        [cpt[0] - u[0] * h - v[0] * h, cpt[1] - u[1] * h - v[1] * h],
        [cpt[0] + u[0] * h - v[0] * h, cpt[1] + u[1] * h - v[1] * h],
        [cpt[0] + u[0] * h + v[0] * h, cpt[1] + u[1] * h + v[1] * h],
        [cpt[0] - u[0] * h + v[0] * h, cpt[1] - u[1] * h + v[1] * h],
      ]);
    }
  }
  return out;
}

interface Built {
  buildings: Building[];
  lots: Lot[];
  frontage: number;
  wallLen: number;
  houses: number;
  courts: number;
}

/** Sutherland–Hodgman on a convex polygon, keeping n·x ≥ c; new edges on the clip line get width 0. */
function clipHalf(cell: Cell, n: V, c: number): Cell | null {
  const out: V[] = [];
  const ws: number[] = [];
  const P = cell.poly;
  const inside = (q: V) => q[0] * n[0] + q[1] * n[1] >= c;
  for (let i = 0; i < P.length; i++) {
    const S = P[i];
    const E = P[(i + 1) % P.length];
    const w = cell.widths[i];
    const iS = inside(S);
    const iE = inside(E);
    if (iS) {
      out.push(S);
      ws.push(w);
    }
    if (iS !== iE) {
      const dS = S[0] * n[0] + S[1] * n[1] - c;
      const dE = E[0] * n[0] + E[1] * n[1] - c;
      const t = dS / (dS - dE);
      out.push(lerp(S, E, t));
      ws.push(iS ? 0 : w);
    }
  }
  if (out.length < 3 || area(out) < 40) return null;
  return { poly: out, widths: ws, kind: cell.kind };
}

function cutByAxes(cells: Cell[], axes: Skeleton['axes']): Cell[] {
  let cur = cells;
  for (const ax of axes) {
    const n: V = [-ax.e[1], ax.e[0]];
    const c0 = ax.o[0] * n[0] + ax.o[1] * n[1];
    const next: Cell[] = [];
    for (const cell of cur) {
      const a = clipHalf(cell, n, c0 + ax.w / 2);
      const b = clipHalf(cell, [-n[0], -n[1]], -(c0 - ax.w / 2));
      if (a) next.push(a);
      if (b) next.push(b);
    }
    cur = next;
  }
  return cur;
}

function build(code: Code, sk: Skeleton, th: Theta, k: number, G: number, cScale = 1): Built {
  const lots: Lot[] = [];
  const prepared: Cell[] = [];
  for (const raw of sk.cells) {
    let cell = normalise(raw);
    if (!isConvexCCW(cell.poly)) {
      const h = hullOf(cell.poly);
      if (h.length < 3) continue;
      const w = Math.min(...cell.widths);
      cell = { ...cell, poly: h, widths: h.map(() => w) };
      if (!isConvexCCW(cell.poly)) continue;
    }
    prepared.push(cell);
  }
  const cut = sk.axes.length ? cutByAxes(prepared, sk.axes) : prepared;
  for (const cell of cut) {
    const lot = insetConvex(
      cell.poly,
      cell.widths.map((w) => w / 2),
    );
    if (!lot) continue;
    lots.push({ poly: lot, kind: cell.kind });
  }
  const builtLots = lots.filter((l) => l.kind === 'built' || l.kind === 'monument');
  const lotArea = builtLots.reduce((s, l) => s + area(l.poly), 0);
  const c = clamp(((th.E * sk.siteArea) / Math.max(lotArea, 1)) * cScale, 0.001, 1);
  const fEst = th.I / th.E;
  const footprints: { poly: Poly; kind: Building['kind'] }[] = [];
  let frontage = 0;
  let wallLen = 0;
  let salt = 0;
  let houseCount = 0;
  let courtCount = 0;
  for (const l of lots) {
    salt++;
    if (l.kind === 'open' || l.kind === 'green') continue;
    if (l.kind === 'monument') {
      footprints.push({ poly: scaleAbout(l.poly, centroid(l.poly), Math.sqrt(clamp(c, 0.25, 0.8))), kind: 'monument' });
      continue;
    }
    const per = l.poly.reduce((s, q, i) => {
      const b = l.poly[(i + 1) % l.poly.length];
      return s + Math.hypot(b[0] - q[0], b[1] - q[1]);
    }, 0);
    if (code.id === 'medina') {
      // T: courtyard house. Each lot is split into houses, each house keeps a courtyard (≥ 8%).
      const houses = splitLot(l.poly, 15);
      for (const h of houses) {
        const r = perimeterParcels(code, h, Math.min(c, 0.92), G, salt++, 1e9);
        for (const p of r.parcels) footprints.push({ poly: p, kind: 'fabric' });
        houseCount++;
        if (r.court) courtCount++;
      }
      frontage += per;
      wallLen += per;
    } else if (code.depth) {
      const { parcels, frontage: f } = perimeterParcels(code, l.poly, c, G, salt);
      for (const p of parcels) footprints.push({ poly: p, kind: 'fabric' });
      frontage += per;
      wallLen += f;
    } else {
      for (const p of pavilions(code, l.poly, c, fEst)) footprints.push({ poly: p, kind: 'fabric' });
      frontage += per;
    }
  }
  const fps = footprints;
  // heights
  const R = sk.radius;
  const weights = fps.map((f, idx) => {
    const cpt = centroid(f.poly);
    const dc = Math.hypot(cpt[0], cpt[1]);
    let prof = Math.exp(-((dc / ((code.id === 'organic' ? 0.35 : 0.45) * R)) ** 2));
    if (sk.axes.length) {
      const da = Math.min(...sk.axes.map((ax) => distLine(cpt, ax.o, ax.e)));
      prof = Math.max(prof * 0.6, Math.exp(-((da / (1.4 * G)) ** 2)));
    }
    let n: number;
    let sigma: number;
    if (code.id === 'field') {
      n = vnoise(cpt[0] / (3 * G), cpt[1] / (3 * G), SEED + 9);
      sigma = 0.25 + 0.3 * k;
    } else {
      n = hs(idx, 3, SEED + 7);
      sigma = (code.id === 'organic' ? 0.22 : 0.1) + 0.25 * k;
    }
    if (f.kind === 'monument') return Math.exp(k * 2.9 + 0.2);
    return Math.exp(k * (code.id === 'ideal' ? 3.4 : 2.4) * prof + sigma * n);
  });
  const areas = fps.map((f) => Math.abs(area(f.poly)));
  const totalA = areas.reduce((s, x) => s + x, 0) || 1;
  const targetFA = th.I * sk.siteArea;
  let s = (targetFA / totalA) * (totalA / areas.reduce((acc, a, i) => acc + a * weights[i], 0));
  let floors: number[] = [];
  for (let it = 0; it < 8; it++) {
    // deterministic dithering keeps the mean floor count on target despite integer floors
    floors = weights.map((w, i) => clamp(Math.floor(s * w + hash3(i, 17, SEED + 3)), 1, code.floorsMax));
    const fa = floors.reduce((acc, f, i) => acc + f * areas[i], 0);
    if (Math.abs(fa - targetFA) / targetFA < 0.01) break;
    s *= targetFA / fa;
  }
  const buildings: Building[] = fps.map((f, i) => ({ poly: f.poly, kind: f.kind, floors: floors[i], w: weights[i] }));
  return { buildings: [...buildings, ...sk.walls], lots, frontage, wallLen, houses: houseCount, courts: courtCount };
}

function measureAll(code: Code, sk: Skeleton, b: Built, cells: number) {
  const { phi, phiRel } = orderOf(sk.streets);
  const { E, I } = coverage(b.buildings, sk.siteArea);
  const { H } = hierarchyOf(sk.streets, b.buildings);
  return {
    O: Math.max(phi, phiRel),
    phi,
    phiRel,
    E,
    I,
    H,
    G: Math.sqrt(sk.gArea / Math.max(cells, 1)),
    wall: code.depth && b.frontage > 0 ? Math.min(1, b.wallLen / b.frontage) : 0,
    center: sk.center ? 1 : 0,
    deadEnd: deadEndShare(sk.streets, sk.siteShape, sk.radius, Math.sqrt(sk.gArea / Math.max(cells, 1))),
    court: b.houses ? b.courts / b.houses : 0,
  };
}

function solveA(code: CodeId, G: number, O: number): number {
  const f = (a: number) => {
    const sk = skeleton(code, G, a, 0.5);
    const o = orderOf(sk.streets);
    return Math.max(o.phi, o.phiRel);
  };
  if (f(0) <= O) return 0;
  if (f(1) >= O) return 1;
  let lo = 0;
  let hi = 1;
  for (let it = 0; it < 12; it++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > O) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export interface GenOpts {
  knobs?: Knobs;
}

export function generate(target: Theta, codeId: CodeId, opts: GenOpts = {}): Model {
  const code = CODE[codeId];
  const th = clampTheta(target, code);
  const G = th.G;
  const run = (a: number, k: number) => {
    const sk = skeleton(codeId, G, a, k);
    const pitch = codeId === 'ideal' ? G : siteFor(G, codeId).S / siteFor(G, codeId).N;
    let b = build(code, sk, th, k, pitch);
    let m = measureAll(code, sk, b, sk.cells.length);
    // one correction pass for coverage lost to axes, skipped cells and rounding
    if (m.E > 0 && Math.abs(m.E - th.E) > 0.005) {
      b = build(code, sk, th, k, pitch, th.E / m.E);
      m = measureAll(code, sk, b, sk.cells.length);
    }
    return { sk, b, m };
  };
  let knobs = opts.knobs;
  if (!knobs) {
    const a = solveA(codeId, G, th.O);
    let lo = 0;
    let hi = 1;
    const h0 = run(a, 0).m.H;
    const h1 = run(a, 1).m.H;
    let k: number;
    if (h0 >= th.H) k = 0;
    else if (h1 <= th.H) k = 1;
    else {
      for (let it = 0; it < 7; it++) {
        const mid = (lo + hi) / 2;
        if (run(a, mid).m.H < th.H) lo = mid;
        else hi = mid;
      }
      k = (lo + hi) / 2;
    }
    knobs = { a, k };
  }
  const { sk, b, m } = run(knobs.a, knobs.k);
  const errors = paramErrors(m, target);
  return {
    code: codeId,
    target,
    clamped: th,
    site: siteFor(G, codeId).S,
    siteArea: sk.siteArea,
    siteShape: sk.siteShape,
    radius: sk.radius,
    buildings: b.buildings,
    streets: sk.streets,
    lots: b.lots,
    measured: m,
    knobs,
    error: meanError(errors),
    errors,
    cells: sk.cells.length,
  };
}
