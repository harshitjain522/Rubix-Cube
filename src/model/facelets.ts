// Facelet geometry, indexing, and the facelet <-> cubie view.
//
// Index order: U 0-8, R 9-17, F 18-26, D 27-35, L 36-44, B 45-53, each face
// read row-major. Everything else in this file is derived from the geometry
// below rather than typed out, because hand-written permutation tables are
// where cube code goes quietly wrong.

export const FACES = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
export type Face = (typeof FACES)[number];

export const COLORS = ['W', 'R', 'G', 'Y', 'O', 'B'] as const;
export type Color = (typeof COLORS)[number];

export const COLOR_NAME: Record<Color, string> = {
  W: 'white', Y: 'yellow', R: 'red', O: 'orange', G: 'green', B: 'blue',
};

export type V3 = readonly [number, number, number];

const NORMAL: Record<Face, V3> = {
  U: [0, 1, 0],
  R: [1, 0, 0],
  F: [0, 0, 1],
  D: [0, -1, 0],
  L: [-1, 0, 0],
  B: [0, 0, -1],
};

// Direction each face's row index and column index advance in world space.
const ROW: Record<Face, V3> = {
  U: [0, 0, 1],
  R: [0, -1, 0],
  F: [0, -1, 0],
  D: [0, 0, -1],
  L: [0, -1, 0],
  B: [0, -1, 0],
};
const COL: Record<Face, V3> = {
  U: [1, 0, 0],
  R: [0, 0, -1],
  F: [1, 0, 0],
  D: [1, 0, 0],
  L: [0, 0, 1],
  B: [-1, 0, 0],
};

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (v: V3, k: number): V3 => [v[0] * k, v[1] * k, v[2] * k];

/** Geometry of all 54 stickers, in facelet-index order: the cubie position
 *  (components in {-1, 0, 1}) and the sticker's outward normal. */
export const FACELETS: readonly { pos: V3; normal: V3 }[] = FACES.flatMap((face) =>
  [0, 1, 2].flatMap((row) =>
    [0, 1, 2].map((col) => ({
      normal: NORMAL[face],
      pos: add(NORMAL[face], add(scale(ROW[face], row - 1), scale(COL[face], col - 1))),
    })),
  ),
);

const key = (pos: V3, normal: V3) => `${pos.join(',')}|${normal.join(',')}`;
const BY_KEY = new Map(FACELETS.map((f, i) => [key(f.pos, f.normal), i]));

/** Facelet index for a sticker at a given cubie position and outward normal. */
export function faceletAt(pos: V3, normal: V3): number {
  const i = BY_KEY.get(key(pos, normal));
  if (i === undefined) throw new Error(`no facelet at ${key(pos, normal)}`);
  return i;
}

/** Clockwise rotation about each face's axis, viewed from outside that face. */
export const ROTATE: Record<Face, (p: V3) => V3> = {
  U: ([x, y, z]) => [-z, y, x],
  D: ([x, y, z]) => [z, y, -x],
  R: ([x, y, z]) => [x, z, -y],
  L: ([x, y, z]) => [x, -z, y],
  F: ([x, y, z]) => [y, -x, z],
  B: ([x, y, z]) => [-y, x, z],
};

/** Axis index (0=x, 1=y, 2=z) and plane value selecting each face's layer. */
export const LAYER: Record<Face, { axis: 0 | 1 | 2; plane: 1 | -1 }> = {
  U: { axis: 1, plane: 1 },
  D: { axis: 1, plane: -1 },
  R: { axis: 0, plane: 1 },
  L: { axis: 0, plane: -1 },
  F: { axis: 2, plane: 1 },
  B: { axis: 2, plane: -1 },
};

export const CENTERS = [4, 13, 22, 31, 40, 49];

export const SOLVED = FACES.map((f) => f.repeat(9)).join('');

// --- piece tables (Kociemba's ordering) ------------------------------------

export const CORNER_NAMES = ['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB'];
export const EDGE_NAMES = ['UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'FR', 'FL', 'BL', 'BR'];

/** Facelet indices of the piece named by its faces, in the order given. */
function pieceFacelets(name: string): number[] {
  const faces = [...name] as Face[];
  const pos = faces.reduce((p, f) => add(p, NORMAL[f]), [0, 0, 0] as V3);
  return faces.map((f) => faceletAt(pos, NORMAL[f]));
}

export const CORNER_FACELETS = CORNER_NAMES.map(pieceFacelets);
export const EDGE_FACELETS = EDGE_NAMES.map(pieceFacelets);

/** Solved-state colors of each piece, in the same slot order. */
const CORNER_COLORS = CORNER_FACELETS.map((fs) => fs.map((i) => SOLVED[i]));
const EDGE_COLORS = EDGE_FACELETS.map((fs) => fs.map((i) => SOLVED[i]));

export interface CubieState {
  /** cp[slot] = which corner piece sits in that slot. */
  cp: number[];
  /** co[slot] = 0/1/2 twist. */
  co: number[];
  ep: number[];
  eo: number[];
}

/**
 * Facelet string -> piece view. A piece that can't be identified gets -1 and is
 * reported, so validation can name it instead of throwing.
 */
export function toCubies(
  f: string,
): { state: CubieState; badCorner: number | null; badEdge: number | null } {
  const cp: number[] = [], co: number[] = [], ep: number[] = [], eo: number[] = [];
  let badCorner: number | null = null;
  let badEdge: number | null = null;

  for (let i = 0; i < 8; i++) {
    const fs = CORNER_FACELETS[i];
    let ori = 0;
    while (ori < 3 && f[fs[ori]] !== 'U' && f[fs[ori]] !== 'D') ori++;
    const c2 = f[fs[(ori + 1) % 3]];
    const c3 = f[fs[(ori + 2) % 3]];
    const j = ori === 3 ? -1 : CORNER_COLORS.findIndex((c) => c[1] === c2 && c[2] === c3);
    if (j < 0) badCorner ??= i;
    cp.push(j);
    co.push(j < 0 ? 0 : ori);
  }

  for (let i = 0; i < 12; i++) {
    const [a, b] = EDGE_FACELETS[i].map((x) => f[x]);
    const j = EDGE_COLORS.findIndex((c) => c[0] === a && c[1] === b);
    const k = EDGE_COLORS.findIndex((c) => c[0] === b && c[1] === a);
    if (j < 0 && k < 0) badEdge ??= i;
    ep.push(j >= 0 ? j : k);
    eo.push(j < 0 && k >= 0 ? 1 : 0);
  }

  return { state: { cp, co, ep, eo }, badCorner, badEdge };
}

/** Parity of a permutation, by inversion count. Caller guarantees no holes. */
export function permutationParity(p: number[]): number {
  let inversions = 0;
  for (let i = 0; i < p.length; i++)
    for (let j = i + 1; j < p.length; j++) if (p[i] > p[j]) inversions++;
  return inversions % 2;
}
