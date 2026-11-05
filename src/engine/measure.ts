import type { Building, Param, Street, Theta } from './types';
import { area, centroid } from './geom';

const BINS = 36;
const H_MAX = Math.log(BINS);
const H_GRID = Math.log(4);

/**
 * Boeing (2019), "Urban spatial order", Applied Network Science 4:67.
 * 36 bins of 10°, both directions counted, bins centred on 0°.
 * φ = 1 − ((H₀ − H_g) / (H_max − H_g))², H_max = ln 36, H_g = ln 4.
 * Here edges are weighted by length [ה: Boeing's base version counts edges].
 */
export function phiFromBearings(items: { deg: number; w: number }[]): number {
  const h = new Array(BINS).fill(0);
  let tot = 0;
  for (const it of items) {
    for (const d of [it.deg, it.deg + 180]) {
      const x = (((d + 5) % 360) + 360) % 360;
      h[Math.floor(x / 10) % BINS] += it.w;
      tot += it.w;
    }
  }
  if (tot === 0) return 0;
  let H0 = 0;
  for (const v of h) {
    if (v > 0) {
      const p = v / tot;
      H0 -= p * Math.log(p);
    }
  }
  if (H0 <= H_GRID) return 1;
  const r = (H0 - H_GRID) / (H_MAX - H_GRID);
  return Math.max(0, Math.min(1, 1 - r * r));
}

export function orderOf(streets: Street[]): { phi: number; phiRel: number } {
  const abs: { deg: number; w: number }[] = [];
  const rel: { deg: number; w: number }[] = [];
  for (const s of streets) {
    const dx = s.b[0] - s.a[0];
    const dy = s.b[1] - s.a[1];
    const L = Math.hypot(dx, dy);
    if (L < 1e-6) continue;
    const deg = (Math.atan2(dx, dy) * 180) / Math.PI;
    abs.push({ deg, w: L });
    const mx = (s.a[0] + s.b[0]) / 2;
    const my = (s.a[1] + s.b[1]) / 2;
    if (Math.hypot(mx, my) > 1) {
      const radial = (Math.atan2(mx, my) * 180) / Math.PI;
      rel.push({ deg: deg - radial, w: L });
    }
  }
  return { phi: phiFromBearings(abs), phiRel: phiFromBearings(rel) };
}

function gini(values: number[], weights: number[]): number {
  const idx = values.map((_, i) => i).sort((a, b) => values[a] - values[b]);
  let W = 0;
  let S = 0;
  for (const i of idx) {
    W += weights[i];
    S += weights[i] * values[i];
  }
  if (W === 0 || S === 0) return 0;
  // weighted Gini via Lorenz curve
  let cumW = 0;
  let cumS = 0;
  let B = 0;
  for (const i of idx) {
    const w = weights[i] / W;
    const s = (weights[i] * values[i]) / S;
    B += w * (cumS + s / 2);
    cumW += w;
    cumS += s;
  }
  return Math.max(0, Math.min(1, 1 - 2 * B));
}

/**
 * Hierarchy, composite [ה]:
 *  hw: length-weighted coefficient of variation of street widths (an axis stands out)
 *  hd: negative correlation between height and distance from the centre
 *  hg: footprint-weighted Gini of floors
 *  H = 1 − (1−hw)(1−hd)(1−hg)
 */
export function hierarchyOf(streets: Street[], bs: Building[]) {
  let L = 0;
  let mw = 0;
  for (const s of streets) {
    const l = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
    L += l;
    mw += l * s.w;
  }
  mw /= L || 1;
  let vw = 0;
  for (const s of streets) {
    const l = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
    vw += l * (s.w - mw) ** 2;
  }
  const hw = Math.min(1, Math.sqrt(vw / (L || 1)) / (mw || 1));

  const f: number[] = [];
  const a: number[] = [];
  const d: number[] = [];
  for (const b of bs) {
    if (b.kind === 'wall') continue;
    const c = centroid(b.poly);
    f.push(b.floors);
    a.push(Math.abs(area(b.poly)));
    d.push(Math.hypot(c[0], c[1]));
  }
  let W = 0;
  let mf = 0;
  let md = 0;
  for (let i = 0; i < f.length; i++) {
    W += a[i];
    mf += a[i] * f[i];
    md += a[i] * d[i];
  }
  mf /= W || 1;
  md /= W || 1;
  let cov = 0;
  let vf = 0;
  let vd = 0;
  for (let i = 0; i < f.length; i++) {
    cov += a[i] * (f[i] - mf) * (d[i] - md);
    vf += a[i] * (f[i] - mf) ** 2;
    vd += a[i] * (d[i] - md) ** 2;
  }
  const r = vf > 0 && vd > 0 ? cov / Math.sqrt(vf * vd) : 0;
  const hd = Math.max(0, -r);
  const hg = gini(f, a);
  return { H: 1 - (1 - hw) * (1 - hd) * (1 - hg), hw, hd, hg };
}

export function coverage(bs: Building[], siteArea: number) {
  let fp = 0;
  let fa = 0;
  for (const b of bs) {
    if (b.kind === 'wall') continue;
    const A = Math.abs(area(b.poly));
    fp += A;
    fa += A * b.floors;
  }
  return { E: fp / siteArea, I: fa / siteArea, footprint: fp };
}

const LN10 = Math.log(10);

/** per-parameter error, all on a 0..1-ish scale; I and G compared in log decades */
export function paramErrors(m: Theta, t: Theta): Record<Param, number> {
  return {
    O: Math.abs(m.O - t.O),
    E: Math.abs(m.E - t.E),
    H: Math.abs(m.H - t.H),
    I: Math.abs(Math.log(Math.max(m.I, 0.01) / Math.max(t.I, 0.01))) / LN10,
    G: Math.abs(Math.log(m.G / t.G)) / LN10,
  };
}

export const meanError = (e: Record<Param, number>) => (e.O + e.I + e.E + e.H + e.G) / 5;

/** fit threshold below which a code is said to reproduce a case [ה] */
export const FIT_THRESHOLD = 0.05;
