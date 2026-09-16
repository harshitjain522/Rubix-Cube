import { describe, expect, it } from 'vitest';
import { SOLVED } from '../model/facelets';
import { applyMoves, parse, scrambledState, stringifyAll } from '../model/moves';
import { solveBeginner } from './beginner';

describe('algorithm sanity', () => {
  const affects = (algText: string) => {
    const s = applyMoves(SOLVED, parse(algText));
    return [...s].flatMap((c, i) => (c === SOLVED[i] ? [] : [i]));
  };

  it('the edge cycle only moves top-layer edges', () => {
    // U-layer edge facelets: 1,3,5,7 on U plus the top-middle of each side.
    const allowed = new Set([1, 3, 5, 7, 10, 19, 37, 46]);
    for (const alg of ["R U' R U R U R U' R' U' R2", "R2 U R U R' U' R' U' R' U R'"]) {
      expect(affects(alg).every((i) => allowed.has(i)), alg).toBe(true);
    }
  });

  it('the corner cycle only moves top-layer corners', () => {
    const allowed = new Set([0, 2, 6, 8, 9, 11, 18, 20, 36, 38, 45, 47]);
    for (const alg of ["R U' L' U R' U' L U", "U' L' U R U' L U R'"]) {
      expect(affects(alg).every((i) => allowed.has(i)), alg).toBe(true);
    }
  });
});

describe('beginner solver', () => {
  it('returns nothing for a solved cube', () => {
    expect(solveBeginner(SOLVED)).toEqual([]);
  });

  it('solves random states and names every stage', () => {
    for (let i = 0; i < 400; i++) {
      const { facelets, moves } = scrambledState(25);
      const stages = solveBeginner(facelets);
      const solution = stages.flatMap((s) => s.moves);
      const result = applyMoves(facelets, solution);
      if (result !== SOLVED) {
        throw new Error(
          `scramble ${stringifyAll(moves)}\nsolution ${stringifyAll(solution)}\ngot ${result}`,
        );
      }
      expect(stages.every((s) => s.name && s.goal && s.moves.length)).toBe(true);
    }
  }, 60_000);

  it('stays within a length a person will actually follow', () => {
    const lengths = Array.from({ length: 200 }, () =>
      solveBeginner(scrambledState(25).facelets).reduce((n, s) => n + s.moves.length, 0),
    );
    const median = lengths.sort((a, b) => a - b)[lengths.length >> 1];
    expect(median).toBeLessThan(160);
  }, 30_000);
});
