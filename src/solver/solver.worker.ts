/// <reference lib="webworker" />
// Both solvers live off the main thread: Kociemba's tables take a few seconds
// to build, and the beginner solver walks thousands of cube states.

import Cube from './cubejs';
import { normalize, parse } from '../model/moves';
import { solveBeginner, type Stage } from './beginner';
import type { SolverRequest, SolverResponse } from './index';

let tablesReady = false;

function initTables() {
  if (tablesReady) return;
  Cube.initSolver();
  tablesReady = true;
}

function solveFast(facelets: string): Stage[] {
  initTables();
  const solution = Cube.fromString(facelets).solve();
  const moves = normalize(parse(solution ?? ''));
  return [
    {
      name: 'Solution',
      goal: 'The shortest route this cube has from here to solved.',
      look: 'Follow the turns one at a time. There is no pattern to spot — the search found it for you.',
      moves,
    },
  ].filter((s) => s.moves.length > 0);
}

self.addEventListener('message', (e: MessageEvent<SolverRequest>) => {
  const { id, kind, facelets, mode } = e.data;
  const reply = (r: Omit<SolverResponse, 'id'>) => self.postMessage({ id, ...r });
  try {
    if (kind === 'init') {
      initTables();
      reply({ ok: true, stages: [] });
      return;
    }
    if (!facelets) throw new Error('No cube to solve.');
    reply({ ok: true, stages: mode === 'learn' ? solveBeginner(facelets) : solveFast(facelets) });
  } catch (err) {
    reply({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});
