import { lazy, Suspense, useState } from 'react';
import { caseById, TRANSITIONS } from '../data/cases';
import { CODE, CODES, LYNCH } from '../engine/codes';
import type { CodeId } from '../engine/types';
import { agrees, cell, fitOf, FIT_THRESHOLD, judge, stats } from '../lib/verdict';
import { useModel } from '../lib/gen';
import { CodeMark } from '../components/Marks';

const City3D = lazy(() => import('../components/City3D'));
const DEMO = 24; // Ville Radieuse

export default function Home() {
  const vr = caseById(DEMO)!;
  const [code, setCode] = useState<CodeId>('tower');
  const { model } = useModel(vr.theta!, code, cell(DEMO, code).k);
  const [rise, setRise] = useState(0);
  const st = stats();
  const anomalies = TRANSITIONS.filter((t) => !agrees(t, judge(t).verdict)).length;
  const pick = (c: CodeId) => {
    setCode(c);
    setRise((r) => r + 1);
  };
  const side = (c: CodeId) => {
    const x = cell(DEMO, c);
    const f = fitOf(vr, c);
    return { e: x.e, wall: x.m.wall, f };
  };
  const g = side('grid');
  const t = side('tower');

  return (
    <div className="page">
      <div className="home">
        <section>
          <div className="kicker">גנוטיפ אחד לעיר ולבניין · {CODES.length + 5} קודים · 38 מקרים · 5 מחוונים</div>
          <h1 className="hero-h">
            ערך משתנה: אבולוציה.
            <br />
            <mark>יחס משתנה: מהפכה.</mark>
          </h1>
          <p className="hero-p">
            המחולל בונה עיר מקוד ומחמישה ערכים, מודד אותה, ובודק אם קוד אחד מסביר עיר של קוד אחר.
          </p>
          <div className="psi">
            <div>
              <div className="h" style={{ color: 'var(--rev)' }}>
                בעיה
              </div>
              מורפולוגיה, תחביר מרחבי והיסטוריה סגנונית מודדים ביחידות שונות. אי אפשר להעמיד את מוהנג'ו-דארו מול ברזיליה.
            </div>
            <div>
              <div className="h" style={{ color: 'var(--evo)' }}>
                פתרון
              </div>
              סכמה אחת: קוד = (T, R, P) ועוד <b>θ</b> של חמישה ערכים זהים בכל עיר. המחולל הופך אותה לעיר ומודד חזרה.
            </div>
            <div>
              <div className="h">תובנה</div>
              ב-<b>{st.numbersOnly}</b> הרצות המספרים תואמים והעיר שונה. <mark>היחס בין הבית לרחוב</mark> הוא מה שמבדיל.
            </div>
          </div>
          <div className="label">מפת התוכן</div>
          <div className="map">
            <a className="press" href="#/lab">
              <span className="n">5</span>
              <span className="t">מעבדה</span>
              <span className="d">מזיזים ערך, מחליפים קוד, ורואים את העיר נבנית ונמדדת.</span>
            </a>
            <a className="press" href="#/atlas">
              <span className="n">{st.cities}</span>
              <span className="t">פרלל</span>
              <span className="d">כל הערים באותו קנה מידה, ומטריצת המרחב.</span>
            </a>
            <a className="press" href="#/test">
              <span className="n">{st.runs}</span>
              <span className="t">מבחן הקוד</span>
              <span className="d">
                כל עיר בכל קוד. {anomalies} אנומליות מול האפיון.
              </span>
            </a>
            <a className="press" href="#/method">
              <span className="n">{FIT_THRESHOLD}</span>
              <span className="t">שיטה</span>
              <span className="d">תקן, נוסחה ואמינות לכל מחוון.</span>
            </a>
          </div>
          <div className="inspo">
            השראה: ז'.נ.ל. דוראן (J.-N.-L. Durand), Recueil et parallèle des édifices, 1799–1801: כל המבנים באותו קנה מידה. ג'מבטיסטה נולי (Giambattista Nolli), מפת רומא, 1748: דמות ורקע.
          </div>
        </section>
        <section className="canvas-wrap hero-3d" aria-label="העיר הקורנת בשני קודים">
          <Suspense fallback={<div className="busy">טוען תלת-ממד</div>}>
            <City3D model={model} rise={rise} />
          </Suspense>
          <div className="compare">
            {(
              [
                ['grid', g],
                ['tower', t],
              ] as const
            ).map(([c, x]) => (
              <button key={c} className="press" aria-pressed={code === c} onClick={() => pick(c)}>
                <span className="small" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <CodeMark code={c} /> הקוד: {CODE[c].name}
                </span>
                <span className="e">{x.e.toFixed(3)}</span>
                <span className="small">
                  {x.f === 'full' ? 'משחזר' : 'לא משחזר'} · דופן רחוב {Math.round(x.wall * 100)}%
                </span>
              </button>
            ))}
          </div>
          <div className="overlay">
            <b>העיר הקורנת, 1930.</b> אותם ערכים: FSI {vr.theta!.I}, GSI {vr.theta!.E}.
            <br />
            הרשת מגיעה קרוב, אבל <span style={{ color: 'var(--rev)' }}>הרחוב נשאר</span>. במגדל בפארק <span style={{ color: 'var(--evo)' }}>הרחוב נעלם</span>.
            <div className="chip" style={{ marginTop: 4 }}>
              <span className="sw" style={{ background: LYNCH[CODE[code].lynch].color }} />
              {LYNCH[CODE[code].lynch].name}: {LYNCH[CODE[code].lynch].note}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
