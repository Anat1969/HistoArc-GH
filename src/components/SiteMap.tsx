import { useEffect, useRef, useState } from 'react';
import maplibregl, { type Map as MLMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Model } from '../engine/types';
import { clearAlign, saveAlign, type Align, type Place } from '../lib/place';

const STYLES = {
  sat: { tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], attribution: 'תצלום: Esri, Maxar, Earthstar Geographics' },
  osm: { tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], attribution: '© OpenStreetMap contributors' },
} as const;

/** model metres → longitude/latitude, after the alignment (rotate, scale, shift) */
function toGeo(model: Model, lat: number, lon: number, a: Align) {
  const kx = 111320 * Math.cos((lat * Math.PI) / 180);
  const ky = 110540;
  const r = (a.rot * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const tr = ([x, y]: [number, number]) => {
    const X = (x * c - y * s) * a.scale + a.dx;
    const Y = (x * s + y * c) * a.scale + a.dy;
    return [lon + X / kx, lat + Y / ky];
  };
  const isB = model.scale === 'building';
  const feats = [
    // building scale: the rooms as a filled footprint, so the plan reads against the roof
    ...(isB ? model.lots.map((l) => ({ kind: 'room', poly: l.poly })) : []),
    ...model.buildings.filter((b) => !isB || (b.z0 ?? 0) < 1).filter((b) => b.kind !== 'slab' && b.kind !== 'glass').map((b) => ({ kind: b.kind as string, poly: b.poly })),
  ];
  return {
    type: 'FeatureCollection' as const,
    features: feats.map((f) => ({ type: 'Feature' as const, properties: { kind: f.kind }, geometry: { type: 'Polygon' as const, coordinates: [[...f.poly, f.poly[0]].map(tr)] } })),
  };
}

export function SiteMap({ model, place, caseId, color }: { model: Model | null; place: Place; caseId: number; color: string }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const [base, setBase] = useState<'sat' | 'osm'>('sat');
  const [opacity, setOpacity] = useState(0.6);
  const [a, setA] = useState<Align>(place.align);
  const [msg, setMsg] = useState(place.alignSource === 'saved' ? 'יישור שמור' : place.alignSource === 'streets' ? 'הזווית חושבה מכיוון הרחובות האמיתיים' : '');
  const aRef = useRef(a);
  aRef.current = a;
  const { lat, lon } = place;
  const isB = model?.scale === 'building';

  useEffect(() => {
    if (!el.current) return;
    const m = new maplibregl.Map({
      container: el.current,
      style: { version: 8, sources: { base: { type: 'raster', tiles: [...STYLES[base].tiles], tileSize: 256, attribution: STYLES[base].attribution, maxzoom: 19 } }, layers: [{ id: 'base', type: 'raster', source: 'base' }] },
      center: [lon, lat],
      zoom: isB ? 18 : 15,
      attributionControl: { compact: true },
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-left');
    m.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    // drag the model itself to align it with the photograph
    let start: maplibregl.LngLat | null = null;
    let a0: Align | null = null;
    m.on('mousedown', 'model-fill', (e) => {
      e.preventDefault();
      start = e.lngLat;
      a0 = aRef.current;
      m.getCanvas().style.cursor = 'grabbing';
    });
    m.on('mousemove', (e) => {
      if (!start || !a0) return;
      const kx = 111320 * Math.cos((lat * Math.PI) / 180);
      setA({ ...a0, dx: a0.dx + (e.lngLat.lng - start.lng) * kx, dy: a0.dy + (e.lngLat.lat - start.lat) * 110540 });
    });
    m.on('mouseup', () => {
      start = null;
      m.getCanvas().style.cursor = '';
    });
    m.on('mouseenter', 'model-fill', () => (m.getCanvas().style.cursor = 'grab'));
    m.on('mouseleave', 'model-fill', () => !start && (m.getCanvas().style.cursor = ''));
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon, base]);

  useEffect(() => {
    const m = map.current;
    if (!m || !model) return;
    const put = () => {
      const data = toGeo(model, lat, lon, a);
      const src = m.getSource('model') as maplibregl.GeoJSONSource | undefined;
      if (src) src.setData(data);
      else {
        m.addSource('model', { type: 'geojson', data });
        m.addLayer({ id: 'model-fill', type: 'fill', source: 'model', paint: { 'fill-color': ['match', ['get', 'kind'], 'room', '#ffffff', 'fabric', '#ffffff', 'column', '#222222', color], 'fill-opacity': ['match', ['get', 'kind'], 'room', 0.35, 1] } });
        m.addLayer({ id: 'model-line', type: 'line', source: 'model', paint: { 'line-color': '#111111', 'line-width': 0.8 } });
      }
      m.setPaintProperty('model-fill', 'fill-opacity', ['match', ['get', 'kind'], 'room', opacity * 0.5, opacity]);
      m.setPaintProperty('model-line', 'line-opacity', Math.min(1, opacity + 0.2));
    };
    if (m.isStyleLoaded()) put();
    else m.once('load', put);
  }, [model, lat, lon, opacity, color, base, a]);

  const set = (patch: Partial<Align>) => setA((x) => ({ ...x, ...patch }));
  return (
    <div className="map-wrap" style={{ position: 'absolute', inset: 0 }}>
      <div ref={el} style={{ position: 'absolute', inset: 0 }} />
      <div className="overlay" style={{ pointerEvents: 'auto', maxWidth: 320, bottom: 28 }}>
        <b>המודל על רקע האתר.</b> הלבן הוא מודל, לא המבנים הקיימים. גררו אותו כדי ליישר.
        <div className="tiny muted">
          מיקום: {place.note} ({place.source === 'wikidata' ? 'Wikidata' : place.source === 'calibration' ? 'נקודת הכיול' : 'מקורב [ה]'}). {msg}
        </div>
        <div className="small" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '2px 8px', alignItems: 'center', marginTop: 6 }}>
          <span>זווית</span>
          <input type="range" min={-90} max={90} step={0.5} value={a.rot} onChange={(e) => set({ rot: +e.target.value })} aria-label="זווית המודל" />
          <span className="mono">{a.rot.toFixed(1)}°</span>
          <span>קנה מידה</span>
          <input type="range" min={0.5} max={2} step={0.01} value={a.scale} onChange={(e) => set({ scale: +e.target.value })} aria-label="קנה מידה" />
          <span className="mono">×{a.scale.toFixed(2)}</span>
          <span>שקיפות</span>
          <input type="range" min={0.1} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(+e.target.value)} aria-label="שקיפות" />
          <span className="mono">{Math.round(opacity * 100)}%</span>
        </div>
        <div className="tiny muted">
          הזזה: {Math.round(a.dx)} מ' מזרחה, {Math.round(a.dy)} מ' צפונה. קנה מידה ×1 = המידות האמיתיות של המודל.
        </div>
        <div className="filters" style={{ margin: '6px 0 0' }}>
          {(
            [
              ['←', { dx: a.dx - (isB ? 1 : 10) }],
              ['→', { dx: a.dx + (isB ? 1 : 10) }],
              ['↑', { dy: a.dy + (isB ? 1 : 10) }],
              ['↓', { dy: a.dy - (isB ? 1 : 10) }],
            ] as [string, Partial<Align>][]
          ).map(([t, p]) => (
            <button key={t} className="press" style={{ padding: '2px 8px' }} onClick={() => set(p)} aria-label={`הזזה ${t}`}>
              {t}
            </button>
          ))}
          <button className="press primary" style={{ padding: '4px 10px' }} onClick={() => setMsg(saveAlign(caseId, a) ? 'היישור נשמר לאתר הזה' : 'השמירה נכשלה')}>
            שמור יישור
          </button>
          <button
            className="press ghost"
            onClick={() => {
              clearAlign(caseId);
              setA({ dx: 0, dy: 0, rot: place.alignSource === 'streets' ? place.align.rot : 0, scale: 1 });
              setMsg('אופס');
            }}
          >
            איפוס
          </button>
          <button className="press" style={{ padding: '2px 8px' }} aria-pressed={base === 'sat'} onClick={() => setBase(base === 'sat' ? 'osm' : 'sat')}>
            {base === 'sat' ? 'מפה' : 'לוויין'}
          </button>
        </div>
      </div>
    </div>
  );
}
