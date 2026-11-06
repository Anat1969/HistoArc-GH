import { PLACES } from '../data/places';
import wd from '../data/places_wd.json';
import measured from '../data/measured.json';

export interface Align {
  dx: number; // metres east
  dy: number; // metres north
  rot: number; // degrees, counter-clockwise
  scale: number;
}
export interface Place {
  lat: number;
  lon: number;
  note: string;
  source: 'calibration' | 'wikidata' | 'approx';
  align: Align;
  alignSource: 'saved' | 'streets' | 'none';
}

const WD = wd as Record<string, { lat: number; lon: number; label: string; item: string }>;
const M = measured as Record<string, { bearing?: number; name?: string }>;
const KEY = (id: number) => `histoarc.align.${id}`;

/** where a case sits on the map, and how the model is turned to meet it */
export function placeFor(caseId: number): Place | null {
  const base = PLACES[caseId];
  const w = WD[String(caseId)];
  if (!base && !w) return null;
  const calibrated = base?.note === 'נקודת הכיול' || base?.note.startsWith('נקודת הכיול');
  // Wikidata only when precise: a town item rounded to one decimal is worse than a named landmark point
  const dec = (x: number) => (String(x).split('.')[1] ?? '').length;
  const precise = !!w && dec(w.lat) >= 3 && dec(w.lon) >= 3;
  const p =
    calibrated || !w || !precise
      ? { lat: base!.lat, lon: base!.lon, note: base!.note, source: (calibrated ? 'calibration' : 'approx') as Place['source'] }
      : { lat: w.lat, lon: w.lon, note: `Wikidata: ${w.label}`, source: 'wikidata' as const };
  let align: Align = { dx: 0, dy: 0, rot: 0, scale: 1 };
  let alignSource: Place['alignSource'] = 'none';
  const b = M[String(caseId)]?.bearing;
  if (typeof b === 'number') {
    align = { ...align, rot: b > 45 ? b - 90 : b };
    alignSource = 'streets';
  }
  try {
    const raw = localStorage.getItem(KEY(caseId));
    if (raw) {
      align = { ...align, ...JSON.parse(raw) };
      alignSource = 'saved';
    }
  } catch {
    /* storage blocked: defaults stand */
  }
  return { ...p, align, alignSource };
}

export function saveAlign(caseId: number, a: Align) {
  try {
    localStorage.setItem(KEY(caseId), JSON.stringify(a));
    return true;
  } catch {
    return false;
  }
}
export function clearAlign(caseId: number) {
  try {
    localStorage.removeItem(KEY(caseId));
  } catch {
    /* ignore */
  }
}

/** a static satellite picture of the site itself (Esri World Imagery export, no key needed) */
export function satelliteUrl(lat: number, lon: number, halfMetres: number, w = 640, h = 480) {
  const dLat = halfMetres / 110540;
  const dLon = (halfMetres * (w / h)) / (111320 * Math.cos((lat * Math.PI) / 180));
  const bbox = [lon - dLon, lat - dLat, lon + dLon, lat + dLat].join(',');
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${bbox}&bboxSR=4326&imageSR=3857&size=${w},${h}&format=jpg&f=image`;
}
