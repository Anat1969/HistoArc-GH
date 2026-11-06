import { useEffect, useRef, useState } from 'react';
import { caseById } from '../data/cases';
import { CODE, R_LABEL } from '../engine/codes';
import type { Model } from '../engine/types';
import { LENSES, SCENARIOS } from '../data/knowledge';
import { requestModel } from '../lib/gen';
import { download, store, uid, useStore, type Alternative } from '../lib/store';
import { generate, fmtP } from '../lib/writer';
import { go } from '../lib/route';
import { Plan } from '../components/Plan';
import { CodeMark } from '../components/Marks';

const P = ['O', 'I', 'E', 'H', 'G'] as const;
const PN = { O: 'סדר', I: 'עוצמה', E: 'סגירות', H: 'היררכיה', G: 'גרעין' } as const;

function AltPlan({ a }: { a: Alternative }) {
  const [m, setM] = useState<Model | null>(null);
  useEffect(() => {
    let alive = true;
    requestModel(a.theta, a.code, a.knobs).then((x) => alive && setM(x));
    return () => {
      alive = false;
    };
  }, [a]);
  return <Plan model={m} windowM={a.scale === 'building' ? 70 : 700} scaleBar />;
}

const labLink = (a: Alternative) => `#/lab?case=${a.caseId}&code=${a.code}&${new URLSearchParams(Object.entries(a.theta).map(([k, v]) => [k, String(v)])).toString()}`;

export default function Alts() {
  const { alts } = useStore();
  const [sel, setSel] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const chosen = alts.filter((a) => sel.includes(a.id));
  const scale = chosen[0]?.scale ?? 'city';
  const sameScale = chosen.every((a) => a.scale === scale);
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 3 ? [...s.slice(1), id] : [...s, id]));
  const makeOutput = (type: 'compare' | 'insights' | 'article') => {
    const g = generate(type, chosen.length ? chosen : alts.slice(0, 2));
    const id = uid();
    store.saveOut({ id, type, title: g.title, body: g.body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), altIds: (chosen.length ? chosen : alts.slice(0, 2)).map((a) => a.id) });
    go('/out', { id });
  };

  return (
    <div className="page">
      <div className="lens">
        <p className="q">השאלה: מה ההבדל בין החלופות, ומה המחיר של כל אחת?</p>
        <h1>{alts.length ? `${alts.length} חלופות שמורות. בחרו עד שלוש להשוואה.` : 'עדיין אין חלופות שמורות.'}</h1>
        <p>חלופה היא אתר, קוד וחמישה ערכים, יחד עם מה שנמדד במודל. היא נשמרת בדפדפן הזה ונשארת אחרי טעינה מחדש.</p>
      </div>

      {!alts.length && (
        <div className="card soft">
          <b>התחלה מהירה:</b> שני תרחישים באותה צפיפות, בשני קודים. פתחו כל אחד ולחצו "שמור כחלופה".
          <div className="filters" style={{ marginTop: 8 }}>
            {SCENARIOS.filter((s) => s.id.startsWith('s-ashdod')).map((s) => (
              <a key={s.id} className="press" href={`#/lab?scenario=${s.id}`} style={{ textDecoration: 'none' }}>
                {s.title}
              </a>
            ))}
          </div>
        </div>
      )}

      {alts.length > 0 && (
        <>
          <div className="filters">
            <button className="press primary" disabled={chosen.length < 2 || !sameScale} onClick={() => makeOutput('compare')}>
              הפק השוואה מנומקת
            </button>
            <button className="press" disabled={!chosen.length} onClick={() => makeOutput('insights')}>
              הפק תקציר תובנות
            </button>
            <button className="press" disabled={!chosen.length} onClick={() => makeOutput('article')}>
              הפק מאמר
            </button>
            <span style={{ flex: 1 }} />
            <button className="press" onClick={() => download(`histoarc-${new Date().toISOString().slice(0, 10)}.json`, store.exportAll(), 'application/json')}>
              ייצוא לקובץ
            </button>
            <button className="press" onClick={() => fileRef.current?.click()}>
              ייבוא מקובץ
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const r = store.importAll(await f.text());
                  setMsg(`יובאו ${r.alts} חלופות ו-${r.outs} תוצרים.`);
                } catch (err) {
                  setMsg(String((err as Error).message));
                }
              }}
            />
          </div>
          {msg && <p className="small">{msg}</p>}
          {!sameScale && <p className="small" style={{ color: 'var(--rev)' }}>אפשר להשוות רק חלופות באותו קנה מידה.</p>}

          {chosen.length >= 2 && sameScale && (
            <section className="card" style={{ marginBottom: 16 }}>
              <p className="q">ההשוואה</p>
              <div className={chosen.length === 3 ? 'grid3' : 'grid2'}>
                {chosen.map((a) => (
                  <div key={a.id} style={{ maxWidth: 340 }}>
                    <b>{a.name}</b>
                    <AltPlan a={a} />
                  </div>
                ))}
              </div>
              <div style={{ overflowX: 'auto', marginTop: 10 }}>
                <table className="heat" style={{ fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'start' }}>מדד</th>
                      {chosen.map((a) => (
                        <th key={a.id} style={{ textAlign: 'start' }}>
                          {a.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {P.map((p) => (
                      <tr key={p}>
                        <td className="name">{PN[p]}</td>
                        {chosen.map((a) => (
                          <td key={a.id} className="mono">
                            {fmtP(p, a.measured[p])}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr>
                      <td className="name">{R_LABEL[scale]}</td>
                      {chosen.map((a) => (
                        <td key={a.id} className="mono">
                          {scale === 'city' ? `${Math.round(a.measured.wall * 100)}%` : a.measured.wall >= 0.5 ? 'כן' : 'לא'}
                        </td>
                      ))}
                    </tr>
                    {LENSES[scale].map((l) => {
                      const vals = chosen.map((a) => l.value(a.measured));
                      const best = l.better === 'up' ? Math.max(...vals) : l.better === 'down' ? Math.min(...vals) : NaN;
                      return (
                        <tr key={l.id}>
                          <td className="name">
                            <b>{l.he}</b>
                          </td>
                          {chosen.map((a, i) => (
                            <td key={a.id} className="mono" style={{ color: vals[i] === best && new Set(vals).size > 1 ? 'var(--evo)' : undefined, fontWeight: vals[i] === best ? 600 : 400 }}>
                              {l.fmt(vals[i])}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="tiny muted">ירוק: הערך הטוב בעדשה. העדשות הן פרשנות לפי הספרות, לא מדידה של התנהגות.</p>
            </section>
          )}

          <div className="tiles" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {alts.map((a) => (
              <div key={a.id} className="card" style={{ padding: 12, boxShadow: sel.includes(a.id) ? '0 0 0 2px var(--machine)' : undefined }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                  <input type="checkbox" checked={sel.includes(a.id)} onChange={() => toggle(a.id)} />
                  <b>{a.name}</b>
                </label>
                <div className="small muted" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <CodeMark code={a.code} /> {CODE[a.code].name} · {caseById(a.caseId)?.he ?? 'חופשי'} · {new Date(a.createdAt).toLocaleDateString('he-IL')}
                </div>
                <div className="small" style={{ marginTop: 4 }}>
                  {a.fit === 'full' ? 'בתוך הקוד, מספרים ומבנה' : a.fit === 'numbers' ? 'מספרים בלבד, המבנה שונה' : a.fit === 'none' ? 'מחוץ לתחום הקוד' : 'ערכים חופשיים'}
                </div>
                {a.note && <div className="tiny muted">{a.note}</div>}
                <div className="filters" style={{ marginTop: 6, marginBottom: 0 }}>
                  <a className="press" href={labLink(a)} style={{ textDecoration: 'none' }}>
                    פתח במעבדה
                  </a>
                  <button className="press ghost" onClick={() => window.confirm('למחוק את החלופה?') && store.removeAlt(a.id)}>
                    מחיקה
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
