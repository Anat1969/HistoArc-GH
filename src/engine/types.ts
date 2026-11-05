export type Param = 'O' | 'I' | 'E' | 'H' | 'G';
export const PARAMS: Param[] = ['O', 'I', 'E', 'H', 'G'];

/** θ: the five continuous values shared by every scale. */
export interface Theta {
  O: number; // order, 0..1 (Boeing φ, or φ of bearings relative to the centre)
  I: number; // intensity, FSI
  E: number; // enclosure, GSI 0..1
  H: number; // hierarchy, 0..1
  G: number; // grain, block pitch in metres
}

export type Lynch = 'cosmic' | 'machine' | 'organic' | 'algorithmic';

export type CodeId =
  | 'organic'
  | 'medina'
  | 'grid'
  | 'cosmic'
  | 'ideal'
  | 'grand'
  | 'garden'
  | 'tower'
  | 'field';

export type Range = [number, number];

/** A code = (T, R, P) plus the feasible region its rules leave for θ. */
export interface Code {
  id: CodeId;
  name: string;
  short: string;
  lynch: Lynch;
  T: string[]; // element types
  R: string[]; // relations
  P: string[]; // generative rules
  bounds: { O: Range; H: Range; G: Range; E?: Range };
  floorsMax: number;
  /** building depth range for perimeter codes (m); null = free-standing pavilions */
  depth: Range | null;
  pavilion?: { side: Range; gap: number };
  wall: boolean; // relation "building defines street"
  note: string;
}

export type Poly = [number, number][];

export interface Building {
  poly: Poly;
  floors: number;
  kind: 'fabric' | 'monument' | 'wall';
  w: number; // height weight (debug)
}

export interface Street {
  a: [number, number];
  b: [number, number];
  w: number;
  kind: 'local' | 'main' | 'axis';
}

export interface Lot {
  poly: Poly;
  kind: 'built' | 'open' | 'monument' | 'green';
}

export interface Measured extends Theta {
  wall: number; // street-wall continuity 0..1 (signature of R)
  phi: number; // Boeing φ on absolute bearings
  phiRel: number; // φ on bearings relative to the centre
  center: number; // T: 1 when the plan has a sacred or civic centre
  deadEnd: number; // T: share of street nodes that are cul-de-sacs
  court: number; // T: share of houses built around their own courtyard
}

export interface Knobs {
  a: number; // irregularity amplitude (drives O)
  k: number; // hierarchy strength (drives H)
}

export interface Model {
  code: CodeId;
  target: Theta;
  clamped: Theta;
  site: number; // side of the square window (m)
  siteArea: number;
  siteShape: 'square' | 'circle';
  radius: number;
  buildings: Building[];
  streets: Street[];
  lots: Lot[];
  measured: Measured;
  knobs: Knobs;
  error: number;
  errors: Record<Param, number>;
  cells: number;
}
