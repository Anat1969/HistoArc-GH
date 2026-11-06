import { lazy, Suspense, useState } from 'react';
import { caseById } from '../data/cases';
import { CODE, LYNCH } from '../engine/codes';
import type { CodeId } from '../engine/types';
import { cell, fitOf, stats } from '../lib/verdict';
import { useModel } from '../lib/gen';
import { CodeMark } from '../components/Marks';
import { CLAIMS, RESEARCH, STATUS } from '../data/knowledge';

const City3D = lazy(() => import('../components/City3D'));
const DEMO = 24; // Ville Radieuse

export default function Home() {
  const vr = caseById(DEMO)!;
  const [code, setCode] = useState<CodeId>('tower');
  const { model } = useModel(vr.theta!, code, cell(DEMO, code).k);
  const [rise, setRise] = useState(0);
  const st = stats();
  const pick = (c: CodeId) => {
    setCode(c);
    setRise((r) => r + 1);
  };
  const side = (c: CodeId) => ({ e: cell(DEMO, c).e, wall: cell(DEMO, c).m.wall, f: fitOf(vr, c) });

  return (
    <div className="page">
      <div className="home">
        <section>
          <p className="q">שאלת המחקר</p>
          <h1 className="hero-h" style={{ fontSize: 30 }}>
            אילו בחירות בצורה של עיר ובניין משנות את חיי היומיום, ומתי זה כוונון ומתי מהפכה?
          </h1>
          <p className="insight">
            <mark>תובנה מרכזית:</mark> שתי ערים יכולות להיות זהות במספרים ושונות לגמרי בחיים. ההבדל יושב ביחס בין הבית לרחוב, לא בצפיפות.
          </p>
          <p className="small muted" style={{ marginTop: 6 }}>
            במודל: ב-<b>{st.numbersOnly}</b> הרצות המספרים תואמים והעיר שונה. ההמחשה משמאל מראה את זה על העיר הקורנת של לה קורבוזיה.
          </p>
          <div className="filters" style={{ marginTop: 14 }}>
            <a className="press primary" href="#/lab?scenario=s-ashdod-street" style={{ textDecoration: 'none' }}>
              התחל: בחנו את אשדוד
            </a>
            <a className="press" href="#/lab" style={{ textDecoration: 'none' }}>
              לבחור אתר אחר
            </a>
          </div>

          <div className="label" style={{ marginTop: 20 }}>
            המסלול
          </div>
          <div className="steps">
            <a href="#/lab">
              <b>בוחרים אתר</b>
              <span>עיר או בניין מתוך 38 מקרים</span>
            </a>
            <a href="#/lab?scenario=s-ashdod-tower">
              <b>משנים ערך</b>
              <span>ורואים לפני ואחרי</span>
            </a>
            <a href="#/alts">
              <b>משווים חלופות</b>
              <span>אותה צפיפות, קוד אחר</span>
            </a>
            <a href="#/out">
              <b>מפיקים תוצר</b>
              <span>תקציר, מאמר, עקרונות</span>
            </a>
          </div>
        </section>

        <section className="canvas-wrap hero-3d" aria-label="העיר הקורנת בשני קודים" style={{ maxHeight: 620 }}>
          <Suspense fallback={<div className="busy">טוען תלת-ממד</div>}>
            <City3D model={model} rise={rise} />
          </Suspense>
          <div className="compare">
            {(['grid', 'tower'] as const).map((c) => {
              const x = side(c);
              return (
                <button key={c} className="press" aria-pressed={code === c} onClick={() => pick(c)}>
                  <span className="small" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <CodeMark code={c} /> {CODE[c].name}
                  </span>
                  <span className="e">{x.f === 'full' ? 'משחזר' : 'לא משחזר'}</span>
                  <span className="small">דופן רחוב {Math.round(x.wall * 100)}%</span>
                </button>
              );
            })}
          </div>
          <div className="overlay">
            <b>מה רואים:</b> העיר הקורנת (1930) באותם ערכים, בשני קודים.
            <br />
            <b>למה לשים לב:</b> ברשת <span style={{ color: 'var(--rev)' }}>הרחוב נשאר</span>, במגדל בפארק <span style={{ color: 'var(--evo)' }}>הרחוב נעלם</span>.
            <div className="chip" style={{ marginTop: 4 }}>
              <span className="sw" style={{ background: LYNCH[CODE[code].lynch].color }} />
              {LYNCH[CODE[code].lynch].name}
            </div>
          </div>
        </section>
      </div>

      <div className="grid2" style={{ marginTop: 24 }}>
        <section className="card">
          <h2 style={{ fontSize: 17, margin: '0 0 8px' }}>מה אנחנו חוקרים, ולמה</h2>
          <p className="small" style={{ margin: '0 0 8px' }}>
            <b>השאלה כפי שנשאלה:</b> {RESEARCH.asked}
          </p>
          <p className="small" style={{ margin: '0 0 8px' }}>
            <b>השאלה כפי שהמאמר מאפשר לחקור:</b> {RESEARCH.refined}
          </p>
          <p className="small" style={{ margin: 0 }}>
            <b>למה זה חשוב:</b> {RESEARCH.why}
          </p>
          <details className="more">
            <summary>מה המאמר עוזר לראות, מה המודל בודק, ואיך זה משפיע על החלטה</summary>
            <div className="small" style={{ display: 'grid', gap: 6, marginTop: 6 }}>
              <div>
                <b>רואים:</b> {RESEARCH.sees}
              </div>
              <div>
                <b>בודקים:</b> {RESEARCH.tests}
              </div>
              <div>
                <b>מחליטים:</b> {RESEARCH.decides}
              </div>
              <div>
                <b>מדמיינים:</b> {RESEARCH.imagine}
              </div>
            </div>
          </details>
        </section>
        <section>
          <h2 style={{ fontSize: 17, margin: '0 0 8px' }}>מה ידוע, ומה עדיין לא</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            {CLAIMS.map((c) => (
              <div key={c.text} className="card" style={{ padding: '10px 14px', borderInlineStart: `4px solid ${STATUS[c.status].color}` }}>
                <span className={'tag ' + STATUS[c.status].cls}>{STATUS[c.status].he}</span>
                <div className="small" style={{ marginTop: 4 }}>
                  {c.text}
                </div>
                <div className="tiny muted">{c.basis}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="inspo">
        השראה: ז'.נ.ל. דוראן (J.-N.-L. Durand), Recueil et parallèle des édifices, 1799–1801. ג'מבטיסטה נולי (Giambattista Nolli), מפת רומא, 1748.
      </div>
    </div>
  );
}
