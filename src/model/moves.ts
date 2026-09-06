// Moves: type, parsing, notation, and the 18 facelet permutation tables.

import { FACELETS, FACES, ROTATE, faceletAt, inLayer, type Face } from './facelets';

export type Layer = Face;
/** 1 = quarter clockwise, 2 = half, 3 = quarter counter-clockwise. */
export type Amount = 1 | 2 | 3;
export interface Move {
  layer: Layer;
  amount: Amount;
}

const SUFFIX = { 1: '', 2: '2', 3: "'" } as const;

export function stringify(m: Move): string {
  return m.layer + SUFFIX[m.amount];
}
export function stringifyAll(ms: readonly Move[]): string {
  return ms.map(stringify).join(' ');
}

export function inverse(m: Move): Move {
  return { layer: m.layer, amount: (4 - m.amount) as Amount };
}
export function invertAll(ms: readonly Move[]): Move[] {
  return [...ms].reverse().map(inverse);
}

export function parse(text: string): Move[] {
  const out: Move[] = [];
  for (const token of text.trim().split(/[\s,]+/).filter(Boolean)) {
    const m = /^([URFDLB])(['’2]?)$/i.exec(token);
    if (!m) throw new Error(`Not a move: "${token}"`);
    const layer = m[1].toUpperCase() as Layer;
    const amount: Amount = m[2] === '2' ? 2 : m[2] ? 3 : 1;
    out.push({ layer, amount });
  }
  return out;
}

/** Drop cancellations and merge repeats: R R' -> nothing, R R -> R2. */
export function normalize(ms: readonly Move[]): Move[] {
  const out: Move[] = [];
  for (const m of ms) {
    const prev = out[out.length - 1];
    if (prev && prev.layer === m.layer) {
      const amount = (prev.amount + m.amount) % 4;
      out.pop();
      if (amount) out.push({ layer: m.layer, amount: amount as Amount });
      continue;
    }
    out.push(m);
  }
  // A cancellation can expose a new neighbouring pair; settle it.
  return out.length === ms.length ? out : normalize(out);
}

// --- permutation tables ----------------------------------------------------

/** PERM[layer][i] = index of the facelet that moves into slot i. */
const QUARTER: Record<Face, number[]> = Object.fromEntries(
  FACES.map((face) => {
    const perm = FACELETS.map((_, i) => i);
    FACELETS.forEach((f, i) => {
      if (!inLayer(f.pos, face)) return;
      perm[faceletAt(ROTATE[face](f.pos), ROTATE[face](f.normal))] = i;
    });
    return [face, perm];
  }),
) as Record<Face, number[]>;

function compose(a: number[], b: number[]): number[] {
  return b.map((i) => a[i]);
}

const TABLE = new Map<string, number[]>();
for (const face of FACES) {
  let perm = QUARTER[face];
  for (const amount of [1, 2, 3] as const) {
    TABLE.set(face + amount, perm);
    perm = compose(perm, QUARTER[face]);
  }
}

/** perm[i] = the facelet whose sticker moves into slot i. Exported for tests. */
export function permutationFor(m: Move): number[] {
  return TABLE.get(m.layer + m.amount)!;
}

export function applyMove(facelets: string, m: Move): string {
  const perm = permutationFor(m);
  let out = '';
  for (let i = 0; i < 54; i++) out += facelets[perm[i]];
  return out;
}

export function applyMoves(facelets: string, ms: readonly Move[]): string {
  return ms.reduce(applyMove, facelets);
}

/** Convenience for algorithm tables written as notation strings. */
export function alg(text: string): Move[] {
  return parse(text);
}
