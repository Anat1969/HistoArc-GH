import { useEffect, useRef, useState } from 'react';
import maplibregl, { type Map as MLMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Model } from '../engine/types';

const STYLES = {
  sat: {
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    attribution: 'תצלום: Esri, Maxar, Earthstar Geographics',
  },
  osm: {
    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    attribution: '© OpenStreetMap contributors',
  },
} as const;

/** model metres around the site centre → longitude/latitude (equirectangular, fine for a few km) */
function toGeo(model: Model, lat: number, lon: number) {
  const kx = 111320 * Math.cos((lat * Math.PI) / 180);
  const ky = 110540;
  const features = model.buildings
    .filter((b) => model.scale !== 'building' || (b.z0 ?? 0) < 1)
    .filter((b) => b.kind !== 'slab' && b.kind !== 'glass')
    .map((b) => ({
      type: 'Feature' as const,
      properties: { kind: b.kind },
      geometry: { type: 'Polygon' as const, coordinates: [[...b.poly, b.poly[0]].map(([x, y]) => [lon + x / kx, lat + y / ky])] },
    }));
  return { type: 'FeatureCollection' as const, features };
}

export function SiteMap({ model, lat, lon, note, color }: { model: Model | null; lat: number; lon: number; note: string; color: string }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const [base, setBase] = useState<'sat' | 'osm'>('sat');
  const [opacity, setOpacity] = useState(0.75);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!el.current) return;
    const m = new maplibregl.Map({
      container: el.current,
      style: {
        version: 8,
        sources: {
          base: { type: 'raster', tiles: [...STYLES[base].tiles], tileSize: 256, attribution: STYLES[base].attribution, maxzoom: 19 },
        },
        layers: [{ id: 'base', type: 'raster', source: 'base' }],
      },
      center: [lon, lat],
      zoom: model?.scale === 'building' ? 17.5 : 15,
      attributionControl: { compact: true },
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-left');
    m.on('error', () => setFailed(true));
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
      const data = toGeo(model, lat, lon);
      const src = m.getSource('model') as maplibregl.GeoJSONSource | undefined;
      if (src) src.setData(data);
      else {
        m.addSource('model', { type: 'geojson', data });
        m.addLayer({ id: 'model-fill', type: 'fill', source: 'model', paint: { 'fill-color': ['match', ['get', 'kind'], 'fabric', '#ffffff', 'column', '#333333', color], 'fill-opacity': opacity } });
        m.addLayer({ id: 'model-line', type: 'line', source: 'model', paint: { 'line-color': '#111111', 'line-width': 0.6, 'line-opacity': Math.min(1, opacity + 0.2) } });
      }
      if (m.getLayer('model-fill')) m.setPaintProperty('model-fill', 'fill-opacity', opacity);
    };
    if (m.isStyleLoaded()) put();
    else m.once('load', put);
  }, [model, lat, lon, opacity, color, base]);

  return (
    <div className="map-wrap" style={{ position: 'absolute', inset: 0 }}>
      <div ref={el} style={{ position: 'absolute', inset: 0 }} />
      <div className="overlay" style={{ pointerEvents: 'auto', maxWidth: 300 }}>
        <b>המודל המחולל על רקע האתר האמיתי.</b> הלבן הוא מודל, לא המבנים הקיימים.
        <div className="small muted">{note}</div>
        <div className="filters" style={{ margin: '6px 0 0' }}>
          <button className="press" aria-pressed={base === 'sat'} onClick={() => setBase('sat')}>
            לוויין
          </button>
          <button className="press" aria-pressed={base === 'osm'} onClick={() => setBase('osm')}>
            מפה
          </button>
          <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            שקיפות
            <input type="range" min={0} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(+e.target.value)} style={{ width: 70 }} aria-label="שקיפות המודל" />
          </label>
        </div>
        {failed && <div className="small" style={{ color: 'var(--rev)' }}>אריחי המפה לא נטענו ברשת הזו.</div>}
      </div>
    </div>
  );
}
