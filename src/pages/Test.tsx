import { useState } from 'react';
import { CITY_CASES, DOC_TYPE, TRANSITIONS, caseById, caseWall } from '../data/cases';
import { CODE, CODES, T_LABEL } from '../engine/codes';
import type { CodeId } from '../engine/types';
import { agrees, cell, fitOf, structureOf, FIT_LABEL, FIT_THRESHOLD, judge, MODEL_VERDICT, stats } from '../lib/verdict';
import { go } from '../lib/route';
import { CodeMark } from '../components/Marks';
import { PARAM_META } from './Lab';

const WHY: Record<string, string> = {
  t4: 'פלמנובה משוחזרת בקוד הקוסמי, שהיה קיים אלפי שנים קודם. קריאה אפשרית: העיר האידיאלית כחזרה לקוסמי, לא כהכלאה.',
  t5: 'רומא של סיקסטוס משוחזרת בקוד האורגני: הצירים נחתכים בתוך רקמה קיימת. לפי המודל הבארוק הוא אורגני עם צירים, לא המשך של העיר האידיאלית.',
};

export default function Test() {
  const st = stats();
  const [tip, setTip] = useState<{ x: number; y: number; caseId: number; code: CodeId } | null>(null);
  const rows = [...CITY_CASES].sort((a, b) => a.year - b.year);
  const judged = TRANSITIONS.map((t) => ({ t, j: judge(t) }));
  const agree = judged.filter(({ t, j }) => agrees(t, j.verdict)).length;
  const ashdod = judged.find(({ t }) => t.id === 't11');

  const bg = (caseId: number, code: CodeId) => {
    const c = caseById(caseId)!;
    const f = fitOf(c, code);
    const e = cell(caseId, code).e;
    if (f === 'full') return { background: 'var(--evo)' };
    if (f === 'numbers') return { background: 'repeating-linear-gradient(-45deg, #cfe5d6 0 4px, var(--rev) 4px 5.5px)' };
    const t = Math.max(0, Math.min(1, (e - FIT_THRESHOLD) / 0.25));
    const l = Math.round(205 + t * 40);
    return { background: `rgb(${l},${l},${l - 4})` };
  };

  return (
    <div className="page">
      <div className="lens">
        <div className="kicker">
          מבחן הקוד · {st.runs} הרצות: {st.cities} ערים × {CODES.length} קודים
        </div>
        <h1>
          המספרים לבדם לא מבדילים בין קודים. <mark>המבנה, R ו-T,</mark> כן.
        </h1>
        <p>
          ב-<b>{st.foreignFull}</b> הרצות קוד זר משחזר עיר במלואה. ב-<b>{st.numbersOnly}</b> נוספות המספרים תואמים, אבל דופן הרחוב או האלמנטים שונים. {agree} מתוך {TRANSITIONS.length} המעברים ההיסטוריים מסכימים עם
          האפיון. {TRANSITIONS.length - agree} הם אנומליות, וכל אחת מצביעה על גן חסר.
        </p>
      </div>
      <div className="test">
        <section>
          <div className="label">מטריצת שחזור: האם הקוד בעמודה משחזר את העיר בשורה</div>
          <div className="legend">
            <span className="chip">
              <span className="sw" style={{ background: 'var(--evo)' }} />
              {FIT_LABEL.full}
            </span>
            <span className="chip">
              <span className="sw" style={{ background: 'repeating-linear-gradient(-45deg, #cfe5d6 0 3px, var(--rev) 3px 4.5px)' }} />
              {FIT_LABEL.numbers}
            </span>
            <span className="chip">
              <span className="sw" style={{ background: 'linear-gradient(90deg, rgb(205,205,201), rgb(245,245,241))' }} />
              לא משחזר: כהה יותר, קרוב יותר לסף
            </span>
            <span className="chip">
              <span className="sw" style={{ background: '#fff', boxShadow: 'inset 0 0 0 1px #ccc', position: 'relative' }}>
                <span style={{ position: 'absolute', width: 4, height: 4, background: '#111', top: 3, left: 3 }} />
              </span>
              הקוד של המקרה
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="heat">
              <thead>
                <tr>
                  <th />
                  {CODES.map((c) => (
                    <th key={c.id} title={c.short}>
                      <div style={{ display: 'grid', justifyItems: 'center', gap: 2 }}>
                        <CodeMark code={c.id} />
                        <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap' }}>{c.name}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td className="name" title={`${c.he} · ${c.period}`}>
                      <span className="mono muted tiny">{c.year < 0 ? -c.year + '-' : c.year} </span>
                      {c.he}
                    </td>
                    {CODES.map((code) => {
                      const f = fitOf(c, code.id);
                      return (
                        <td key={code.id}>
                          <div
                            className={'c' + (c.code === code.id ? ' own' : '') + (f === 'full' ? ' full' : '')}
                            style={bg(c.id, code.id)}
                            onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, caseId: c.id, code: code.id })}
                            onMouseLeave={() => setTip(null)}
                            onClick={() => go('/lab', { case: c.id, code: code.id })}
                            role="button"
                            aria-label={`${c.he} בקוד ${code.name}: ${FIT_LABEL[f]}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section>
          <div className="label">מעברי פרדיגמה: האפיון מול המודל</div>
          {ashdod && (
            <p style={{ margin: '0 0 10px', fontSize: 15 }}>
              <b>אשדוד:</b> קוד מגדל בפארק{' '}
              {fitOf(caseById(35)!, 'tower') === 'numbers' ? 'מגיע למספרים של אשדוד היום, אבל לא לדופן הרחוב' : 'לא מגיע למספרים של אשדוד היום'} (שגיאה{' '}
              <span className="mono">{ashdod.j.err.toFixed(3)}</span>). הקוד שמשחזר את שניהם הוא <b>{ashdod.j.by ? CODE[ashdod.j.by].name : '—'}</b>. לפי המודל זו <mark>חזרה של "המבנה מגדיר רחוב"</mark>, לא רק עלייה
              בצפיפות.
            </p>
          )}
          <div className="trans">
            {judged.map(({ t, j }) => {
              const ok = agrees(t, j.verdict);
              const to = caseById(t.to)!;
              return (
                <div key={t.id} className={'trow' + (ok ? '' : ' anom')}>
                  <div>
                    <b>{t.label}</b>
                    <div className="small muted">
                      <CodeMark code={t.from} size={8} /> {CODE[t.from].name} ← {to.he}
                    </div>
                  </div>
                  <span className="verdict" style={{ background: DOC_TYPE[t.doc].color }} title="סיווג האפיון">
                    {DOC_TYPE[t.doc].he}
                  </span>
                  <span className="verdict" style={{ background: MODEL_VERDICT[j.verdict].color }} title="סיווג המודל">
                    {MODEL_VERDICT[j.verdict].he}
                  </span>
                  <div className="why">
                    {ok ? (
                      <>
                        {t.docNote}.{' '}
                        {j.by && j.verdict !== 'evolution' && (
                          <>
                            משחזר: <b>{CODE[j.by].name}</b>.
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <b>אנומליה.</b> {WHY[t.id] ?? t.docNote}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="legend" style={{ marginTop: 10 }}>
            <span className="chip">תווית ראשונה: האפיון. שנייה: המודל.</span>
            <span className="chip">
              <span className="sw" style={{ background: 'var(--evo)' }} />
              אבולוציה
            </span>
            <span className="chip">
              <span className="sw" style={{ background: 'var(--hyb)' }} />
              הכלאה
            </span>
            <span className="chip">
              <span className="sw" style={{ background: 'var(--rev)' }} />
              מהפכה
            </span>
            <span className="chip">
              <span className="sw" style={{ background: 'var(--res)' }} />
              רסטורציה
            </span>
          </div>
          <p className="tiny muted">
            כלל ההכרעה [ה]: הקוד הקודם משחזר את המקרה החדש (שגיאה עד {FIT_THRESHOLD}, דופן רחוב תואמת ואותם אלמנטים T): אבולוציה. אחרת, קוד שכבר היה בשימוש לפני המקרה משחזר: רסטורציה. אחרת, כשהמספרים
            תואמים: מהפכה באלמנט T או ביחס R. כשלא: מהפכה בכלל P. שום קוד לא משחזר: הכלאה.
          </p>
        </section>
      </div>
      {tip && (
        <div className="tip" style={{ left: Math.min(tip.x + 14, window.innerWidth - 290), top: tip.y + 14 }}>
          {(() => {
            const c = caseById(tip.caseId)!;
            const x = cell(tip.caseId, tip.code);
            return (
              <>
                <b>{c.he}</b> בקוד <b>{CODE[tip.code].name}</b>
                <div className="mono" style={{ fontSize: 18 }}>{x.e.toFixed(3)}</div>
                <div className="small">{FIT_LABEL[fitOf(c, tip.code)]}</div>
                <div className="mono tiny" style={{ marginTop: 4 }}>
                  {(['O', 'I', 'E', 'H', 'G'] as const).map((p) => `${p} ${x.p[p].toFixed(2)}`).join(' · ')}
                </div>
                <div className="tiny muted">
                  דופן רחוב: במודל {Math.round(x.m.wall * 100)}%, במקרה {caseWall(c) ? 'רציפה' : 'נעדרת'}.
                  {structureOf(c, x.m).tDiff.length > 0 && <> אלמנטים שונים: {structureOf(c, x.m).tDiff.map((k) => T_LABEL[k]).join(', ')}.</>} הסטייה הגדולה: {PARAM_META[(['O', 'I', 'E', 'H', 'G'] as const).reduce((a, b) => (x.p[a] > x.p[b] ? a : b))].he}.
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
