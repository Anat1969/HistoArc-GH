import { useEffect, useState } from 'react';
import type { CodeId, Scale, Theta } from '../engine/types';
import type { Snapshot } from '../data/knowledge';

/**
 * Saved alternatives and outputs. Stored in this browser (localStorage), survive reloads,
 * and can be exported to a file and imported back. Not shared across devices.
 */
export interface Alternative {
  id: string;
  name: string;
  createdAt: string;
  scale: Scale;
  caseId: number;
  code: CodeId;
  theta: Theta;
  measured: Snapshot;
  error: number;
  fit: 'full' | 'numbers' | 'none' | 'free';
  note: string;
  from?: string; // scenario or person id that produced it
  knobs?: { a: number; k: number };
}

export type OutputType = 'insights' | 'compare' | 'article' | 'principles' | 'questions';

export interface Output {
  id: string;
  type: OutputType;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  altIds: string[];
}

const K_ALT = 'histoarc.alternatives.v1';
const K_OUT = 'histoarc.outputs.v1';

function read<T>(k: string): T[] {
  try {
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}
function write<T>(k: string, v: T[]) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
    window.dispatchEvent(new CustomEvent('histoarc-store'));
    return true;
  } catch {
    return false;
  }
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const store = {
  alts: () => read<Alternative>(K_ALT),
  saveAlt: (a: Alternative) => write(K_ALT, [a, ...read<Alternative>(K_ALT).filter((x) => x.id !== a.id)]),
  removeAlt: (id: string) => write(K_ALT, read<Alternative>(K_ALT).filter((x) => x.id !== id)),
  outs: () => read<Output>(K_OUT),
  saveOut: (o: Output) => write(K_OUT, [o, ...read<Output>(K_OUT).filter((x) => x.id !== o.id)]),
  removeOut: (id: string) => write(K_OUT, read<Output>(K_OUT).filter((x) => x.id !== id)),
  exportAll: () => JSON.stringify({ app: 'histoarc', version: 1, exportedAt: new Date().toISOString(), alternatives: read(K_ALT), outputs: read(K_OUT) }, null, 2),
  importAll: (text: string) => {
    const data = JSON.parse(text);
    if (data.app !== 'histoarc') throw new Error('הקובץ אינו ייצוא של קוד העיר');
    const alts = [...(data.alternatives ?? []), ...read<Alternative>(K_ALT)];
    const outs = [...(data.outputs ?? []), ...read<Output>(K_OUT)];
    const dedupe = <T extends { id: string }>(xs: T[]) => xs.filter((x, i) => xs.findIndex((y) => y.id === x.id) === i);
    write(K_ALT, dedupe(alts));
    write(K_OUT, dedupe(outs));
    return { alts: data.alternatives?.length ?? 0, outs: data.outputs?.length ?? 0 };
  },
};

/** re-render on any store change, also from other tabs */
export function useStore() {
  const [v, setV] = useState(0);
  useEffect(() => {
    const on = () => setV((x) => x + 1);
    window.addEventListener('histoarc-store', on);
    window.addEventListener('storage', on);
    return () => {
      window.removeEventListener('histoarc-store', on);
      window.removeEventListener('storage', on);
    };
  }, []);
  return { alts: store.alts(), outs: store.outs(), v };
}

export function download(name: string, text: string, type = 'text/markdown') {
  const blob = new Blob([text], { type: `${type};charset=utf-8` });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}
