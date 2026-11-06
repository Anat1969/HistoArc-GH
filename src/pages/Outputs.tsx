import { useEffect, useState } from 'react';
import { download, store, uid, useStore, type OutputType } from '../lib/store';
import { generate, OUTPUT_LABEL } from '../lib/writer';
import { caseById } from '../data/cases';

/** minimal markdown → HTML for reading and printing (headings, bold, italics, lists, quotes, tables) */
function md(text: string) {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>');
  const out: string[] = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith('|')) {
      const rows: string[] = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        if (!/^\|[-| ]+\|$/.test(lines[i])) rows.push('<tr>' + lines[i].split('|').slice(1, -1).map((c) => `<td>${inline(c.trim())}</td>`).join('') + '</tr>');
        i++;
      }
      i--;
      out.push(`<table>${rows.join('')}</table>`);
    } else if (l.startsWith('### ')) out.push(`<h3>${inline(l.slice(4))}</h3>`);
    else if (l.startsWith('## ')) out.push(`<h2>${inline(l.slice(3))}</h2>`);
    else if (l.startsWith('# ')) out.push(`<h1>${inline(l.slice(2))}</h1>`);
    else if (l.startsWith('> ')) out.push(`<blockquote dir="auto">${inline(l.slice(2))}</blockquote>`);
    else if (/^(- |\d+\. )/.test(l)) out.push(`<p class="li">${inline(l.replace(/^- /, '• '))}</p>`);
    else if (l.trim()) out.push(`<p>${inline(l)}</p>`);
  }
  return out.join('\n');
}

export default function Outputs({ q }: { q: URLSearchParams }) {
  const { alts, outs } = useStore();
  const [openId, setOpenId] = useState<string | null>(q.get('id'));
  const doc = outs.find((o) => o.id === openId) ?? null;
  const [draft, setDraft] = useState(doc?.body ?? '');
  const [title, setTitle] = useState(doc?.title ?? '');
  const [mode, setMode] = useState<'read' | 'edit'>('read');
  const [pick, setPick] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  useEffect(() => {
    setDraft(doc?.body ?? '');
    setTitle(doc?.title ?? '');
    setStatus('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, doc?.updatedAt]);

  const create = (type: OutputType) => {
    const src = alts.filter((a) => pick.includes(a.id));
    const use = src.length ? src : alts.slice(0, 2);
    const g = generate(type, use);
    const id = uid();
    store.saveOut({ id, type, title: g.title, body: g.body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), altIds: use.map((a) => a.id) });
    setOpenId(id);
    setMode('read');
  };
  const save = () => {
    if (!doc) return;
    const ok = store.saveOut({ ...doc, title, body: draft, updatedAt: new Date().toISOString() });
    setStatus(ok ? 'נשמר' : 'השמירה נכשלה');
    setMode('read');
  };
  const printDoc = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:'IBM Plex Sans Hebrew',Arial,sans-serif;max-width:720px;margin:40px auto;line-height:1.7;color:#111}h1{font-size:24px}h2{font-size:18px;margin-top:24px}table{border-collapse:collapse;width:100%}td{border:1px solid #ddd;padding:4px 8px;font-size:13px}blockquote{direction:ltr;text-align:left;color:#555;border-left:3px solid #ccc;padding-left:12px}.li{margin:2px 0}</style></head><body>${md(draft)}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };
  const usedAlts = doc ? alts.filter((a) => doc.altIds.includes(a.id)) : [];

  return (
    <div className="page">
      <div className="lens">
        <p className="q">השאלה: מה למדנו, ואיך להשתמש בזה?</p>
        <h1>{doc ? doc.title : 'הפקת תוצר מתוך החלופות שנבדקו'}</h1>
        <p>כל תוצר נכתב מהערכים שנמדדו בחלופות. אפשר לערוך, לשמור, לייצא ולחזור לתרחיש שממנו נוצר.</p>
      </div>
      <div className="grid2" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 2fr)' }}>
        <aside>
          <section className="card">
            <p className="q">1. בוחרים חלופות (אם לא נבחר, שתי האחרונות)</p>
            {alts.length ? (
              <div style={{ display: 'grid', gap: 4 }}>
                {alts.map((a) => (
                  <label key={a.id} className="small" style={{ display: 'flex', gap: 6 }}>
                    <input type="checkbox" checked={pick.includes(a.id)} onChange={() => setPick((s) => (s.includes(a.id) ? s.filter((x) => x !== a.id) : [...s, a.id]))} />
                    {a.name}
                  </label>
                ))}
              </div>
            ) : (
              <p className="small">
                אין חלופות. <a href="#/lab?scenario=s-ashdod-street">פתחו תרחיש במעבדה</a> ושמרו אותו.
              </p>
            )}
            <p className="q" style={{ marginTop: 12 }}>
              2. בוחרים סוג תוצר
            </p>
            <div style={{ display: 'grid', gap: 6 }}>
              {(Object.keys(OUTPUT_LABEL) as OutputType[]).map((t) => (
                <button key={t} className="press" style={{ textAlign: 'start' }} disabled={!alts.length} onClick={() => create(t)}>
                  <b>{OUTPUT_LABEL[t].he}</b>
                  <div className="tiny muted">{OUTPUT_LABEL[t].what}</div>
                </button>
              ))}
            </div>
          </section>
          {outs.length > 0 && (
            <section className="card" style={{ marginTop: 12 }}>
              <p className="q">תוצרים שמורים</p>
              <div style={{ display: 'grid', gap: 4 }}>
                {outs.map((o) => (
                  <button key={o.id} className="press" aria-pressed={o.id === openId} style={{ textAlign: 'start' }} onClick={() => setOpenId(o.id)}>
                    {o.title}
                    <div className="tiny muted">{OUTPUT_LABEL[o.type].he} · עודכן {new Date(o.updatedAt).toLocaleString('he-IL')}</div>
                  </button>
                ))}
              </div>
            </section>
          )}
        </aside>
        <section>
          {doc ? (
            <div className="card">
              <div className="filters">
                <button className="press" aria-pressed={mode === 'read'} onClick={() => setMode('read')}>
                  קריאה
                </button>
                <button className="press" aria-pressed={mode === 'edit'} onClick={() => setMode('edit')}>
                  עריכה
                </button>
                <button className="press primary" onClick={save}>
                  שמירה
                </button>
                <button className="press" onClick={() => download(`${title}.md`, draft)}>
                  ייצוא Markdown
                </button>
                <button className="press" onClick={printDoc}>
                  הדפסה או PDF
                </button>
                <button
                  className="press ghost"
                  onClick={() => {
                    if (window.confirm('למחוק את התוצר?')) {
                      store.removeOut(doc.id);
                      setOpenId(null);
                    }
                  }}
                >
                  מחיקה
                </button>
                {status && <span className="small">{status}</span>}
              </div>
              {usedAlts.length > 0 && (
                <p className="small muted">
                  נוצר מתוך:{' '}
                  {usedAlts.map((a, i) => (
                    <span key={a.id}>
                      {i > 0 && ' · '}
                      <a href={`#/lab?case=${a.caseId}&code=${a.code}&${new URLSearchParams(Object.entries(a.theta).map(([k, v]) => [k, String(v)])).toString()}`}>
                        {a.name} ({caseById(a.caseId)?.he})
                      </a>
                    </span>
                  ))}
                </p>
              )}
              {mode === 'edit' ? (
                <>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="כותרת" style={{ width: '100%', font: 'inherit', fontWeight: 600, padding: 8, border: '1px solid var(--rule)', borderRadius: 7, marginBottom: 8 }} />
                  <textarea className="doc" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="גוף התוצר" />
                </>
              ) : (
                <article className="doc-view" dangerouslySetInnerHTML={{ __html: md(draft) }} />
              )}
            </div>
          ) : (
            <div className="card soft">בחרו סוג תוצר משמאל, או פתחו תוצר שמור.</div>
          )}
        </section>
      </div>
    </div>
  );
}
