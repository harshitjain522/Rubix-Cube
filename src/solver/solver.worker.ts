/// <reference lib="webworker" />
// Both solvers live off the main thread: Kociemba's tables take a few seconds
// to build, and the beginner solver walks thousands of cube states.

import Cube from './cubejs';
import { normalize, parse } from '../model/moves';
import { solveBeginner, type Stage } from './beginner';
import type { SolverRequest, SolverResponse } from './index';

let tablesReady = false;

function solveFast(facelets: string): Stage[] {
  const moves = normalize(parse(Cube.fromString(facelets).solve() ?? ''));
  if (!moves.length) return [];
  return [{
    name: 'Solution',
    goal: 'The shortest route this cube has from here to solved.',
    look: 'Follow the turns one at a time. There is no pattern to spot — the search found it for you.',
    moves,
  }];
}

self.addEventListener('message', ({ data: { id, facelets, mode } }: MessageEvent<SolverRequest>) => {
  let reply: SolverResponse;
  try {
    if (!tablesReady && mode !== 'learn') {
      Cube.initSolver();
      tablesReady = true;
    }
    const stages = !facelets ? [] : mode === 'learn' ? solveBeginner(facelets) : solveFast(facelets);
    reply = { id, stages };
  } catch (err) {
    reply = { id, error: err instanceof Error ? err.message : String(err) };
  }
  self.postMessage(reply);
});
