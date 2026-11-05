import { useEffect, useRef } from 'react';
import type { Model } from '../engine/types';
import { CODE, LYNCH } from '../engine/codes';

const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';

/**
 * Figure-ground plan in the manner of Nolli (1748): built mass in ink, void in paper.
 * Every plan shares one scale (windowM metres across), as in Durand's parallel.
 */
export function Plan({ model, windowM = 700, scaleBar = false, className }: { model: Model | null; windowM?: number; scaleBar?: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv || !model) return;
    const draw = () => {
      const r = cv.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = Math.max(40, Math.round(r.width));
      cv.width = W * dpr;
      cv.height = W * dpr;
      const g = cv.getContext('2d')!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, W);
      const s = W / windowM;
      const tx = (x: number) => W / 2 + x * s;
      const ty = (y: number) => W / 2 - y * s;
      const poly = (p: [number, number][]) => {
        g.beginPath();
        p.forEach((q, i) => (i ? g.lineTo(tx(q[0]), ty(q[1])) : g.moveTo(tx(q[0]), ty(q[1]))));
        g.closePath();
      };
      const color = cssVar(LYNCH[CODE[model.code].lynch].color.replace(/var\((--[^)]+)\)/, '$1'));
      for (const l of model.lots) {
        poly(l.poly);
        g.fillStyle = l.kind === 'green' ? '#e4eadf' : '#efeee9';
        g.fill();
      }
      g.strokeStyle = color;
      g.lineCap = 'round';
      for (const st of model.streets) {
        if (st.kind !== 'axis') continue;
        g.lineWidth = Math.max(0.6, 0.18 * st.w * s);
        g.beginPath();
        g.moveTo(tx(st.a[0]), ty(st.a[1]));
        g.lineTo(tx(st.b[0]), ty(st.b[1]));
        g.stroke();
      }
      for (const b of model.buildings) {
        poly(b.poly);
        g.fillStyle = b.kind === 'fabric' ? '#141414' : color;
        g.fill();
      }
      if (scaleBar) {
        const m = windowM > 1500 ? 500 : 100;
        g.fillStyle = '#111';
        g.fillRect(8, W - 12, m * s, 3);
        g.font = '10px IBM Plex Mono, monospace';
        g.fillText(`${m} מ'`, 8 + m * s + 4, W - 8);
      }
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(cv);
    return () => ro.disconnect();
  }, [model, windowM, scaleBar]);
  return <canvas ref={ref} className={className} style={{ width: '100%', aspectRatio: '1', display: 'block' }} aria-label="תוכנית דמות-רקע" role="img" />;
}
