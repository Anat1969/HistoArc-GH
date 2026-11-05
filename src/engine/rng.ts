/** Deterministic hash noise: the same θ and code always give the same city. */
export function hash3(x: number, y: number, s: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul((s | 0) + 1013, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** signed value in [-1, 1] */
export const hs = (x: number, y: number, s: number) => hash3(x, y, s) * 2 - 1;

/** smooth 2D value noise in [-1, 1] */
export function vnoise(x: number, y: number, s: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash3(xi, yi, s);
  const b = hash3(xi + 1, yi, s);
  const c = hash3(xi, yi + 1, s);
  const d = hash3(xi + 1, yi + 1, s);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}
