import type { CodeId } from '../engine/types';
import { CODE_MARK, codeColor } from '../engine/codes';

/** One sign per code: Lynch colour + marker shape. Used in chips, plots, tables and tiles alike. */
export function CodeMark({ code, size = 10 }: { code: CodeId; size?: number }) {
  const c = codeColor(code);
  const s = size;
  const shape = CODE_MARK[code];
  return (
    <svg width={s} height={s} viewBox="0 0 10 10" aria-hidden style={{ flex: 'none' }}>
      {shape === 'circle' && <circle cx="5" cy="5" r="4.2" fill={c} />}
      {shape === 'square' && <rect x="1" y="1" width="8" height="8" fill={c} />}
      {shape === 'diamond' && <rect x="2" y="2" width="6" height="6" fill={c} transform="rotate(45 5 5)" />}
      {shape === 'triangle' && <path d="M5 0.8 L9.4 9 H0.6 Z" fill={c} />}
    </svg>
  );
}

export function markPath(shape: string, x: number, y: number, r: number) {
  switch (shape) {
    case 'square':
      return `M${x - r} ${y - r}h${2 * r}v${2 * r}h${-2 * r}Z`;
    case 'diamond':
      return `M${x} ${y - r * 1.25}L${x + r * 1.25} ${y}L${x} ${y + r * 1.25}L${x - r * 1.25} ${y}Z`;
    case 'triangle':
      return `M${x} ${y - r * 1.2}L${x + r * 1.15} ${y + r * 0.9}H${x - r * 1.15}Z`;
    default:
      return `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
  }
}

/** App icon: a figure-ground block with a courtyard and an axis, no text */
export function AppIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" fill="#111" />
      <rect x="5" y="5" width="9" height="9" fill="#fff" />
      <rect x="18" y="5" width="9" height="9" fill="#fff" />
      <rect x="5" y="18" width="9" height="9" fill="#fff" />
      <rect x="21" y="21" width="3" height="3" fill="#fff" />
      <rect x="15.2" y="0" width="1.6" height="32" fill="#a8740f" />
    </svg>
  );
}
