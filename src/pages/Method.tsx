import { ALL_CODES as CODES } from '../engine/codes';
import { CITY_CASES } from '../data/cases';
import { FIT_THRESHOLD } from '../engine/measure';
import { CodeMark } from '../components/Marks';

const IND = [
  {
    p: 'O',
    he: 'סדר',
    f: 'φ = 1 − ((H₀ − ln4) / (ln36 − ln4))²',
    std: 'Boeing 2019, Applied Network Science 4:67. 36 תאים של 10°, שני הכיוונים.',
    rel: 'במודל: O = max(φ, φ יחסי למרכז), כדי שעיר רדיאלית לא תיחשב אקראית. אורכי הרחובות משמשים משקל [ה]. בנתונים אמיתיים: תלוי בשלמות OSM ובתיחום.',
  },
  {
    p: 'I',
    he: 'עוצמה',
    f: 'FSI = Σ(footprint × floors) / site area',
    std: 'Spacematrix, Berghauser Pont & Haupt 2010.',
    rel: 'נמדד ישירות מהמודל. קומה = 3.3 מ\'. במקרים היסטוריים ההערכה נשענת על שחזור, ולכן ודאות נמוכה.',
  },
  {
    p: 'E',
    he: 'סגירות',
    f: 'GSI = Σ footprint / site area',
    std: 'Spacematrix, 2010.',
    rel: 'נמדד ישירות. חומות ותשתית אינן נספרות. השגיאה מחושבת בהפרש מוחלט.',
  },
  {
    p: 'H',
    he: 'היררכיה',
    f: 'H = 1 − (1−hw)(1−hd)(1−hg)',
    std: 'מורכב [ה]: שונות רוחב הרחובות, מתאם שלילי בין גובה למרחק מהמרכז, ג\'יני של הקומות.',
    rel: 'המחוון החלש ביותר. החלופה המבוססת: שונות של integration ב-depthmapX (Hillier & Hanson 1984), עם דיווח על הרדיוס.',
  },
  {
    p: 'G',
    he: 'גרעין',
    f: 'G = √(site area / blocks)',
    std: 'Conzen 1960; Atlas of Urban Expansion.',
    rel: 'בלוק מלבני מיוצג בממוצע גיאומטרי של הצלעות [ה]. השגיאה ב-I וב-G נמדדת בעשרות לוגריתמיות.',
  },
];

const SOURCES = [
  'J.-N.-L. Durand, Recueil et parallèle des édifices, 1799–1801; Précis des leçons, 1802–1805',
  'G. B. Nolli, Nuova pianta di Roma, 1748',
  'K. Lynch, The Image of the City, 1960; Good City Form, 1981',
  'S. Kostof, The City Shaped, 1991; The City Assembled, 1992',
  'M. R. G. Conzen, Alnwick, Northumberland, 1960',
  'G. Caniggia & G. L. Maffei, Composizione architettonica e tipologia edilizia, 1979',
  'B. Hillier & J. Hanson, The Social Logic of Space, 1984',
  'G. Stiny & J. Gips, Shape Grammars, 1972; Stiny & Mitchell, The Palladian Grammar, 1978',
  'M. Berghauser Pont & P. Haupt, Spacematrix, 2010',
  'G. Boeing, Urban spatial order, Applied Network Science 4:67, 2019. doi:10.1007/s41109-019-0189-1 [אומת]',
  'T. S. Kuhn, The Structure of Scientific Revolutions, 1962; 2nd ed. 1970, p. 150 [אומת]',
  'P. Steadman, The Evolution of Designs, 1979 (2008)',
  'P. Schumacher, The Autopoiesis of Architecture, 2011–2012',
];

export default function Method() {
  return (
    <div className="page">
      <div className="lens">
        <div className="kicker">שיטה · על מה הכלי נשען ואיך הוא מודד את האמינות שלו</div>
        <h1>
          קוד = (T, R, P, θ). <mark>שינוי ב-θ הוא אבולוציה</mark>, שינוי ב-T, R או P הוא מהפכה.
        </h1>
        <p>
          המחולל מקבל קוד וחמישה ערכים, בונה עיר, מודד אותה באותם מחוונים ומחזיר שגיאה. קוד משחזר מקרה כשהשגיאה עד <b>{FIT_THRESHOLD}</b> ודופן הרחוב תואמת.
        </p>
      </div>
      <div className="method">
        <section>
          <h2>חמשת המחוונים</h2>
          <p className="small" style={{ margin: '0 0 8px' }}>
            <b>בקנה בניין</b> אותם חמישה, בפירוש של סעיף 4.2: סדר = סימטריה ומודול, עוצמה = שטח רצפות לטביעת רגל, סגירות = חלק המלא בחזית, היררכיה = 1 פחות חציון החללים לגדול שבהם, גרעין =
            מפתח החזית. היחס R: <b>הקיר נושא את המבנה</b>, המקבילה של "המבנה מגדיר את הרחוב".
          </p>
          <div className="ind">
            {IND.map((x) => (
              <div key={x.p}>
                <div className="t">
                  {x.he} <span className="mono muted">{x.p}</span>
                </div>
                <div className="f">{x.f}</div>
                <div className="small">
                  <b>תקן:</b> {x.std}
                </div>
                <div className="small muted">
                  <b>אמינות:</b> {x.rel}
                </div>
              </div>
            ))}
          </div>
        </section>
        <section>
          <h2>{CODES.length} קודים: 9 לעיר, 5 לבניין</h2>
          <div className="ind">
            {CODES.map((c) => (
              <div key={c.id} style={{ padding: '8px 10px' }}>
                <div className="t" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <CodeMark code={c.id} />
                  {c.name} <span className="small muted">· {c.short}</span>
                </div>
                <div className="small">
                  <b>R:</b> {c.R.join(' · ')}
                </div>
                <div className="mono tiny muted">
                  O <bdi>{c.bounds.O.join('–')}</bdi> · H <bdi>{c.bounds.H.join('–')}</bdi> · G <bdi>{c.bounds.G.join('–')}</bdi> מ' · עד {c.floorsMax} קומות
                  {c.depth ? (
                    <>
                      {' '}
                      · עומק <bdi>{`${c.depth[0]}–${c.depth[1] > 100 ? '∞' : c.depth[1]}`}</bdi> מ'
                    </>
                  ) : (
                    ' · ביתן חופשי'
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="small">
            <b>התחומים הם הערכות [ה].</b> הם מתרגמים כללים לגבולות: בלוק עם דופן רחוב מוגבל בעומק בגלל אור, ועיר קוסמית טרום-תעשייתית מוגבלת בקומות.
          </p>
          <h2 style={{ marginTop: 16 }}>מה המודל לא רואה</h2>
          <ul className="small" style={{ paddingInlineStart: 16, margin: 0 }}>
            <li>מבחן T רואה שלושה אלמנטים בלבד: מרכז, רחוב ללא מוצא ובית חצר. חגורה ירוקה, חומה וציר נמדדים דרך θ ו-R.</li>
            <li>שימושי קרקע, טקטוניקה וחומר: נשמרים כגנים תיאוריים, לא נמדדים.</li>
            <li>קנה מבנה: באוהאוס, נאקאגין והיידר אלייב מחוץ למחולל בגרסה זו.</li>
          </ul>
        </section>
        <section>
          <h2>שכבת ידע</h2>
          <blockquote className="quote" dir="ltr" style={{ textAlign: 'left' }}>
            “In a sense that I am unable to explicate further, the proponents of competing paradigms practice their trades in different worlds.”
          </blockquote>
          <p className="small" style={{ margin: '6px 0 0' }}>
            במובן שאינני יכול להסביר יותר, תומכיהן של פרדיגמות מתחרות עוסקים במלאכתם בעולמות שונים.
          </p>
          <div className="tiny muted">Thomas Kuhn, The Structure of Scientific Revolutions, מהדורה שנייה 1970, עמ' 150. אומת. התרגום שלי.</div>
          <p style={{ marginTop: 12 }}>
            <mark>תובנה:</mark> בעולם של לה קורבוזיה ובעולם של סרדה יכולים להיות אותם מספרים. מה שמשתנה הוא היחס בין הבית לרחוב.
          </p>
          <p className="haiku">
            אותם מספרים,
            <br />
            רשת אבן ומגדל.
            <br />
            הרחוב נעלם.
          </p>
          <div className="hr" />
          <h2>סטטוס ידע</h2>
          <p className="small" style={{ margin: 0 }}>
            <span className="tag">[ע]</span> עובדה ביבליוגרפית. <span className="tag">[ה]</span> הערכה. <span className="tag">[נ]</span> הנחה.
            <br />
            {CITY_CASES.filter((c) => c.assessed).length ? <>ערכי θ של <b>{CITY_CASES.filter((c) => c.assessed).length}</b> ערים נמדדו מ-OpenStreetMap (O, I, E, G). השאר </> : <>כל ערכי θ </>}הם הערכות ראשוניות מהאפיון. הכיול רץ בשרתי GitHub (pipeline/calibrate.py). H נשאר הערכה עד הרצת depthmapX. מקרים שלא שרדו (בבל, צ'אנג-אן) נשענים על שחזורים שנויים במחלוקת.
          </p>
          <div className="hr" />
          <h2>מקורות</h2>
          <ul className="src" dir="ltr" style={{ textAlign: 'left', paddingLeft: 16, margin: 0 }}>
            {SOURCES.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <p className="tiny muted">שני מקורות אומתו ברשת (מסומנים). השאר מבוססים על ידע מחקרי מוכר, ויש לאמת שנה ומהדורה מול קטלוג ספרייה.</p>
        </section>
      </div>
    </div>
  );
}
