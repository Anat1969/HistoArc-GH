import { useEffect, useMemo, useState } from 'react';
import { CASES, caseWall, type Case } from '../data/cases';
import { CODE, CODE_MARK, LYNCH, codeColor } from '../engine/codes';
import type { Lynch, Model } from '../engine/types';
import { cell, fitOf } from '../lib/verdict';
import { requestModel } from '../lib/gen';
import { go } from '../lib/route';
import { CodeMark, markPath } from '../components/Marks';
import { Plan } from '../components/Plan';

type Sort = 'year' | 'O' | 'I' | 'E';
const SORTS: { id: Sort; he: string }[] = [
  { id: 'year', he: 'זמן' },
  { id: 'O', he: 'סדר' },
  { id: 'I', he: 'עוצמה' },
  { id: 'E', he: 'סגירות' },
];

const yearLabel = (y: number) => (y < 0 ? `${-y} לפנה"ס` : String(y));

/** Spacematrix (Berghauser Pont & Haupt 2010): GSI on x, FSI on y, floors as rays from the origin. */
function Spacematrix({ cases, hot, setHot }: { cases: Case[]; hot: number | null; setHot: (id: number | null) => void }) {
  const W = 360;
  const H = 340;
  const pad = { l: 34, r: 12, t: 12, b: 30 };
  const xmax = 1;
  const ymax = 5.5;
  const X = (g: number) => W - pad.r - (g / xmax) * (W - pad.l - pad.r); // RTL: GSI grows to the left
  const Y = (f: number) => H - pad.b - (f / ymax) * (H - pad.t - pad.b);
  const rays = [1, 2, 4, 8, 16];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="מטריצת המרחב: כיסוי מול עוצמה">
      {rays.map((L) => {
        const g2 = Math.min(xmax, ymax / L);
        return (
          <g key={L}>
            <line x1={X(0)} y1={Y(0)} x2={X(g2)} y2={Y(g2 * L)} stroke="#e3e2dc" />
            <text x={X(g2) + (L >= 8 ? 0 : -2)} y={Y(g2 * L) - 3} fontSize="9" fill="#9a9a9a" textAnchor="middle">
              {L} קומות
            </text>
          </g>
        );
      })}
      <line x1={X(0)} y1={Y(0)} x2={X(xmax)} y2={Y(0)} stroke="#111" />
      <line x1={X(0)} y1={Y(0)} x2={X(0)} y2={Y(ymax)} stroke="#111" />
      {[0, 0.25, 0.5, 0.75, 1].map((g) => (
        <text key={g} x={X(g)} y={H - pad.b + 14} fontSize="9" textAnchor="middle" fill="#6e6e6e">
          {g}
        </text>
      ))}
      {[0, 1, 2, 3, 4, 5].map((f) => (
        <text key={f} x={X(0) + 6} y={Y(f) + 3} fontSize="9" fill="#6e6e6e">
          {f}
        </text>
      ))}
      <text x={X(0.5)} y={H - 2} fontSize="10" textAnchor="middle" fill="#111">
        GSI · סגירות E
      </text>
      <text x={W - 4} y={pad.t + 2} fontSize="10" textAnchor="end" fill="#111">
        FSI · עוצמה I
      </text>
      {cases.map((c) => {
        const t = c.theta!;
        const on = hot === c.id;
        return (
          <path
            key={c.id}
            d={markPath(CODE_MARK[c.code], X(t.E), Y(Math.min(t.I, ymax)), on ? 6 : 4)}
            fill={codeColor(c.code)}
            stroke={on ? '#111' : '#fff'}
            strokeWidth={on ? 1.5 : 0.8}
            onMouseEnter={() => setHot(c.id)}
            onMouseLeave={() => setHot(null)}
            onClick={() => go('/lab', { case: c.id })}
            style={{ cursor: 'pointer' }}
          >
            <title>
              {c.he}: FSI {t.I}, GSI {t.E}
            </title>
          </path>
        );
      })}
      {hot && cases.find((c) => c.id === hot) && (
        <text x={X(cases.find((c) => c.id === hot)!.theta!.E) - 8} y={Y(Math.min(cases.find((c) => c.id === hot)!.theta!.I, ymax)) + 4} fontSize="11" textAnchor="end" fill="#111" fontWeight="600" style={{ fontFamily: 'var(--sans)' }}>
          {cases.find((c) => c.id === hot)!.he}
        </text>
      )}
    </svg>
  );
}

export default function Atlas() {
  const [lynch, setLynch] = useState<Lynch | 'all'>('all');
  const [sort, setSort] = useState<Sort>('year');
  const [hot, setHot] = useState<number | null>(null);
  const [models, setModels] = useState<Record<number, Model>>({});

  // plans are generated in the worker one by one, with the knobs solved at build time
  useEffect(() => {
    let alive = true;
    (async () => {
      for (const c of CASES) {
        if (!c.theta || !alive) continue;
        const m = await requestModel(c.theta, c.code, cell(c.id, c.code)?.k);
        if (!alive) return;
        setModels((s) => ({ ...s, [c.id]: m }));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const list = useMemo(() => {
    const l = CASES.filter((c) => lynch === 'all' || CODE[c.code].lynch === lynch);
    const key = (c: Case) => (sort === 'year' ? c.year : c.theta ? c.theta[sort] : -1);
    return [...l].sort((a, b) => key(a) - key(b));
  }, [lynch, sort]);
  const city = list.filter((c) => c.theta && c.scale === 'city');
  const blds = list.filter((c) => c.scale === 'building').length;
  const walls = city.filter((c) => caseWall(c)).length;
  const ownOk = city.filter((c) => fitOf(c, c.code) === 'full').length;

  return (
    <div className="page">
      <div className="lens">
        <div className="kicker">פרלל בנוסח דוראן · 1799–1801</div>
        <h1>
          {city.length} ערים באותו קנה מידה: <mark>700 מ'</mark> בכל לוח.{blds ? ` ${blds} בניינים: 70 מ'.` : ''}
        </h1>
        <p>
          כל תוכנית נוצרה מהקוד שלה ומחמשת הערכים שלה. <b>{ownOk}</b> מתוך <b>{city.length}</b> משוחזרות בקוד שלהן. ב-<b>{walls}</b> הבניין מגדיר את הרחוב, וב-
          <b>{city.length - walls}</b> הוא מנותק ממנו.
        </p>
      </div>
      <div className="atlas">
        <section>
          <div className="filters" role="toolbar" aria-label="סינון ומיון">
            <button className="press" aria-pressed={lynch === 'all'} onClick={() => setLynch('all')} style={{ fontWeight: 600 }}>
              הכול
            </button>
            {(Object.keys(LYNCH) as Lynch[]).map((l) => (
              <button key={l} className="press" aria-pressed={lynch === l} onClick={() => setLynch(l)}>
                <span className="sw" style={{ background: LYNCH[l].color, marginInlineEnd: 6 }} />
                {LYNCH[l].name}
              </button>
            ))}
            <span className="muted small" style={{ marginInlineStart: 12 }}>
              מיון:
            </span>
            {SORTS.map((s) => (
              <button key={s.id} className="press" aria-pressed={sort === s.id} onClick={() => setSort(s.id)}>
                {s.he}
              </button>
            ))}
          </div>
          <div className="tiles">
            {list.map((c) => (
              <button
                key={c.id}
                className={'tile' + (hot === c.id ? ' hot' : '')}
                onMouseEnter={() => setHot(c.id)}
                onMouseLeave={() => setHot(null)}
                onClick={() => c.theta && go('/lab', { case: c.id })}
                aria-label={`${c.he}, ${c.period}`}
              >
                <div className="plate">
                  {c.theta ? (
                    models[c.id] ? (
                      <Plan model={models[c.id]} windowM={c.scale === 'building' ? 70 : 700} />
                    ) : (
                      <div className="placeholder">מחולל</div>
                    )
                  ) : (
                    <div className="placeholder">
                      קנה מבנה.
                      <br />
                      המחולל בגרסה זו עירוני.
                    </div>
                  )}
                </div>
                <div className="nm">{c.he}</div>
                <div className="yr">
                  <CodeMark code={c.code} size={8} />
                  {yearLabel(c.year)} · {CODE[c.code].name}
                </div>
              </button>
            ))}
          </div>
        </section>
        <aside className="side">
          <div className="label">מטריצת המרחב · Berghauser Pont & Haupt 2010</div>
          <Spacematrix cases={city} hot={hot} setHot={setHot} />
          <p className="small" style={{ margin: '8px 0' }}>
            <b>אותה נקודה, ערים שונות.</b> הקוד האורגני משחזר את המספרים של לצ'וורת' בשגיאה <span className="mono">{cell(20, 'organic').e.toFixed(3)}</span>, אבל עם דופן רחוב רציפה. רק היחס R מבדיל ביניהן.
          </p>
          <div className="legend">
            {(['organic', 'medina', 'grid', 'cosmic', 'ideal', 'grand', 'garden', 'tower', 'field'] as const).map((id) => (
              <span key={id} className="chip">
                <CodeMark code={id} />
                {CODE[id].name}
              </span>
            ))}
          </div>
          <div className="tiny muted">צבע: מודל לינץ' (Good City Form, 1981). צורה: הקוד. הערכים הם הערכות ראשוניות [ה].</div>
        </aside>
      </div>
    </div>
  );
}
