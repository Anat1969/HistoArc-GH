import { useEffect, useRef, useState } from 'react';
import type { CodeId, Knobs, Model, Theta } from '../engine/types';
import type { GenRequest } from '../engine/worker';

/** One shared worker queue. Later requests on the same channel supersede earlier ones. */
let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, (m: Model) => void>();

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('../engine/worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (ev: MessageEvent<{ id: number; model: Model }>) => {
      const cb = pending.get(ev.data.id);
      pending.delete(ev.data.id);
      cb?.(ev.data.model);
    };
  }
  return worker;
}

export function requestModel(theta: Theta, code: CodeId, knobs?: Knobs): Promise<Model> {
  const id = ++seq;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    const msg: GenRequest = { id, theta, code, knobs };
    getWorker().postMessage(msg);
  });
}

/**
 * Live model for interactive use: while the user drags, a fast pass reuses the last knobs;
 * after a pause the full solver runs and fits O and H to the target.
 */
export function useModel(theta: Theta, code: CodeId, seedKnobs?: Knobs) {
  const [model, setModel] = useState<Model | null>(null);
  const [busy, setBusy] = useState(false);
  const last = useRef<{ code: CodeId; knobs: Knobs } | null>(null);
  const ticket = useRef(0);
  const key = `${code}|${theta.O}|${theta.I}|${theta.E}|${theta.H}|${theta.G}|${seedKnobs?.a ?? ''}|${seedKnobs?.k ?? ''}`;
  useEffect(() => {
    const my = ++ticket.current;
    setBusy(true);
    const sameCode = last.current?.code === code;
    if (seedKnobs) {
      requestModel(theta, code, seedKnobs).then((m) => {
        if (my !== ticket.current) return;
        last.current = { code, knobs: m.knobs };
        setModel(m);
        setBusy(false);
      });
      return;
    }
    if (sameCode && last.current) {
      requestModel(theta, code, last.current.knobs).then((m) => {
        if (my === ticket.current) setModel(m);
      });
    }
    const t = setTimeout(
      () => {
        requestModel(theta, code).then((m) => {
          if (my !== ticket.current) return;
          last.current = { code, knobs: m.knobs };
          setModel(m);
          setBusy(false);
        });
      },
      sameCode ? 260 : 0,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { model, busy };
}
