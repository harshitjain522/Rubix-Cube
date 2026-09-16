// The seam. Everything above this line calls `solve`; swapping Kociemba
// implementations is a change to solver.worker.ts and nothing else.

import type { Stage } from './beginner';

export type SolveMode = 'fast' | 'learn';

/** No `facelets` means "build the Kociemba tables now". */
export type SolverRequest = { id: number; facelets?: string; mode?: SolveMode };
export type SolverResponse = { id: number; stages?: Stage[]; error?: string };

const worker = new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' });
const pending = new Map<number, { resolve: (s: Stage[]) => void; reject: (e: Error) => void }>();
let nextId = 1;
let dead: Error | null = null;

worker.addEventListener('message', ({ data }: MessageEvent<SolverResponse>) => {
  const entry = pending.get(data.id);
  pending.delete(data.id);
  if (data.error === undefined) entry?.resolve(data.stages ?? []);
  else entry?.reject(new Error(data.error));
});
// A module worker that fails to load never runs its message handler, so
// without this every later request would sit unresolved forever.
worker.addEventListener('error', (e) => {
  dead = new Error(e.message || 'The solver crashed.');
  for (const { reject } of pending.values()) reject(dead);
  pending.clear();
});

function send(facelets?: string, mode?: SolveMode) {
  return new Promise<Stage[]>((resolve, reject) => {
    if (dead) return reject(dead);
    const id = nextId++;
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, facelets, mode } satisfies SolverRequest);
  });
}

let ready: Promise<unknown> | null = null;
export const initSolver = () => (ready ??= send());

export async function solve(facelets: string, mode: SolveMode): Promise<Stage[]> {
  if (mode === 'fast') await initSolver();
  return send(facelets, mode);
}
