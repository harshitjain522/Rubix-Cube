import { describe, expect, it } from 'vitest';
import Cube from './cubejs'; // the shim, so its browser-only breakage is covered here
import { SOLVED } from '../model/facelets';
import { applyMoves, normalize, parse } from '../model/moves';
import { scrambledState } from '../model/scramble';

describe('kociemba solver', () => {
  it('agrees with our move model on the facelet string it is handed', () => {
    Cube.initSolver();
    for (let i = 0; i < 10; i++) {
      const { facelets } = scrambledState(25);
      const solution = Cube.fromString(facelets).solve();
      const moves = normalize(parse(solution));
      expect(applyMoves(facelets, moves)).toBe(SOLVED);
      expect(moves.length).toBeLessThanOrEqual(22);
    }
  }, 60_000);
});
