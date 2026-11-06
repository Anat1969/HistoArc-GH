/**
 * Turns saved alternatives into readable Hebrew documents. Every sentence is built from the
 * alternatives' actual values; interpretations carry their status and source.
 */
import type { Alternative, OutputType } from './store';
import { LENSES, PARAM_DOC, STATUS, type Lens, type Snapshot } from '../data/knowledge';
import { CODE, R_LABEL } from '../engine/codes';
import { caseById } from '../data/cases';
import { FIT_THRESHOLD } from '../engine/measure';
import type { Param, Scale } from '../engine/types';

const P: Param[] = ['O', 'I', 'E', 'H', 'G'];
const PNAME: Record<Param, string> = { O: 'סדר', I: 'עוצמה', E: 'סגירות', H: 'היררכיה', G: 'גרעין' };

export const fmtP = (p: Param, v: number) => (p === 'G' ? `${v < 15 ? v.toFixed(1) : Math.round(v)} מ'` : p === 'I' ? v.toFixed(2) : v.toFixed(2));

export function lensValues(scale: Scale, m: Snapshot) {
  return LENSES[scale].map((l) => {
    const v = l.value(m);
    return { lens: l, v, text: l.fmt(v), read: l.read(v) };
  });
}

/** plain-language effect of one lens moving from a to b */
export function lensShift(l: Lens, a: number, b: number): { dir: 'up' | 'down' | 'same'; good: boolean | null; text: string } {
  const rel = Math.abs(b - a) / Math.max(Math.abs(a), 1e-3);
  if (rel < 0.05) return { dir: 'same', good: null, text: 'כמעט ללא שינוי' };
  const dir = b > a ? 'up' : 'down';
  let good: boolean | null = null;
  if (l.better === 'up') good = dir === 'up';
  if (l.better === 'down') good = dir === 'down';
  if (l.better === 'mid' && l.id === 'scale') good = b <= 5 ? true : a > 5 && b < a ? true : false;
  return { dir, good, text: `${l.fmt(a)} ← ${l.fmt(b)}: ${l.read(b)}` };
}

/** explain what changed between two parameter sets, with the joint effect */
export function explainChange(scale: Scale, base: Snapshot, now: Snapshot) {
  const doc = PARAM_DOC[scale];
  const changed = P.filter((p) => Math.abs(now[p] - base[p]) / Math.max(Math.abs(base[p]), 0.01) > 0.03);
  const lines = changed.map((p) => {
    const up = now[p] > base[p];
    return `${PNAME[p]} ${up ? 'עלה' : 'ירד'} (${fmtP(p, base[p])} ← ${fmtP(p, now[p])}): ${up ? doc[p].up : doc[p].down}`;
  });
  let joint = '';
  if (scale === 'city' && changed.length >= 2) {
    const fl0 = base.I / Math.max(base.E, 0.01);
    const fl1 = now.I / Math.max(now.E, 0.01);
    if (now.I > base.I && now.E < base.E) joint = `צפיפות עולה על פחות קרקע: הקומות קופצות מ-${fl0.toFixed(1)} ל-${fl1.toFixed(1)}. יותר שטח פתוח, אבל הבניינים מתרחקים מהרחוב.`;
    else if (now.I > base.I && now.E >= base.E) joint = `צפיפות עולה וגם הכיסוי: עיר קומפקטית ונמוכה יחסית (${fl1.toFixed(1)} קומות), אבל פחות שטח פתוח.`;
    else if (now.G > base.G && now.E < base.E) joint = 'בלוקים גדולים וכיסוי נמוך: אופי של בלוק-על ומבנים בפארק.';
    else if (now.O < base.O && now.G < base.G) joint = 'פחות סדר וגרעין קטן: רקמה של סמטאות צפופות.';
    else joint = 'השינויים פועלים יחד; השוו את העדשות למטה כדי לראות את הפשרה.';
  }
  return { changed, lines, joint };
}

function fitWord(a: Alternative) {
  if (a.fit === 'free') return 'ערכים חופשיים';
  if (a.error > FIT_THRESHOLD) return `מחוץ לתחום של הקוד (שגיאה ${a.error.toFixed(3)})`;
  return `בתוך הקוד (שגיאה ${a.error.toFixed(3)})`;
}

function altHeader(a: Alternative) {
  const c = caseById(a.caseId);
  return `**${a.name}**: ${c?.he ?? 'אתר חופשי'}, קוד ${CODE[a.code].name}. ${fitWord(a)}.`;
}

function pros(a: Alternative, all: Alternative[]) {
  const out: { pro: string[]; con: string[] } = { pro: [], con: [] };
  for (const l of LENSES[a.scale]) {
    const vals = all.map((x) => l.value(x.measured));
    const v = l.value(a.measured);
    const best = l.better === 'down' ? Math.min(...vals) : Math.max(...vals);
    const worst = l.better === 'down' ? Math.max(...vals) : Math.min(...vals);
    if (all.length < 2 || l.better === 'mid') {
      if (l.id === 'scale') (v <= 5 ? out.pro : out.con).push(`${l.he}: ${l.fmt(v)} (${l.read(v)})`);
      continue;
    }
    if (v === best && best !== worst) out.pro.push(`${l.he}: ${l.fmt(v)}, הגבוה בחלופות`);
    if (v === worst && best !== worst) out.con.push(`${l.he}: ${l.fmt(v)}, הנמוך בחלופות`);
  }
  return out;
}

const date = () => new Date().toLocaleDateString('he-IL');

function sourcesBlock(scale: Scale) {
  const ls = LENSES[scale].map((l) => `- ${l.he}: ${l.source} (${STATUS[l.status].he})`);
  return ['## מקורות ומעמד הידע', ...ls, '- הערכים, הקודים והמחולל: האפיון המחקרי "קוד העיר"; Spacematrix 2010; Boeing 2019.', '- תוצאות המודל הן תוצאות של מודל מופשט, לא מדידה של עיר אמיתית.'].join('\n');
}

export function generate(type: OutputType, alts: Alternative[]): { title: string; body: string } {
  const scale = alts[0]?.scale ?? 'city';
  const lenses = LENSES[scale];
  if (!alts.length) return { title: 'אין חלופות', body: 'שמרו לפחות חלופה אחת במעבדה.' };
  const table = [
    `| | ${alts.map((a) => a.name).join(' | ')} |`,
    `|---|${alts.map(() => '---').join('|')}|`,
    ...P.map((p) => `| ${PNAME[p]} | ${alts.map((a) => fmtP(p, a.measured[p])).join(' | ')} |`),
    `| ${R_LABEL[scale]} | ${alts.map((a) => (scale === 'city' ? `${Math.round(a.measured.wall * 100)}%` : a.measured.wall >= 0.5 ? 'כן' : 'לא')).join(' | ')} |`,
    ...lenses.map((l) => `| ${l.he} | ${alts.map((a) => l.fmt(l.value(a.measured))).join(' | ')} |`),
  ].join('\n');

  if (type === 'insights') {
    const items = alts.map((a) => {
      const lv = lensValues(scale, a.measured);
      return [`### ${a.name}`, altHeader(a), ...lv.map((x) => `- ${x.lens.he}: **${x.text}**. ${x.read}.`), a.note ? `- הערה: ${a.note}` : ''].filter(Boolean).join('\n');
    });
    const best = lenses.map((l) => {
      if (alts.length < 2 || l.better === 'mid') return '';
      const s = [...alts].sort((x, y) => l.value(y.measured) - l.value(x.measured));
      const top = l.better === 'down' ? s[s.length - 1] : s[0];
      return `- **${l.he}**: הטובה ביותר היא "${top.name}" (${l.fmt(l.value(top.measured))}).`;
    });
    return {
      title: `תקציר תובנות · ${date()}`,
      body: [
        `# תקציר תובנות`,
        `נכתב מתוך ${alts.length} חלופות שנשמרו במעבדה.`,
        '',
        '## מה למדנו',
        ...best.filter(Boolean),
        alts.some((a) => a.fit !== 'free' && a.error > FIT_THRESHOLD) ? '- לפחות חלופה אחת יוצאת מתחום הקוד שלה: כדי לממש אותה צריך כלל או יחס אחר, לא רק ערך אחר.' : '- כל החלופות נמצאות בתוך הקוד שלהן: ההבדלים ביניהן הם כוונון, לא מהפכה.',
        '',
        '## החלופות',
        ...items,
        '',
        '## מה עדיין איננו יודעים',
        '- העדשות של חיי היומיום הן קריאה של צורה, לא מדידה של התנהגות. כדי לדעת אם אנשים נפגשים יותר צריך תצפית או סקר.',
        '- הערכים של מקרים היסטוריים הם הערכות, אלא אם סומנו כנמדדים.',
        '',
        '## מה כדאי לעשות עכשיו',
        '- לבחור את החלופה המבטיחה ולבדוק אותה על המפה של האתר.',
        '- להוסיף חלופה של גישה אחרת מתוך מאגר האדריכלים ולהשוות.',
        '',
        sourcesBlock(scale),
      ].join('\n'),
    };
  }

  if (type === 'compare') {
    const pc = alts.map((a) => {
      const { pro, con } = pros(a, alts);
      return [`### ${a.name}`, altHeader(a), '**יתרונות**', ...(pro.length ? pro.map((x) => `- ${x}`) : ['- אין יתרון בולט בעדשות']), '**חסרונות**', ...(con.length ? con.map((x) => `- ${x}`) : ['- אין חיסרון בולט בעדשות'])].join('\n');
    });
    const sameDensity = alts.length >= 2 && Math.abs(alts[0].measured.I - alts[1].measured.I) / Math.max(alts[0].measured.I, 0.01) < 0.15;
    const diffCode = alts.length >= 2 && alts[0].code !== alts[1].code;
    return {
      title: `השוואת חלופות · ${date()}`,
      body: [
        '# השוואת חלופות',
        '',
        '## הטבלה',
        table,
        '',
        '## הפשרה המרכזית',
        sameDensity && diffCode
          ? `"${alts[0].name}" ו-"${alts[1].name}" מגיעות לצפיפות דומה (${alts[0].measured.I.toFixed(2)} מול ${alts[1].measured.I.toFixed(2)}) בשני קודים שונים. ההבדל ביניהן אינו בכמות אלא ביחס: ${R_LABEL[scale]}. זו בחירה בקוד, לא בתקן.`
          : 'החלופות שונות גם בכמות וגם בצורה. כדי לבודד את השפעת הקוד, כדאי ליצור חלופה נוספת באותה צפיפות.',
        '',
        ...pc,
        '',
        '## על מה זה מבוסס',
        'כל הערכים נמדדו מהמודל שנבנה לכל חלופה. היתרונות והחסרונות נקבעים לפי העדשות של חיי היומיום, שהן פרשנות על סמך הספרות.',
        '',
        sourcesBlock(scale),
      ].join('\n'),
    };
  }

  if (type === 'article') {
    const a0 = alts[0];
    const a1 = alts[1];
    const claim = a1
      ? `אותה עיר יכולה להיבנות בשני קודים, והבחירה ביניהם משנה את חיי היומיום יותר מהבחירה בצפיפות.`
      : `הצורה של ${caseById(a0.caseId)?.he ?? 'האתר'} היא תוצאה של קוד, ולא רק של מספרים.`;
    return {
      title: `מאמר · ${a0.name}${a1 ? ` מול ${a1.name}` : ''}`,
      body: [
        `# ${claim}`,
        '',
        '> "In a sense that I am unable to explicate further, the proponents of competing paradigms practice their trades in different worlds." (Kuhn, 1970, p. 150)',
        '',
        '## הטענה',
        claim,
        'המאמר "קוד העיר" מציע לתאר כל עיר כקוד: סוגי אלמנטים, יחסים וכללים, ועוד חמישה ערכים. שינוי בערכים הוא אבולוציה; שינוי ביחס או באלמנט הוא מהפכה.',
        '',
        '## הדוגמה',
        ...alts.map((a) => `${altHeader(a)} ${lensValues(scale, a.measured).map((x) => `${x.lens.he}: ${x.text}`).join('; ')}.`),
        '',
        '## מה זה אומר',
        a1
          ? `ההשוואה מראה ש${a0.code === a1.code ? 'גם באותו קוד' : 'בשני קודים שונים'} אפשר להגיע לתוצאה ${Math.abs(a0.measured.I - a1.measured.I) < 0.3 ? 'דומה בכמות' : 'שונה בכמות'}, אבל לא לאותה עיר. ${R_LABEL[scale]}: ${a0.measured.wall >= 0.5 ? 'כן' : 'לא'} בחלופה הראשונה, ${a1.measured.wall >= 0.5 ? 'כן' : 'לא'} בשנייה.`
          : 'הערכים לבדם אינם מסבירים את העיר. מה שמבדיל הוא היחס בין הבניין לרחוב.',
        'לפי ג\'ייקובס (1961) וגהל (2010), רחוב שהבניינים פונים אליו תומך במפגש ובביטחון. זו פרשנות על סמך הספרות, ולא תוצאה של המודל.',
        '',
        '## מגבלות',
        '- המודל מופשט: אין בו שימושי קרקע, אקלים, מחירים ואנשים.',
        '- הערכים של מקרים היסטוריים הם הערכות, אלא אם סומנו כנמדדים.',
        '',
        '## מה הלאה',
        '- לבדוק את החלופה המועדפת על המפה של האתר.',
        '- לאסוף נתוני שימוש (ספירת הולכי רגל, סקר תחושת ביטחון) כדי לבחון את הפרשנות.',
        '',
        '*אותם מספרים,*  ',
        '*רשת אבן ומגדל.*  ',
        '*הרחוב נעלם.*',
        '',
        sourcesBlock(scale),
      ].join('\n'),
    };
  }

  if (type === 'principles') {
    const best = [...alts].sort((x, y) => (y.measured.wall - x.measured.wall) || (y.measured.E - x.measured.E))[0];
    const fl = best.measured.I / Math.max(best.measured.E, 0.01);
    const lines =
      scale === 'city'
        ? [
            `1. **הבניין מגדיר את הרחוב.** קו בניין לרחוב בלפחות ${Math.max(60, Math.round(best.measured.wall * 100))}% מהחזית. (מבוסס על "${best.name}"; פרשנות לפי Jacobs 1961)`,
            `2. **קנה מידה אנושי.** גובה ממוצע סביב ${fl.toFixed(1)} קומות${fl > 5 ? ', ומעליו נסיגה מהחזית' : ''}. (Gehl 2010)`,
            `3. **בלוקים קצרים.** גרעין של כ-${Math.round(best.measured.G)} מ', כלומר כ-${Math.round((1000 / best.measured.G) ** 2)} בלוקים לקמ"ר.`,
            `4. **שטח פתוח שמור.** כיסוי של עד ${Math.round(best.measured.E * 100)}% מהקרקע; ${Math.round((1 - best.measured.E) * 100)}% פתוח לצמחייה, למים ולמפגש. (McHarg 1969)`,
            '5. **שינוי ערכים לפני שינוי קוד.** קודם לכוונן צפיפות וכיסוי בתוך הקוד הקיים; לעבור לקוד אחר רק כשהמטרה דורשת יחס חדש.',
          ]
        : [
            `1. **אור ומבט.** פתחים בכ-${Math.round((1 - best.measured.E) * 100)}% מהחזית.`,
            `2. **חלל משותף.** ${best.measured.H > 0.5 ? 'חלל מרכזי שמכנס את כולם' : 'חללים שווים, בלי מרכז מחייב'}.`,
            `3. **גמישות.** ${best.measured.wall < 0.5 ? 'שלד נושא וקירות חופשיים, כך שאפשר לשנות חלוקה' : 'קירות נושאים: יציבות ומסה, על חשבון גמישות'}. (Habraken 1961)`,
            `4. **מודול אנושי.** מפתח של כ-${best.measured.G.toFixed(1)} מ'.`,
          ];
    return {
      title: `מסמך עקרונות · ${date()}`,
      body: ['# מסמך עקרונות לתכנון', `נגזר מהחלופה "${best.name}" ומ-${alts.length} חלופות שנבחנו.`, '', ...lines, '', '## מעמד', 'אלה המלצות שנגזרות ממודל ומפרשנות של הספרות. הן נקודת פתיחה לדיון, לא תקן.', '', sourcesBlock(scale)].join('\n'),
    };
  }

  // questions
  const qs = [
    alts.some((a) => a.error > FIT_THRESHOLD && a.fit !== 'free') ? '- חלופה יוצאת מתחום הקוד: איזה כלל או יחס חדש נדרש כדי לממש אותה, ומי צריך לקבוע אותו?' : '',
    alts.length >= 2 && alts[0].code !== alts[1].code ? `- האם תושבים בחלופה "${alts[0].name}" נפגשים ברחוב יותר מאשר ב-"${alts[1].name}"? (ספירת הולכי רגל, סקר)` : '',
    '- האם ערכי ההערכה של המקרים ההיסטוריים עומדים במדידה? (הרצת הכיול על מקרים נוספים)',
    '- איך אקלים חם משנה את העדיפות בין רחוב מוצל (סגירות גבוהה) לבין שטח פתוח?',
    '- מה ההשפעה של שימושים מעורבים בקומת הקרקע, שאינם במודל?',
    scale === 'city' ? '- היכן באשדוד הרחוב כבר מוגדר, והיכן מגדלים בפארק? (מיפוי דופן הרחוב לפי רובע)' : '- האם שלד חופשי באמת הוביל לשינויי חלוקה לאורך השנים? (סקר בניינים קיימים)',
  ].filter(Boolean);
  return {
    title: `שאלות מחקר · ${date()}`,
    body: ['# שאלות מחקר והצעות לבדיקה', `נגזרו מ-${alts.length} חלופות.`, '', ...qs, '', '## איך לבדוק', '- השערה צורנית: במודל, בהשוואת חלופות באותה צפיפות.', '- השערה על חיי היומיום: מחוץ למודל, בתצפית, סקר ונתוני תנועה.', '', sourcesBlock(scale)].join('\n'),
  };
}

export const OUTPUT_LABEL: Record<OutputType, { he: string; what: string }> = {
  insights: { he: 'תקציר תובנות', what: 'מה למדנו מכל חלופה, עם הסבר ומקורות' },
  compare: { he: 'השוואת חלופות', what: 'טבלה, יתרונות, חסרונות והפשרה המרכזית' },
  article: { he: 'מאמר', what: 'טענה, דוגמה, משמעות ומגבלות' },
  principles: { he: 'מסמך עקרונות', what: 'עקרונות לתכנון שנגזרים מהחלופה הטובה' },
  questions: { he: 'שאלות מחקר', what: 'מה לבדוק הלאה, ואיך' },
};
