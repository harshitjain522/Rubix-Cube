import { describe, expect, it } from 'vitest';
import { CENTERS, FACES, SOLVED, toCubies, permutationParity } from './facelets';
import { applyMove, applyMoves, invertAll, normalize, parse, stringifyAll } from './moves';
import { validate } from './validate';
import { scrambledState } from './scramble';

const sexy = parse("R U R' U'");

describe('moves', () => {
  it('any move applied four times is identity', () => {
    for (const layer of FACES) {
      let s = SOLVED;
      for (let i = 0; i < 4; i++) s = applyMove(s, { layer, amount: 1 });
      expect(s).toBe(SOLVED);
    }
  });

  it('a move followed by its inverse is identity', () => {
    for (const layer of FACES) {
      for (const amount of [1, 2, 3] as const) {
        const m = { layer, amount };
        expect(applyMoves(SOLVED, [m, ...invertAll([m])])).toBe(SOLVED);
      }
    }
  });

  it('R moves the front face onto the up face', () => {
    const s = applyMove(SOLVED, { layer: 'R', amount: 1 });
    expect([s[2], s[5], s[8]]).toEqual(['F', 'F', 'F']);
  });

  it('R U R\' U\' has order six', () => {
    let s = SOLVED;
    for (let i = 0; i < 6; i++) s = applyMoves(s, sexy);
    expect(s).toBe(SOLVED);
  });

  it('centers never move', () => {
    const { facelets } = scrambledState(40);
    for (const i of CENTERS) expect(facelets[i]).toBe(SOLVED[i]);
  });

  it('normalizes cancellations', () => {
    expect(stringifyAll(normalize(parse("R R' U")))).toBe('U');
    expect(stringifyAll(normalize(parse('R R')))).toBe('R2');
    expect(stringifyAll(normalize(parse("R U U' R'")))).toBe('');
  });
});

describe('cubie view', () => {
  it('reads the solved cube as identity', () => {
    const { state, badCorner, badEdge } = toCubies(SOLVED);
    expect(badCorner).toBeNull();
    expect(badEdge).toBeNull();
    expect(state.cp).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(state.ep).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(state.co.every((o) => o === 0)).toBe(true);
    expect(state.eo.every((o) => o === 0)).toBe(true);
  });

  it('keeps twist, flip and parity legal on random states', () => {
    for (let i = 0; i < 300; i++) {
      const { facelets } = scrambledState(30);
      const { state } = toCubies(facelets);
      expect(state.co.reduce((a, b) => a + b) % 3).toBe(0);
      expect(state.eo.reduce((a, b) => a + b) % 2).toBe(0);
      expect(permutationParity(state.cp)).toBe(permutationParity(state.ep));
    }
  });
});

describe('validation', () => {
  const colored = (faces: string) =>
    [...faces].map((f) => 'WRGYOB'['URFDLB'.indexOf(f)]).join('');

  it('accepts real states', () => {
    for (let i = 0; i < 100; i++) {
      expect(validate(colored(scrambledState(25).facelets))).toBeNull();
    }
  });

  it('reports an incomplete cube', () => {
    expect(validate('-'.repeat(54))?.code).toBe('incomplete');
  });

  it('reports miscounted colors', () => {
    const s = colored(SOLVED).split('');
    s[0] = 'B';
    expect(validate(s.join(''))?.code).toBe('counts');
  });

  it('reports a twisted corner', () => {
    const s = colored(SOLVED).split('');
    // Rotate the three stickers of the URF corner in place.
    const [a, b, c] = [8, 9, 20];
    [s[a], s[b], s[c]] = [s[c], s[a], s[b]];
    expect(validate(s.join(''))?.code).toBe('twist');
  });

  it('reports a flipped edge', () => {
    const s = colored(SOLVED).split('');
    [s[7], s[19]] = [s[19], s[7]];
    expect(validate(s.join(''))?.code).toBe('flip');
  });

  it('reports a parity swap', () => {
    const s = colored(applyMoves(SOLVED, parse('R'))).split('');
    // Swap two edges back without touching corners: an impossible state.
    const swap = (i: number, j: number) => { [s[i], s[j]] = [s[j], s[i]]; };
    swap(5, 7); swap(10, 19);
    expect(validate(s.join(''))?.code).toBe('parity');
  });
});
