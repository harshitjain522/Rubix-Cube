// The seam. Everything above this line talks to `solver`; swapping Kociemba
// implementations is a change to solver.worker.ts and nothing else.

import type { Move } from '../model/moves';
import type { Stage } from './beginner';

export type SolveMode = 'fast' | 'learn';

export interface SolverRequest {
  id: number;
  kind: 'init' | 'solve';
  facelets?: string;
  mode?: SolveMode;
}

export interface SolverResponse {
  id: number;
  ok: boolean;
  stages?: Stage[];
  error?: string;
}

export interface Solver {
  init(): Promise<void>;
  solve(facelets: string, mode: SolveMode): Promise<Stage[]>;
}

function createSolver(): Solver {
  const worker = new Worker(new URL('./solver.worker.ts', import.meta.url), {
    type: 'module',
  });
  const pending = new Map<number, { resolve: (s: Stage[]) => void; reject: (e: Error) => void }>();
  let nextId = 1;

  worker.addEventListener('message', (e: MessageEvent<SolverResponse>) => {
    const entry = pending.get(e.data.id);
    if (!entry) return;
    pending.delete(e.data.id);
    if (e.data.ok) entry.resolve(e.data.stages ?? []);
    else entry.reject(new Error(e.data.error ?? 'The solver gave up.'));
  });
  // A module worker that fails to load never runs its message handler, so
  // without this every later request would sit unresolved forever.
  let dead: Error | null = null;
  worker.addEventListener('error', (e) => {
    dead = new Error(e.message || 'The solver crashed.');
    for (const { reject } of pending.values()) reject(dead);
    pending.clear();
  });

  const send = (req: Omit<SolverRequest, 'id'>) =>
    new Promise<Stage[]>((resolve, reject) => {
      if (dead) return reject(dead);
      const id = nextId++;
      pending.set(id, { resolve, reject });
      worker.postMessage({ ...req, id });
    });

  let ready: Promise<void> | null = null;
  return {
    init() {
      ready ??= send({ kind: 'init' }).then(() => undefined);
      return ready;
    },
    async solve(facelets, mode) {
      if (mode === 'fast') await this.init();
      return send({ kind: 'solve', facelets, mode });
    },
  };
}

export const solver = createSolver();

/** Convenience for the store and for tests. */
export function movesOf(stages: readonly Stage[]): Move[] {
  return stages.flatMap((s) => s.moves);
}
