import matrixJson from '../data/matrix.json';
import { CITY_CASES, caseById, caseT, caseWall, type Case, type Transition } from '../data/cases';
import { CODES } from '../engine/codes';
import { FIT_THRESHOLD, tSignature } from '../engine/measure';
import type { CodeId, Knobs, Param, Theta } from '../engine/types';

export interface Cell {
  e: number;
  p: Record<Param, number>;
  m: Theta & { wall: number; center: number; deadEnd: number; court: number };
  k: Knobs;
}

export const MATRIX = matrixJson as unknown as Record<string, Cell>;
export const cell = (caseId: number, code: CodeId) => MATRIX[`${caseId}:${code}`];

export type Fit = 'full' | 'numbers' | 'none';

export type TKey = 'center' | 'deadEnd' | 'court';

/** structure test: relation R (street wall) and element types T, model against the documented case */
export function structureOf(c: Case, m: Cell['m']) {
  const rOk = m.wall >= 0.5 === caseWall(c);
  const sig = tSignature(m);
  const doc = caseT(c);
  const tDiff = (Object.keys(doc) as TKey[]).filter((k) => sig[k] !== doc[k]);
  return { rOk, tDiff, sig, doc };
}

/** full = θ within threshold and the structure (R and T) matches; numbers = θ only */
export function fitOf(c: Case, code: CodeId): Fit {
  const x = cell(c.id, code);
  if (!x) return 'none';
  if (x.e > FIT_THRESHOLD) return 'none';
  const { rOk, tDiff } = structureOf(c, x.m);
  return rOk && !tDiff.length ? 'full' : 'numbers';
}

export const FIT_LABEL: Record<Fit, string> = {
  full: 'משחזר: מספרים ומבנה',
  numbers: 'מספרים בלבד: R או T שונים',
  none: 'לא משחזר',
};

export type ModelVerdict = 'evolution' | 'revolution-T' | 'revolution-R' | 'revolution-P' | 'restoration' | 'hybrid' | 'out';

export const MODEL_VERDICT: Record<ModelVerdict, { he: string; doc: Transition['doc'] | null; color: string }> = {
  evolution: { he: 'אבולוציה', doc: 'evolution', color: 'var(--evo)' },
  'revolution-T': { he: 'מהפכה באלמנט T', doc: 'revolution', color: 'var(--rev)' },
  'revolution-R': { he: 'מהפכה ביחס R', doc: 'revolution', color: 'var(--rev)' },
  'revolution-P': { he: 'מהפכה בכלל P', doc: 'revolution', color: 'var(--rev)' },
  restoration: { he: 'רסטורציה', doc: 'restoration', color: 'var(--res)' },
  hybrid: { he: 'הכלאה', doc: 'hybrid', color: 'var(--hyb)' },
  out: { he: 'מחוץ למחולל', doc: null, color: 'var(--grey)' },
};

const firstUse = (code: CodeId) => Math.min(...CITY_CASES.filter((c) => c.code === code).map((c) => c.year));

export function judge(t: Transition): { verdict: ModelVerdict; reproducers: CodeId[]; by?: CodeId; err: number } {
  const to = caseById(t.to);
  if (!to || !to.theta) return { verdict: 'out', reproducers: [], err: NaN };
  const reproducers = CODES.map((c) => c.id).filter((id) => fitOf(to, id) === 'full');
  const own = fitOf(to, t.from);
  const err = cell(to.id, t.from).e;
  if (own === 'full') return { verdict: 'evolution', reproducers, err };
  // a code that reproduces the new case and was already in use before the old paradigm: a return
  const restoring = reproducers.filter((id) => id !== t.from && firstUse(id) < to.year);
  restoring.sort((a, b) => (a === to.code ? -1 : b === to.code ? 1 : 0));
  if (restoring.length) return { verdict: 'restoration', reproducers, by: restoring[0], err };
  if (!reproducers.length) return { verdict: 'hybrid', reproducers, err };
  if (own === 'numbers') {
    const { rOk } = structureOf(to, cell(to.id, t.from).m);
    return { verdict: rOk ? 'revolution-T' : 'revolution-R', reproducers, by: reproducers[0], err };
  }
  return { verdict: 'revolution-P', reproducers, by: reproducers[0], err };
}

export function agrees(t: Transition, v: ModelVerdict) {
  return MODEL_VERDICT[v].doc === t.doc;
}

/** headline numbers for the home page and lenses */
export function stats() {
  let full = 0;
  let numbersOnly = 0;
  let foreignFull = 0;
  let ownOk = 0;
  for (const c of CITY_CASES) {
    if (fitOf(c, c.code) === 'full') ownOk++;
    for (const code of CODES) {
      const f = fitOf(c, code.id);
      if (f === 'full') {
        full++;
        if (code.id !== c.code) foreignFull++;
      }
      if (f === 'numbers') numbersOnly++;
    }
  }
  return { full, numbersOnly, foreignFull, ownOk, cities: CITY_CASES.length, runs: CITY_CASES.length * CODES.length };
}

/** normalised θ distance, used for "nearest cases" */
export function thetaDistance(a: Theta, b: Theta) {
  const l = (x: number) => Math.log10(Math.max(x, 0.01));
  return Math.sqrt(
    (a.O - b.O) ** 2 + (a.E - b.E) ** 2 + (a.H - b.H) ** 2 + ((l(a.I) - l(b.I)) / 2) ** 2 + ((l(a.G) - l(b.G)) / 2) ** 2,
  );
}

export { FIT_THRESHOLD };
