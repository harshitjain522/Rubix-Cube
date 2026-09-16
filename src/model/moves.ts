// Moves: type, parsing, notation, scrambles, and the 18 facelet permutations.

import { FACELETS, FACES, LAYER, ROTATE, SOLVED, faceletAt, type Face } from './facelets';

/** 1 = quarter clockwise, 2 = half, 3 = quarter counter-clockwise. */
export type Amount = 1 | 2 | 3;
export interface Move {
  layer: Face;
  amount: Amount;
}

const SUFFIX = { 1: '', 2: '2', 3: "'" } as const;

export const stringify = (m: Move) => m.layer + SUFFIX[m.amount];
export const stringifyAll = (ms: readonly Move[]) => ms.map(stringify).join(' ');
export const inverse = (m: Move): Move => ({ layer: m.layer, amount: (4 - m.amount) as Amount });

export function parse(text: string): Move[] {
  return text.split(/[\s,]+/).filter(Boolean).map((token): Move => {
    const m = /^([URFDLB])(['’2]?)$/i.exec(token);
    if (!m) throw new Error(`Not a move: "${token}"`);
    return { layer: m[1].toUpperCase() as Face, amount: m[2] === '2' ? 2 : m[2] ? 3 : 1 };
  });
}

/** Drop cancellations and merge repeats: R R' -> nothing, R R -> R2. */
export function normalize(ms: readonly Move[]): Move[] {
  const out: Move[] = [];
  // Adjacent entries in `out` never share a layer, so a cancellation only ever
  // exposes a neighbour the next move is compared against anyway: one pass.
  for (const m of ms) {
    const prev = out.at(-1);
    if (prev?.layer !== m.layer) {
      out.push(m);
      continue;
    }
    out.pop();
    const amount = (prev.amount + m.amount) % 4;
    if (amount) out.push({ layer: m.layer, amount: amount as Amount });
  }
  return out;
}

// --- permutation tables ----------------------------------------------------

/** PERMS[face][amount - 1][i] = the facelet whose sticker moves into slot i. */
const PERMS = Object.fromEntries(
  FACES.map((face) => {
    const q = FACELETS.map((_, i) => i);
    const { axis, plane } = LAYER[face];
    FACELETS.forEach((f, i) => {
      if (f.pos[axis] === plane) q[faceletAt(ROTATE[face](f.pos), ROTATE[face](f.normal))] = i;
    });
    const then = (p: number[]) => q.map((i) => p[i]);
    const q2 = then(q);
    return [face, [q, q2, then(q2)]];
  }),
) as Record<Face, number[][]>;

/** Exported for the 3D turn test. */
export const permutationFor = (m: Move) => PERMS[m.layer][m.amount - 1];

export function applyMove(facelets: string, m: Move): string {
  return permutationFor(m).map((i) => facelets[i]).join('');
}

export function applyMoves(facelets: string, ms: readonly Move[]): string {
  return ms.reduce(applyMove, facelets);
}

/** A random scramble that never turns the same face twice in a row. */
export function scrambledState(length = 25): { facelets: string; moves: Move[] } {
  const moves: Move[] = [];
  while (moves.length < length) {
    const layer = FACES[Math.floor(Math.random() * 6)];
    if (moves.at(-1)?.layer === layer) continue;
    moves.push({ layer, amount: (1 + Math.floor(Math.random() * 3)) as Amount });
  }
  return { facelets: applyMoves(SOLVED, moves), moves };
}
