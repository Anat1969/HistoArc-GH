import type { CodeId, Theta } from '../engine/types';
import { CODE, CODE_T } from '../engine/codes';
import measuredJson from './measured.json';

export interface Case {
  id: number;
  he: string;
  orig: string;
  period: string;
  year: number; // representative year for sorting (negative = BCE)
  paradigm: string;
  scale: 'city' | 'building';
  code: CodeId; // primary code [ה]
  hybrid?: CodeId; // second code for hybrids [ה]
  theta: Theta | null; // null for building-scale cases in this version
  assessed?: Theta; // the spec's assessment, kept when a measured value replaces it
  measuredYear?: number;
  measureNote?: string;
  wallOverride?: boolean; // documented street wall when it differs from the primary code [ה]
  tOverride?: Partial<{ center: boolean; deadEnd: boolean; court: boolean }>;
  gNote?: string;
  commons: string;
  status: 'built' | 'unbuilt' | 'demolished' | 'living';
}

const C = 'https://commons.wikimedia.org/wiki/Category:';

/**
 * 35 cases from the research spec, section 8. All values are initial assessments [ה],
 * to be calibrated by the offline pipeline (OSMnx, momepy, depthmapX).
 * G for non-square blocks is the geometric mean of the two sides [ה].
 */
export const CASES: Case[] = [
  { id: 1, he: 'מוהנג\'ו-דארו', orig: 'Mohenjo-daro, موئن جو دڙو', period: 'כ-2500 לפנה"ס', year: -2500, paradigm: 'קוסמי מוקדם, רשת', scale: 'city', code: 'cosmic', theta: { O: 0.7, I: 1.0, E: 0.6, H: 0.5, G: 200 }, commons: C + 'Mohenjo-daro', status: 'built' },
  { id: 2, he: 'בבל', orig: 'Babylon, Bābili', period: 'מאה 6 לפנה"ס', year: -575, paradigm: 'קוסמי, ציר תהלוכה', scale: 'city', code: 'cosmic', theta: { O: 0.5, I: 0.8, E: 0.6, H: 0.8, G: 150 }, commons: C + 'Babylon', status: 'built' },
  { id: 3, he: 'מילטוס', orig: 'Miletus, Μίλητος', period: 'מאה 5 לפנה"ס', year: -479, paradigm: 'רשת היפודמית', scale: 'city', code: 'grid', theta: { O: 0.85, I: 0.6, E: 0.55, H: 0.4, G: 30 }, commons: C + 'Miletus', status: 'built' },
  { id: 4, he: 'טאוטיהואקאן', orig: 'Teotihuacan, Teōtīhuācān', period: '100–550', year: 100, paradigm: 'קוסמי, ציר', scale: 'city', code: 'cosmic', theta: { O: 0.6, I: 0.4, E: 0.4, H: 0.95, G: 60 }, commons: C + 'Teotihuacan', status: 'built' },
  { id: 5, he: 'רומא הקיסרית', orig: 'Roma', period: 'מאה 2', year: 150, paradigm: 'אורגני ומונומנטלי', scale: 'city', code: 'organic', theta: { O: 0.2, I: 2.0, E: 0.7, H: 0.6, G: 70 }, commons: C + 'Nolli_Map', status: 'built' },
  { id: 6, he: 'צ\'אנג-אן', orig: 'Chang\'an, 長安', period: '582–904', year: 582, paradigm: 'קוסמי, רשת מוקפת חומה', scale: 'city', code: 'cosmic', theta: { O: 0.95, I: 0.3, E: 0.35, H: 0.95, G: 500 }, gNote: '500+', commons: C + "Chang'an", status: 'built' },
  { id: 7, he: 'הייאן-קיו (קיוטו)', orig: 'Heian-kyō, 平安京', period: '794', year: 794, paradigm: 'קוסמי, רשת', scale: 'city', code: 'cosmic', theta: { O: 0.95, I: 0.3, E: 0.4, H: 0.9, G: 120 }, commons: C + 'Heian-kyō', status: 'built' },
  { id: 8, he: 'פאס אל-באלי', orig: 'Fès el-Bali, فاس البالي', period: 'מאה 9 ואילך', year: 850, paradigm: 'אורגני, מדינה', scale: 'city', code: 'medina', theta: { O: 0.05, I: 1.5, E: 0.85, H: 0.5, G: 50 }, commons: C + 'Medina_of_Fez', status: 'living' },
  { id: 9, he: 'עכו העתיקה', orig: 'Akko, عكا', period: 'צלבני ועות\'מאני', year: 1200, paradigm: 'אורגני, מדינה', scale: 'city', code: 'medina', theta: { O: 0.1, I: 1.5, E: 0.8, H: 0.5, G: 50 }, commons: C + 'Acre,_Israel', status: 'living' },
  { id: 10, he: 'סיינה', orig: 'Siena', period: 'מאות 13–14', year: 1300, paradigm: 'אורגני, קומונה', scale: 'city', code: 'organic', theta: { O: 0.15, I: 1.8, E: 0.75, H: 0.7, G: 60 }, commons: C + 'Siena', status: 'living' },
  { id: 11, he: 'מונפזייה', orig: 'Monpazier', period: '1284', year: 1284, paradigm: 'רשת, בסטיד', scale: 'city', code: 'grid', theta: { O: 0.85, I: 0.6, E: 0.55, H: 0.5, G: 57 }, gNote: '40×80', commons: C + 'Monpazier', status: 'living' },
  { id: 12, he: 'פלמנובה', orig: 'Palmanova', period: '1593', year: 1593, paradigm: 'עיר אידיאלית, רדיאלית', scale: 'city', code: 'ideal', theta: { O: 0.9, I: 0.5, E: 0.45, H: 1.0, G: 80 }, commons: C + 'Palmanova', status: 'living' },
  { id: 13, he: 'רומא של סיקסטוס החמישי', orig: 'Roma', period: '1585–1590', year: 1585, paradigm: 'הסגנון הגדול, צירים בארוקיים', scale: 'city', code: 'grand', hybrid: 'organic', theta: { O: 0.35, I: 2.0, E: 0.7, H: 0.85, G: 70 }, commons: C + 'Nolli_Map', status: 'living' },
  { id: 14, he: 'ורסאי', orig: 'Versailles', period: '1661–1710', year: 1661, paradigm: 'הסגנון הגדול, אבסולוטיזם', scale: 'city', code: 'cosmic', hybrid: 'grand', theta: { O: 0.85, I: 0.2, E: 0.15, H: 1.0, G: 300 }, commons: C + 'Plans_of_the_Palace_of_Versailles', status: 'living' },
  { id: 15, he: 'כיכר נקש-ה-ג\'האן, אספהאן', orig: 'Naqsh-e Jahan, نقش جهان', period: '1598 ואילך', year: 1598, paradigm: 'מדינה עם מרחב מלכותי מתוכנן', scale: 'city', code: 'grand', hybrid: 'organic', theta: { O: 0.6, I: 1.2, E: 0.7, H: 0.9, G: 60 }, commons: C + 'Naqsh-e_Jahan_Square', status: 'living' },
  { id: 16, he: 'ג\'איפור', orig: 'Jaipur, जयपुर', period: '1727', year: 1727, paradigm: 'קוסמי (ואסטו), תשעה ריבועים', scale: 'city', code: 'cosmic', theta: { O: 0.85, I: 1.2, E: 0.7, H: 0.8, G: 700 }, commons: C + 'Jaipur', status: 'living' },
  { id: 17, he: 'תוכנית הנציבים, מנהטן', orig: "Commissioners' Plan, Manhattan", period: '1811', year: 1811, paradigm: 'מכונה, רשת', scale: 'city', code: 'grid', theta: { O: 0.95, I: 5.0, E: 0.6, H: 0.5, G: 148 }, gNote: '80×274', commons: C + "Commissioners'_Plan_of_1811", status: 'living' },
  { id: 18, he: 'פריז של האוסמן', orig: 'Paris', period: '1853–1870', year: 1853, paradigm: 'הסגנון הגדול, רפורמה', scale: 'city', code: 'grand', theta: { O: 0.45, I: 3.5, E: 0.75, H: 0.8, G: 110 }, commons: C + "Haussmann's_renovation_of_Paris", status: 'living' },
  { id: 19, he: 'אישאמפלה של סרדה, ברצלונה', orig: 'Eixample, Barcelona', period: '1859', year: 1859, paradigm: 'מכונה, רשת היגיינית', scale: 'city', code: 'grid', theta: { O: 0.95, I: 3.5, E: 0.65, H: 0.3, G: 113 }, commons: C + 'Eixample', status: 'living' },
  { id: 20, he: 'לצ\'וורת\'', orig: 'Letchworth Garden City', period: '1903', year: 1903, paradigm: 'אורגני, עיר גנים', scale: 'city', code: 'garden', theta: { O: 0.3, I: 0.3, E: 0.2, H: 0.6, G: 150 }, commons: C + 'Letchworth_Garden_City', status: 'living' },
  { id: 21, he: 'נהלל', orig: 'Nahalal', period: '1921', year: 1921, paradigm: 'קוסמי, מושב רדיאלי', scale: 'city', code: 'ideal', hybrid: 'garden', wallOverride: false, theta: { O: 0.85, I: 0.05, E: 0.03, H: 0.95, G: 400 }, commons: C + 'Nahalal', status: 'living' },
  { id: 22, he: 'תל אביב, תוכנית גדס', orig: 'Tel Aviv, Geddes Plan', period: '1925–1927', year: 1925, paradigm: 'אורגני-מדעי, עיר גנים', scale: 'city', code: 'garden', theta: { O: 0.6, I: 1.4, E: 0.4, H: 0.5, G: 200 }, commons: C + 'White_City_(Tel_Aviv)', status: 'living' },
  { id: 23, he: 'בניין הבאוהאוס, דסאו', orig: 'Bauhaus, Dessau', period: '1925–1926', year: 1925, paradigm: 'מודרניזם (קנה מבנה)', scale: 'building', code: 'tower', theta: null, commons: C + 'Bauhaus_Dessau', status: 'built' },
  { id: 24, he: 'העיר הקורנת', orig: 'Ville Radieuse', period: '1930 (לא נבנתה)', year: 1930, paradigm: 'מכונה, מגדל בפארק', scale: 'city', code: 'tower', theta: { O: 0.95, I: 2.5, E: 0.12, H: 0.7, G: 400 }, commons: C + 'Ville_Radieuse', status: 'unbuilt' },
  { id: 25, he: 'ברודאייקר סיטי', orig: 'Broadacre City', period: '1932–1935 (לא נבנתה)', year: 1932, paradigm: 'מכונה מפוזרת', scale: 'city', code: 'tower', hybrid: 'garden', theta: { O: 0.95, I: 0.05, E: 0.03, H: 0.1, G: 1600 }, commons: C + 'Broadacre_City', status: 'unbuilt' },
  { id: 26, he: 'צ\'נדיגר', orig: 'Chandigarh, ਚੰਡੀਗੜ੍ਹ', period: '1951 ואילך', year: 1951, paradigm: 'מכונה עם ראש קוסמי', scale: 'city', code: 'tower', hybrid: 'cosmic', theta: { O: 0.9, I: 0.6, E: 0.25, H: 0.85, G: 980 }, gNote: '800×1200', commons: C + 'Chandigarh', status: 'living' },
  { id: 27, he: 'אשדוד', orig: 'Ashdod', period: '1956 ואילך', year: 1956, paradigm: 'עיר חדשה, יחידת שכונה', scale: 'city', code: 'tower', theta: { O: 0.5, I: 1.0, E: 0.2, H: 0.6, G: 800 }, commons: C + 'Ashdod', status: 'living' },
  { id: 28, he: 'ברזיליה, הפלאנו פילוטו', orig: 'Brasília, Plano Piloto', period: '1957 ואילך', year: 1957, paradigm: 'מכונה עם ציר קוסמי', scale: 'city', code: 'tower', hybrid: 'cosmic', theta: { O: 0.6, I: 0.6, E: 0.15, H: 0.95, G: 280 }, commons: C + 'Plano_Piloto', status: 'living' },
  { id: 29, he: 'באר שבע, שיכון לדוגמה', orig: "Be'er Sheva", period: '1959–1964 [נ]', year: 1960, paradigm: 'שטיח בנייה, מודרניזם מאוחר', scale: 'city', code: 'grid', theta: { O: 0.7, I: 0.8, E: 0.5, H: 0.3, G: 30 }, commons: C + 'Beersheba', status: 'living' },
  { id: 30, he: 'מגדל הקפסולות נאקאגין', orig: 'Nakagin Capsule Tower, 中銀カプセルタワー', period: '1972 (נהרס 2022)', year: 1972, paradigm: 'מטבוליזם', scale: 'building', code: 'tower', theta: null, commons: C + 'Nakagin_Capsule_Tower', status: 'demolished' },
  { id: 31, he: 'סיסייד, פלורידה', orig: 'Seaside, Florida', period: '1980 ואילך', year: 1980, paradigm: 'אורבניזם חדש', scale: 'city', code: 'grid', theta: { O: 0.5, I: 0.4, E: 0.3, H: 0.7, G: 70 }, commons: C + 'Seaside,_Florida', status: 'living' },
  { id: 32, he: 'דהראווי, מומבאי', orig: 'Dharavi, धारावी', period: 'מאה 20', year: 1950, paradigm: 'אורגני בלתי-פורמלי', scale: 'city', code: 'organic', theta: { O: 0.1, I: 1.5, E: 0.9, H: 0.2, G: 20 }, commons: C + 'Dharavi', status: 'living' },
  { id: 33, he: 'מצדר', orig: 'Masdar City, مدينة مصدر', period: '2008 ואילך', year: 2008, paradigm: 'אקולוגי-טכנולוגי, מדינה מחודשת', scale: 'city', code: 'grid', hybrid: 'organic', theta: { O: 0.8, I: 2.5, E: 0.6, H: 0.5, G: 50 }, commons: C + 'Masdar_City', status: 'living' },
  { id: 34, he: 'מרכז היידר אלייב, באקו', orig: 'Heydar Aliyev Center, Bakı', period: '2007–2012', year: 2007, paradigm: 'פרמטריציזם (קנה מבנה)', scale: 'building', code: 'field', theta: null, commons: C + 'Heydar_Aliyev_Center', status: 'built' },
  { id: 35, he: 'אשדוד, טבעות והמע"ר הימי', orig: 'Ashdod', period: 'שנות ה-2020', year: 2022, paradigm: 'עירוניות מחודשת', scale: 'city', code: 'grid', hybrid: 'tower', theta: { O: 0.5, I: 2.5, E: 0.35, H: 0.7, G: 120 }, commons: '', status: 'living' },
];

/**
 * Calibration overlay: values measured from OpenStreetMap by pipeline/calibrate.py (GitHub Actions)
 * replace the assessed O, I, E, G. H stays an assessment until depthmapX is run.
 */
interface MeasuredRow {
  O?: number;
  I?: number;
  E?: number;
  G?: number;
  G_art?: number;
  wall?: number;
  error?: string;
  state_year?: number;
}
const MEASURED = measuredJson as Record<string, MeasuredRow>;
for (const c of CASES) {
  const m = MEASURED[String(c.id)];
  if (!c.theta || !m || m.error || m.O === undefined) continue;
  // incomplete building data: OSM maps less than half the assessed coverage, keep the assessment
  if (m.E !== undefined && m.E < 0.5 * c.theta.E) {
    c.measureNote = `נתוני מבנים חסרים ב-OpenStreetMap (GSI נמדד ${m.E}). נשארה ההערכה.`;
    continue;
  }
  c.assessed = { ...c.theta };
  // superblock codes are defined by their arterial mesh: their grain is measured on arterials only [ה]
  const G = CODE[c.code].id === 'tower' && m.G_art ? m.G_art : (m.G ?? c.theta.G);
  c.theta = { ...c.theta, O: m.O, I: m.I ?? c.theta.I, E: m.E ?? c.theta.E, G };
  c.measuredYear = m.state_year;
}

export const CITY_CASES = CASES.filter((c) => c.theta);

/** relation R: does the building define the street (street wall) in this case? */
export const caseWall = (c: Case) => c.wallOverride ?? CODE[c.code].wall;

/** documented element types T of a case: the primary code's signature unless the case says otherwise [ה] */
export const caseT = (c: Case) => ({ ...CODE_T[c.code], ...(c.tOverride ?? {}) });
export const caseById = (id: number) => CASES.find((c) => c.id === id);

export interface Transition {
  id: string;
  label: string;
  from: CodeId;
  to: number; // case id that represents the new paradigm
  doc: 'evolution' | 'hybrid' | 'revolution' | 'restoration';
  docNote: string;
}

/** The paradigm transitions of spec section 9, each tested on one representative case [ה]. */
export const TRANSITIONS: Transition[] = [
  { id: 't1', label: 'התיישבות אורגנית ← עיר קוסמית', from: 'organic', to: 1, doc: 'revolution', docNote: 'נוסף ציר ומרכז קדוש, והטלה מלמעלה' },
  { id: 't2', label: 'עיר קוסמית ← רשת היפודמית', from: 'cosmic', to: 3, doc: 'revolution', docNote: 'מהפכה חלקית: ההיררכיה עוברת לחלוקה שוויונית' },
  { id: 't3', label: 'רומא ← מדינה איסלאמית', from: 'organic', to: 8, doc: 'revolution', docNote: 'נוסף רחוב ללא מוצא וחצר פנימית' },
  { id: 't4', label: 'ימי הביניים ← עיר אידיאלית', from: 'organic', to: 12, doc: 'hybrid', docNote: 'הגיאומטריה הופכת לתוכן, יחס הבית לרחוב נשמר' },
  { id: 't5', label: 'רנסנס ← בארוק', from: 'ideal', to: 13, doc: 'evolution', docNote: 'הציר המונומנטלי הופך לכלל יוצר' },
  { id: 't6', label: 'בארוק ← האוסמן', from: 'grand', to: 18, doc: 'evolution', docNote: 'עלייה בעוצמה, היחס מבנה-רחוב נשמר' },
  { id: 't7', label: 'רשת היפודמית ← סרדה', from: 'grid', to: 19, doc: 'evolution', docNote: 'הרשת כאיזוטרופיה כלכלית' },
  { id: 't8', label: 'העיר התעשייתית ← עיר גנים', from: 'grid', to: 20, doc: 'revolution', docNote: 'מהפכה מתונה: חגורה ירוקה ויחידת שכונה' },
  { id: 't9', label: 'העיר המסורתית ← מודרניזם', from: 'grid', to: 24, doc: 'revolution', docNote: 'בוטל רחוב-המסדרון, הפרדת שימושים' },
  { id: 't10', label: 'מודרניזם ← אורבניזם חדש', from: 'tower', to: 31, doc: 'restoration', docNote: 'שוחזרו T ו-R של העיר המסורתית' },
  { id: 't11', label: 'אשדוד 1956 ← אשדוד היום', from: 'tower', to: 35, doc: 'restoration', docNote: 'טענת המחקר: חזרת "המבנה מגדיר רחוב"' },
];

export const DOC_TYPE: Record<Transition['doc'], { he: string; color: string }> = {
  evolution: { he: 'אבולוציה', color: 'var(--evo)' },
  hybrid: { he: 'הכלאה', color: 'var(--hyb)' },
  revolution: { he: 'מהפכה', color: 'var(--rev)' },
  restoration: { he: 'רסטורציה', color: 'var(--res)' },
};
