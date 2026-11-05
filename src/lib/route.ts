import { useEffect, useState } from 'react';

export interface Route {
  path: string;
  q: URLSearchParams;
}

const parse = (): Route => {
  const h = window.location.hash.replace(/^#/, '') || '/';
  const [path, qs] = h.split('?');
  return { path: path || '/', q: new URLSearchParams(qs || '') };
};

export function useRoute() {
  const [r, setR] = useState(parse);
  useEffect(() => {
    const on = () => {
      setR(parse());
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}

export const go = (path: string, q?: Record<string, string | number>) => {
  const qs = q ? '?' + new URLSearchParams(Object.entries(q).map(([k, v]) => [k, String(v)])).toString() : '';
  window.location.hash = path + qs;
};

/** update query without adding history entries (state lives in the URL, so "copy link" keeps it) */
export const replaceQuery = (path: string, q: Record<string, string | number>) => {
  const qs = new URLSearchParams(Object.entries(q).map(([k, v]) => [k, String(v)])).toString();
  history.replaceState(null, '', `#${path}?${qs}`);
};
