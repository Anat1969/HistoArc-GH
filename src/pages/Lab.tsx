import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { CODE, codesFor, LYNCH, R_LABEL, tLabel } from '../engine/codes';
import type { CodeId, Model, Param, Scale, Theta } from '../engine/types';
import { casesFor, caseById, caseT, caseWall } from '../data/cases';
import { cell, fitOf, FIT_THRESHOLD, structureOf, thetaDistance } from '../lib/verdict';
import { tSignature } from '../engine/measure';
import { useModel } from '../lib/gen';
import { replaceQuery } from '../lib/route';
import { CodeMark } from '../components/Marks';
import { Plan } from '../components/Plan';

const City3D = lazy(() => import('../components/City3D'));

export const PARAM_META: Record<Param, { he: string; unit: string; min: number; max: number; log?: boolean; step: number; std: string }> = {
  O: { he: 'סדר', unit: 'φ', min: 0, max: 1, step: 0.01, std: 'Boeing 2019' },
  I: { he: 'עוצמה', unit: 'FSI', min: 0.02, max: 16, log: true, step: 0.01, std: 'Spacematrix' },
  E: { he: 'סגירות', unit: 'GSI', min: 0, max: 1, step: 0.01, std: 'Spacematrix' },
  H: { he: 'היררכיה', unit: '0–1', min: 0, max: 1, step: 0.01, std: 'מורכב [ה]' },
  G: { he: 'גרעין', unit: "מ'", min: 15, max: 2000, log: true, step: 0.001, std: 'Conzen' },
};

type Meta = Record<Param, { he: string; unit: string; min: number; max: number; log?: boolean; step: number; std: string }>;

/** the same five indicators, read at the scale of one building (spec section 4.2) */
export const PARAM_META_B: Meta = {
  O: { he: 'סדר', unit: 'סימטריה ומודול', min: 0, max: 1, step: 0.01, std: 'מראה ומודול [ה]' },
  I: { he: 'עוצמה', unit: 'נפח/טביעה', min: 0.8, max: 20, log: true, step: 0.01, std: 'שטח רצפות / טביעת רגל' },
  E: { he: 'סגירות', unit: 'מלא/ריק', min: 0, max: 1, step: 0.01, std: 'חלק המלא בחזית' },
  H: { he: 'היררכיה', unit: 'חלל שולט', min: 0, max: 1, step: 0.01, std: '1 − חציון/מקסימום' },
  G: { he: 'גרעין', unit: "מודול מ'", min: 0.8, max: 12, log: true, step: 0.001, std: 'מפתח החזית' },
};
export const metaFor = (scale: Scale) => (scale === 'building' ? PARAM_META_B : PARAM_META);

export const fmt = (p: Param, v: number) => (p === 'G' ? (v < 15 ? v.toFixed(1) : Math.round(v).toString()) : p === 'I' ? (v < 1 ? v.toFixed(2) : v.toFixed(1)) : v.toFixed(2));

function toPos(M: Meta, p: Param, v: number) {
  const m = M[p];
  if (m.log) return (Math.log(v) - Math.log(m.min)) / (Math.log(m.max) - Math.log(m.min));
  return (v - m.min) / (m.max - m.min);
}
function fromPos(M: Meta, p: Param, t: number) {
  const m = M[p];
  if (m.log) return Math.exp(Math.log(m.min) + t * (Math.log(m.max) - Math.log(m.min)));
  return m.min + t * (m.max - m.min);
}

function boundsFor(p: Param, code: CodeId, theta: Theta): [number, number] {
  const c = CODE[code];
  if (p === 'O' || p === 'H' || p === 'G') return c.bounds[p];
  if (p === 'E') return c.bounds.E ?? [0.02, 0.98];
  if (c.bounds.I) return c.bounds.I;
  return [0.02, c.floorsMax * Math.min(theta.E, c.bounds.E?.[1] ?? 1)];
}

function Slider({ M, p, value, measured, bounds, onChange }: { M: Meta; p: Param; value: number; measured?: number; bounds: [number, number]; onChange: (v: number) => void }) {
  const m = M[p];
  const a = Math.max(0, Math.min(1, toPos(M, p, bounds[0])));
  const b = Math.max(0, Math.min(1, toPos(M, p, bounds[1])));
  const inside = value >= bounds[0] - 1e-9 && value <= bounds[1] + 1e-9;
  return (
    <div className="slider">
      <div className="slider-head">
        <span>
          <b>{m.he}</b> <span className="mono muted">{p} · {m.unit}</span>
        </span>
        <span className="val" style={{ color: inside ? undefined : 'var(--rev)' }}>
          {fmt(p, value)}
          {measured !== undefined && <span className="muted"> ← {fmt(p, measured)}</span>}
        </span>
      </div>
      <div className="track">
        <div className="band all" />
        <div className="band ok" style={{ insetInlineStart: `${a * 100}%`, width: `${(b - a) * 100}%` }} />
        {measured !== undefined && <div className="tick" style={{ insetInlineStart: `calc(${toPos(M, p, measured) * 100}% - 5px)` }} title="נמדד במודל" />}
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={toPos(M, p, value)}
          aria-label={`${m.he} ${p}`}
          onChange={(e) => {
            const v = fromPos(M, p, +e.target.value);
            onChange(p === 'G' && v >= 15 ? Math.round(v) : Math.round(v * 100) / 100);
          }}
          style={{ direction: 'rtl' }}
        />
      </div>
    </div>
  );
}

const DEFAULT_CASE = 19;

function initial(q: URLSearchParams) {
  const cid = Number(q.get('case')) || (q.get('O') ? 0 : DEFAULT_CASE);
  const c = caseById(cid);
  const base = c?.theta ?? caseById(DEFAULT_CASE)!.theta!;
  const theta: Theta = { ...base };
  for (const p of ['O', 'I', 'E', 'H', 'G'] as Param[]) if (q.get(p)) theta[p] = Number(q.get(p));
  const code = (q.get('code') as CodeId) || c?.code || 'grid';
  return { caseId: c?.theta ? c.id : 0, theta, code: CODE[code] ? code : 'grid' };
}

export default function Lab({ q }: { q: URLSearchParams }) {
  const init = useMemo(() => initial(q), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [caseId, setCaseId] = useState(init.caseId);
  const [theta, setTheta] = useState<Theta>(init.theta);
  const [code, setCode] = useState<CodeId>(init.code);
  const [rise, setRise] = useState(0);
  const cs = caseById(caseId);
  const pristine = !!cs?.theta && (['O', 'I', 'E', 'H', 'G'] as Param[]).every((p) => cs.theta![p] === theta[p]);
  const seed = pristine ? cell(caseId, code)?.k : undefined;
  const { model, busy } = useModel(theta, code, seed);

  useEffect(() => {
    replaceQuery('/lab', { ...(caseId ? { case: caseId } : {}), code, ...(pristine ? {} : theta) });
  }, [caseId, code, theta, pristine]);

  const pickCase = (id: number) => {
    const c = caseById(id);
    if (!c?.theta) return;
    setCaseId(id);
    setTheta({ ...c.theta });
    setCode(c.code);
    setRise((r) => r + 1);
  };
  const pickCode = (id: CodeId) => {
    setCode(id);
    setRise((r) => r + 1);
  };

  const m: Model | null = model;
  const err = m?.error ?? 0;
  const ok = err <= FIT_THRESHOLD;
  const wallM = (m?.measured.wall ?? 0) >= 0.5;
  const wallCase = cs ? caseWall(cs) : null;
  const st = cs && m ? structureOf(cs, m.measured) : null;
  const wallMismatch = !!(cs && pristine && st && (!st.rOk || st.tDiff.length > 0));
  const off = m ? (Object.keys(m.errors) as Param[]).filter((p) => m.errors[p] > 0.04) : [];
  const near = useMemo(
    () =>
      casesFor(CODE[code].scale ?? 'city').map((c) => ({ c, d: thetaDistance(c.theta!, theta) }))
        .filter((x) => x.c.id !== caseId)
        .sort((a, b) => a.d - b.d)
        .slice(0, 4),
    [theta, caseId, code],
  );
  const C = CODE[code];
  const scale: Scale = C.scale ?? 'city';
  const META = metaFor(scale);
  const TL = tLabel(scale);
  const isB = scale === 'building';
  const pickScale = (sc: Scale) => {
    if (sc === scale) return;
    pickCase(sc === 'building' ? 36 : DEFAULT_CASE);
  };

  const headline = !m
    ? isB ? 'בונה את הבניין' : 'בונה את העיר'
    : ok
      ? wallMismatch
        ? st && !st.rOk
          ? 'המספרים תואמים. היחס R לא.'
          : 'המספרים תואמים. האלמנטים T לא.'
        : `הקוד ${C.name} משחזר את הערכים.`
      : `מחוץ לתחום של ${C.name}.`;
  const sub = !m
    ? ''
    : ok
      ? wallMismatch
        ? st && !st.rOk
          ? isB
            ? `במודל הקיר ${wallM ? 'נושא' : 'משוחרר מהעומס'}, ובמקרה ${wallCase ? 'נושא' : 'משוחרר'}. שינוי ערכים לא מספיק כאן: נדרש שינוי ביחס.`
            : `דופן הרחוב במודל ${wallM ? 'רציפה' : 'נעדרת'}, ובמקרה ${wallCase ? 'רציפה' : 'נעדרת'}. שינוי ערכים לא מספיק כאן: נדרש שינוי ביחס.`
          : `שונה: ${st?.tDiff.map((k) => TL[k]).join(', ')}. שינוי ערכים לא מספיק כאן: נדרש אלמנט אחר.`
        : 'שינוי ערכים בתוך אותו קוד: לפי המודל זו אבולוציה.'
      : `הכללים של הקוד לא מגיעים ל-${off.map((p) => META[p].he).join(', ')}. כדי לשחזר נדרש אלמנט, יחס או כלל אחר: מהפכה.`;

  return (
    <div className="page" style={{ paddingBottom: 0 }}>
      <div className="lab">
        <aside className="controls" aria-label="הקוד והערכים">
          <div className="filters" role="tablist" aria-label="קנה מידה" style={{ marginBottom: 8 }}>
            <button className="press" aria-pressed={!isB} onClick={() => pickScale('city')}>
              עיר
            </button>
            <button className="press" aria-pressed={isB} onClick={() => pickScale('building')}>
              בניין
            </button>
            <span className="tiny muted">אותה סכמה, אותם חמישה מחוונים</span>
          </div>
          <div className="label">מקרה בוחן</div>
          <select value={caseId || ''} onChange={(e) => pickCase(+e.target.value)} aria-label="בחירת מקרה">
            {!caseId && <option value="">ערכים חופשיים</option>}
            {casesFor(scale).map((c) => (
              <option key={c.id} value={c.id}>
                {c.he} · {c.period}
              </option>
            ))}
          </select>
          <div className="hr" />
          <div className="label">הקוד: T, R, P</div>
          <div className="codes">
            {codesFor(scale).map((c) => (
              <button key={c.id} className="press" aria-pressed={code === c.id} onClick={() => pickCode(c.id)} title={c.short}>
                <CodeMark code={c.id} />
                {c.name}
              </button>
            ))}
          </div>
          <div className="trp">
            <div>
              <span className="k">T</span>
              <span>{C.T.join(' · ')}</span>
            </div>
            <div>
              <span className="k">R</span>
              <span>{C.R.join(' · ')}</span>
            </div>
            <div>
              <span className="k">P</span>
              <span>{C.P.join(' · ')}</span>
            </div>
            <div className="muted small" style={{ gridTemplateColumns: '1fr' }}>
              {isB ? `צבע: ${LYNCH[C.lynch].name}. ${C.note}` : `מודל לינץ': ${LYNCH[C.lynch].name}. עד ${C.floorsMax} קומות.`}
            </div>
          </div>
          <div className="hr" />
          <div className="label">θ: חמשת הערכים. אפור: התחום שהקוד מתיר. ירוק: נמדד.</div>
          {(['O', 'I', 'E', 'H', 'G'] as Param[]).map((p) => (
            <Slider
              key={p}
              M={META}
              p={p}
              value={theta[p]}
              measured={m ? m.measured[p] : undefined}
              bounds={boundsFor(p, code, theta)}
              onChange={(v) => setTheta((t) => ({ ...t, [p]: v }))}
            />
          ))}
          {cs && !pristine && (
            <button className="press" style={{ marginTop: 12 }} onClick={() => pickCase(cs.id)}>
              חזרה לערכי {cs.he}
            </button>
          )}
        </aside>

        <section className="stage" aria-label="המודל התלת-ממדי">
          <div className="lens" style={{ margin: 0 }}>
            <div className="kicker">
              {cs ? `${cs.he} · ${cs.orig} · ${cs.period}` : 'ערכים חופשיים'} · קוד {C.name}
              {cs && (cs.assessed ? ` · θ נמדד מ-OpenStreetMap ${cs.measuredYear ?? ''}` : cs.measureNote ? ` · ${cs.measureNote}` : ' · θ הערכה [ה]')}
            </div>
            <h1>{ok && !wallMismatch ? headline : <span>{headline}</span>}</h1>
            <p>{sub}</p>
          </div>
          <div className="canvas-wrap">
            <Suspense fallback={<div className="busy">טוען תלת-ממד</div>}>
              <City3D model={m} rise={rise} />
            </Suspense>
            {busy && <div className="busy">מכייל את O ו-H</div>}
            <div className="overlay">
              <div className="chip">
                <span className="sw" style={{ background: '#fff', boxShadow: 'inset 0 0 0 1px #bbb' }} />
                {isB ? 'מסה וקירות: נגזרים מ-θ' : 'בינוי: נגזר מ-θ'}
              </div>
              <div className="chip">
                <span className="sw" style={{ background: LYNCH[C.lynch].color }} />
                {isB ? 'אלמנטים של הקוד: אולם, גרעין, אח' : 'אלמנטים של הקוד: ציר, מרכז, חומה'}
              </div>
              <div className="chip">
                <span className="sw" style={{ background: 'var(--plate)' }} />
                {isB ? 'זכוכית, תקרות, עמודים כהים' : 'חלקות. הלבן ביניהן: רחוב'}
              </div>
              <div className="mono muted" style={{ marginTop: 4 }}>
                {isB ? `מבנה ${m ? Math.round(m.site / 2.2) * 2 : '—'} מ' · ${m?.buildings.length ?? '—'} רכיבים · קומה 3.6 מ'` : `אתר ${m ? Math.round(m.site) : '—'} מ' · ${m?.buildings.length ?? '—'} מבנים · קומה 3.3 מ'`}
              </div>
            </div>
          </div>
        </section>

        <aside className="readout" aria-label="מדידה והתאמה">
          <div className="label">שגיאת התאמה (ממוצע 5 מחוונים)</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span className="bignum" style={{ color: ok ? 'var(--evo)' : 'var(--rev)' }}>
              {m ? err.toFixed(3) : '—'}
            </span>
            <span className="verdict" style={{ background: ok ? (wallMismatch ? 'var(--hyb)' : 'var(--evo)') : 'var(--rev)' }}>
              {ok ? (wallMismatch ? 'מספרים בלבד' : 'משחזר') : 'לא משחזר'}
            </span>
          </div>
          <div className="tiny muted">סף: {FIT_THRESHOLD}. I ו-G נמדדים בעשרות לוגריתמיות.</div>
          <div className="errbars">
            {(['O', 'I', 'E', 'H', 'G'] as Param[]).map((p) => {
              const e = m?.errors[p] ?? 0;
              return (
                <div className="errbar" key={p}>
                  <span>
                    {META[p].he} <span className="mono muted">{p}</span>
                  </span>
                  <div className="bg">
                    <div className="fg" style={{ width: `${Math.min(1, e / 0.3) * 100}%`, background: e > FIT_THRESHOLD ? 'var(--rev)' : 'var(--ink)' }} />
                    <div className="thr" style={{ insetInlineStart: `${(FIT_THRESHOLD / 0.3) * 100}%` }} />
                  </div>
                  <span className="mono small">{e.toFixed(3)}</span>
                </div>
              );
            })}
          </div>
          <div className="hr" />
          <div className="label">היחס R: {R_LABEL[scale]}</div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'baseline' }}>
            <span className="mono" style={{ fontSize: 22 }}>{m ? (isB ? (wallM ? 'כן' : 'לא') : Math.round(m.measured.wall * 100) + '%') : '—'}</span>
            <span className="small">
              {isB ? 'כשיש עמודים נושאים חופשיים, הקיר משוחרר מהעומס.' : 'מהיקף החלקות בנוי על קו הרחוב.'}
              {wallCase !== null && cs && (
                <>
                  {' '}
                  ב{cs.he}: <b>{isB ? (wallCase ? 'הקיר נושא' : 'השלד נושא') : wallCase ? 'דופן רציפה' : 'בלי דופן'}</b>.
                </>
              )}
            </span>
          </div>
          <div className="hr" />
          <div className="label">האלמנטים T: נמדדים במודל{cs ? ` מול ${cs.he}` : ''}</div>
          <div className="errbars">
            {(['center', 'deadEnd', 'court'] as const).map((k) => {
              const has = m ? tSignature(m.measured)[k] : false;
              const doc = cs ? caseT(cs)[k] : null;
              const off = doc !== null && pristine && has !== doc;
              return (
                <div key={k} className="errbar" style={{ gridTemplateColumns: 'minmax(0,1fr) auto auto' }}>
                  <span>{TL[k]}</span>
                  <span className="mono small">{m ? (has ? 'יש' : 'אין') : '—'}</span>
                  <span className="small" style={{ color: off ? 'var(--rev)' : 'var(--grey)', minWidth: 64 }}>
                    {doc === null ? '' : off ? `במקרה: ${doc ? 'יש' : 'אין'}` : 'תואם'}
                  </span>
                </div>
              );
            })}
          </div>
          {cs && pristine && (
            <>
              <div className="hr" />
              <div className="label">אילו קודים משחזרים את {cs.he}</div>
              <div className="near">
                {codesFor(scale).map((c) => ({ c, x: cell(cs.id, c.id), f: fitOf(cs, c.id) }))
                  .sort((a, b) => a.x.e - b.x.e)
                  .map(({ c, x, f }) => (
                    <button key={c.id} className="press" aria-pressed={code === c.id} onClick={() => pickCode(c.id)}>
                      <CodeMark code={c.id} />
                      <span>
                        {c.name}
                        {c.id === cs.code && <span className="muted"> · הקוד של המקרה</span>}
                      </span>
                      <span className="mono" style={{ color: f === 'full' ? 'var(--evo)' : f === 'numbers' ? 'var(--hyb)' : 'var(--grey)' }}>
                        {x.e.toFixed(3)}
                      </span>
                    </button>
                  ))}
              </div>
            </>
          )}
          <div className="hr" />
          <div className="label">{isB ? "תוכנית הקומה, 70 מ'" : "תוכנית דמות-רקע, 700 מ'"}</div>
          <Plan model={m} scaleBar windowM={isB ? 70 : 700} />
          <div className="hr" />
          <div className="label">המקרים הקרובים ב-θ</div>
          <div className="near">
            {near.map(({ c, d }) => (
              <button key={c.id} className="press" onClick={() => pickCase(c.id)}>
                <CodeMark code={c.code} />
                <span>{c.he}</span>
                <span className="mono muted">{d.toFixed(2)}</span>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
