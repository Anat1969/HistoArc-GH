/// <reference lib="webworker" />
import { generate } from './generate';
import type { CodeId, Knobs, Theta } from './types';

export interface GenRequest {
  id: number;
  theta: Theta;
  code: CodeId;
  knobs?: Knobs;
}

self.onmessage = (ev: MessageEvent<GenRequest>) => {
  const { id, theta, code, knobs } = ev.data;
  const model = generate(theta, code, { knobs });
  (self as unknown as Worker).postMessage({ id, model });
};
