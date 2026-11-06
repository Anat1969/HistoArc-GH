import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { PEOPLE, type Person } from '../data/architects';
import { CITY_CASES, caseById } from '../data/cases';
import { CODE, LYNCH, codeColor } from '../engine/codes';
import { CodeMark } from '../components/Marks';
import { CasePhoto } from '../components/CasePhoto';

const KIND = { designer: 'אדריכל', planner: 'מתכנן', thinker: 'הוגה וחוקר' } as const;

/** piecewise time scale: antiquity compressed, the modern era wide */
function tx(year: number, W: number) {
  const segs: [number, number, number, number][] = [
    [-500, 1500, 0, 0.18],
    [1500, 1850, 0.18, 0.38],
    [1850, 2025, 0.38, 1],
  ];
  for (const [a, b, u, v] of segs) if (year <= b) return W * (u + ((Math.max(year, a) - a) / (b - a)) * (v - u));
  return W;
}

function Timeline({ people, sel, onPick }: { people: Person[]; sel: string[]; onPick: (id: string) => void }) {
  const W = 1000;
  const rows = people.length;
  const H = rows * 22 + 34;
  const ticks = [-500, 0, 500, 1000, 1500, 1700, 1850, 1900, 1950, 2000];
  return (
    <div className="timeline">
      <svg viewBox={`0 0 ${W + 20} ${H}`} width="100%" style={{ minWidth: 640 }} role="img" aria-label="ציר זמן של הגישות">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={W - tx(t, W) + 10} y1={18} x2={W - tx(t, W) + 10} y2={H} stroke="#ececE8" />
            <text x={W - tx(t, W) + 10} y={12} fontSize="10" textAnchor="middle" fill="#888">
              {t < 0 ? `${-t} לפנה"ס` : t}
            </text>
          </g>
        ))}
        {people.map((p, i) => {
          const x1 = W - tx(p.to, W) + 10;
          const x0 = W - tx(p.from, W) + 10;
          const y = 26 + i * 22;
          const on = sel.includes(p.id);
          return (
            <g key={p.id} onClick={() => onPick(p.id)} style={{ cursor: 'pointer' }}>
              <rect x={Math.min(x0, x1)} y={y} width={Math.max(6, Math.abs(x0 - x1))} height={12} rx={6} fill={codeColor(p.codes[0])} opacity={on ? 1 : 0.55} />
              <text x={Math.min(x0, x1) - 6} y={y + 10} fontSize="11" textAnchor="start" fill="#111" fontWeight={on ? 700 : 400} style={{ fontFamily: 'var(--sans)' }}>
                {p.he}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function PeopleMap({ people, onPick }: { people: Person[]; onPick: (id: string) => void }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!el.current) return;
    const m = new maplibregl.Map({
      container: el.current,
      style: { version: 8, sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap contributors' } }, layers: [{ id: 'osm', type: 'raster', source: 'osm' }] },
      center: [10, 30],
      zoom: 1.2,
      attributionControl: { compact: true },
    });
    for (const p of people) {
      const d = document.createElement('button');
      d.className = 'press';
      d.style.cssText = `padding:2px 6px;font-size:11px;background:#fff;border-inline-start:4px solid ${getComputedStyle(document.documentElement).getPropertyValue(LYNCH[CODE[p.codes[0]].lynch].color.slice(4, -1)).trim()}`;
      d.textContent = p.he;
      d.onclick = () => onPick(p.id);
      new maplibregl.Marker({ element: d }).setLngLat([p.lon, p.lat]).addTo(m);
    }
    return () => m.remove();
  }, [people, onPick]);
  return <div ref={el} className="map-wrap" style={{ height: 380 }} />;
}

function Card({ p }: { p: Person }) {
  const firstCase = p.projects.find((x) => x.caseId)?.caseId;
  const cs = firstCase ? caseById(firstCase) : undefined;
  return (
    <article className="card" style={{ display: 'grid', gap: 8 }}>
      <div>
        <div className="kicker">
          {KIND[p.kind]} · {p.years} · {p.place} · {p.culture}
        </div>
        <h2 style={{ margin: '2px 0', fontSize: 20 }}>
          {p.he} <span className="small muted" dir="ltr">{p.orig}</span>
        </h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {p.codes.map((c) => (
            <span key={c} className="chip">
              <CodeMark code={c} /> {CODE[c].name}
            </span>
          ))}
        </div>
      </div>
      <div className="small">
        <b>ההקשר:</b> {p.context}
      </div>
      <div className="small">
        <b>הבעיה:</b> {p.problem}
      </div>
      <div className="small">
        <b>הרעיונות:</b>
        <ul style={{ margin: '2px 0', paddingInlineStart: 18 }}>
          {p.ideas.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </div>
      <div className="small">
        <b>פרויקטים:</b>{' '}
        {p.projects.map((x, i) => (
          <span key={x.name}>
            {i > 0 && ' · '}
            {x.caseId ? <a href={`#/lab?case=${x.caseId}`}>{x.name}</a> : x.name} ({x.year})
          </span>
        ))}
      </div>
      {cs && <CasePhoto c={cs} />}
      <div className="small">
        <b>השפעה:</b> {p.influence}
      </div>
      <div className="small">
        <b>ביקורת:</b> {p.critique}
      </div>
      {p.reading && (
        <div className="card soft" style={{ padding: '10px 12px' }}>
          <div className="small">
            <b>כך הגישה הזו הייתה קוראת אתר:</b> {p.reading.why} <span className="tag st-int">פרשנות</span>
          </div>
          <div className="filters" style={{ margin: '6px 0 0' }}>
            <a className="press primary" href={`#/lab?person=${p.id}&case=27`} style={{ textDecoration: 'none' }}>
              לבחון על אשדוד
            </a>
            <select
              aria-label="אתר אחר"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) window.location.hash = `#/lab?person=${p.id}&case=${e.target.value}`;
              }}
              style={{ width: 'auto' }}
            >
              <option value="">או אתר אחר…</option>
              {CITY_CASES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.he}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      <div className="tiny muted">
        מקורות: {p.sources.join('; ')} ·{' '}
        <a href={p.commons} target="_blank" rel="noreferrer">
          Wikimedia Commons
        </a>
      </div>
    </article>
  );
}

export default function People() {
  const people = useMemo(() => [...PEOPLE].sort((a, b) => a.from - b.from), []);
  const [sel, setSel] = useState<string[]>(['corbusier', 'jacobs']);
  const [view, setView] = useState<'time' | 'map'>('time');
  const pick = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s.slice(-1), id]));
  const chosen = sel.map((id) => people.find((p) => p.id === id)!).filter(Boolean);

  return (
    <div className="page">
      <div className="lens">
        <p className="q">השאלה: איך גישות שונות היו קוראות את אותו אתר, ולמה?</p>
        <h1>
          {people.length} אדריכלים, מתכננים והוגים. <mark>גישה מאוחרת אינה בהכרח טובה מקודמתה.</mark>
        </h1>
        <p>בחרו שתי דמויות על ציר הזמן או על המפה כדי להשוות. כל גישה מחוברת לקוד במודל, ואפשר לבחון איך היא הייתה מתכננת את האתר שלכם.</p>
      </div>
      <div className="filters">
        <button className="press" aria-pressed={view === 'time'} onClick={() => setView('time')}>
          ציר זמן
        </button>
        <button className="press" aria-pressed={view === 'map'} onClick={() => setView('map')}>
          מפה
        </button>
        <span className="small muted">צבע: הקוד המרכזי של הגישה. לחיצה בוחרת להשוואה.</span>
      </div>
      <section className="card" style={{ marginBottom: 16 }}>
        {view === 'time' ? <Timeline people={people} sel={sel} onPick={pick} /> : <PeopleMap people={people} onPick={pick} />}
      </section>
      {chosen.length === 2 && (
        <p className="insight" style={{ marginBottom: 12 }}>
          <b>המחלוקת:</b> {chosen[0].he} {chosen[0].codes.some((c) => CODE[c].wall) ? 'מגדיר את הרחוב בבניין' : 'משחרר את הבניין מהרחוב'}, ו{chosen[1].he}{' '}
          {chosen[1].codes.some((c) => CODE[c].wall) ? 'מגדיר את הרחוב בבניין' : 'משחרר את הבניין מהרחוב'}. {chosen[0].codes.some((c) => CODE[c].wall) !== chosen[1].codes.some((c) => CODE[c].wall) ? 'זו בדיוק ההבחנה ביחס R שהמודל בודק.' : 'שתיהן חולקות את אותו יחס R, וההבדל ביניהן בערכים או באלמנטים.'}
        </p>
      )}
      <div className="grid2">
        {chosen.map((p) => (
          <Card key={p.id} p={p} />
        ))}
      </div>
    </div>
  );
}
