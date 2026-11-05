import type { Poly } from './types';

export type V = [number, number];

export function area(p: Poly): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

export function centroid(p: Poly): V {
  let x = 0;
  let y = 0;
  for (const q of p) {
    x += q[0];
    y += q[1];
  }
  return [x / p.length, y / p.length];
}

export const lerp = (a: V, b: V, t: number): V => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

export function isConvexCCW(p: Poly): boolean {
  const n = p.length;
  for (let i = 0; i < n; i++) {
    const a = p[i];
    const b = p[(i + 1) % n];
    const c = p[(i + 2) % n];
    const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (cr <= 1e-9) return false;
  }
  return true;
}

/** Inset a convex CCW polygon; d may differ per edge (edge i = p[i] -> p[i+1]). */
export function insetConvex(p: Poly, d: number | number[]): Poly | null {
  const n = p.length;
  const lines: { o: V; e: V }[] = [];
  for (let i = 0; i < n; i++) {
    const a = p[i];
    const b = p[(i + 1) % n];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const L = Math.hypot(dx, dy);
    if (L < 1e-6) return null;
    const e: V = [dx / L, dy / L];
    const nn: V = [-e[1], e[0]];
    const di = typeof d === 'number' ? d : d[i];
    lines.push({ o: [a[0] + nn[0] * di, a[1] + nn[1] * di], e });
  }
  const out: Poly = [];
  for (let i = 0; i < n; i++) {
    const l1 = lines[(i - 1 + n) % n];
    const l2 = lines[i];
    const den = l1.e[0] * l2.e[1] - l1.e[1] * l2.e[0];
    if (Math.abs(den) < 1e-9) return null;
    const t = ((l2.o[0] - l1.o[0]) * l2.e[1] - (l2.o[1] - l1.o[1]) * l2.e[0]) / den;
    out.push([l1.o[0] + l1.e[0] * t, l1.o[1] + l1.e[1] * t]);
  }
  // reject flipped results: every edge must keep its direction
  for (let i = 0; i < n; i++) {
    const a = out[i];
    const b = out[(i + 1) % n];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    if (dx * lines[i].e[0] + dy * lines[i].e[1] <= 0.05) return null;
  }
  if (area(out) <= 1) return null;
  return out;
}

export function perimeter(p: Poly): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    s += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return s;
}

/** distance from point to infinite line through o with unit direction e */
export function distLine(pt: V, o: V, e: V): number {
  return Math.abs((pt[0] - o[0]) * e[1] - (pt[1] - o[1]) * e[0]);
}

export function bilinear(q: Poly, u: number, v: number): V {
  const a = lerp(q[0], q[1], u);
  const b = lerp(q[3], q[2], u);
  return lerp(a, b, v);
}

export function scaleAbout(p: Poly, c: V, s: number): Poly {
  return p.map((q) => [c[0] + (q[0] - c[0]) * s, c[1] + (q[1] - c[1]) * s] as V);
}
