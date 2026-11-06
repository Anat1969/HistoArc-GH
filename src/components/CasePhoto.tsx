import imagesJson from '../data/images.json';
import type { Case } from '../data/cases';
import { CODE } from '../engine/codes';
import type { CodeId } from '../engine/types';

interface Img {
  title: string;
  thumb: string;
  page: string;
  author: string;
  license: string;
  licenseUrl?: string;
  desc?: string;
}
const IMAGES = imagesJson as Record<string, Img>;

/** what to look for in a photograph of each code: ties the picture to the model's claim */
const WATCH: Partial<Record<CodeId, string>> = {
  organic: 'רוחב הרחובות והאופן שבו הבתים צמודים זה לזה.',
  medina: 'סמטאות שנגמרות בדלת, וחצרות שנפתחות רק פנימה.',
  grid: 'קו הבניין הרציף לאורך הרחוב, והחצר בתוך הבלוק.',
  cosmic: 'הציר, המרכז והחומה: העיר כתרשים של סדר.',
  ideal: 'הקרניים שיוצאות מהמרכז והביצור המצולע.',
  grand: 'השדרה שחותכת את הרקמה ונגמרת במונומנט.',
  garden: 'הבית שנסוג מהרחוב, והגינה שביניהם.',
  tower: 'המבנים החופשיים, והמרחק בינם לבין הרחוב.',
  palladian: 'הציר, האכסדרה והכיפה מעל האולם.',
  prairie: 'הגגות השטוחים שנמתחים מעבר לקירות.',
  frame: 'העמודים הדקים והחזית הפתוחה.',
  capsule: 'הקפסולות התלויות על הגרעין, כל אחת עם חלון עגול.',
  continuous: 'המשטח שעובר מקיר לגג בלי תפר.',
};

export function CasePhoto({ c }: { c: Case }) {
  const img = IMAGES[String(c.id)];
  if (!img)
    return (
      <div className="small muted">
        תמונה: עדיין לא נאספה.{' '}
        {c.commons && (
          <a href={c.commons} target="_blank" rel="noreferrer">
            לתמונות ב-Wikimedia Commons
          </a>
        )}
      </div>
    );
  return (
    <figure className="photo" style={{ margin: 0 }}>
      <a href={img.page} target="_blank" rel="noreferrer">
        <img src={img.thumb} alt={img.desc || img.title} loading="lazy" referrerPolicy="no-referrer" />
      </a>
      <figcaption className="cap">
        <div>
          <b>מה רואים:</b> {img.desc || img.title.replace(/^File:/, '').replace(/\.[a-z]+$/i, '')}
        </div>
        {WATCH[c.code] && (
          <div>
            <b>למה לשים לב:</b> {WATCH[c.code]} ({CODE[c.code].name})
          </div>
        )}
        <div className="tiny muted">
          צילום: {img.author || 'לא צוין'} · {img.licenseUrl ? <a href={img.licenseUrl}>{img.license}</a> : img.license} · Wikimedia Commons. נבחר אוטומטית מהקטגוריה של המקרה.
        </div>
      </figcaption>
    </figure>
  );
}
