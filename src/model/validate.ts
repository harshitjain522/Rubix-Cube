// VA-1 .. VA-7. Every failure names the pieces to look at again, because
// "invalid cube state" is where users give up.

import {
  CENTERS, COLOR_NAME, COLORS, CORNER_FACELETS, CORNER_NAMES, EDGE_FACELETS, EDGE_NAMES,
  FACES, permutationParity, toCubies, type Color,
} from './facelets';

export interface ValidationError {
  code: 'incomplete' | 'counts' | 'centers' | 'edge-set' | 'corner-set' | 'twist' | 'flip' | 'parity';
  message: string;
  /** Stickers to highlight on the net and the cube. */
  faceletIndices: number[];
}

const indicesWhere = <T>(xs: readonly T[], test: (x: T) => boolean) =>
  xs.flatMap((x, i) => (test(x) ? [i] : []));

/**
 * `facelets` is a 54-char string of colors, or '-' for an unpainted sticker.
 * Checks stop at the first failure: a duplicate piece makes parity meaningless.
 */
export function validate(facelets: string): ValidationError | null {
  const chars = [...facelets];
  const blanks = indicesWhere(chars, (c) => c === '-');
  if (blanks.length) {
    return {
      code: 'incomplete',
      message: `${blanks.length} sticker${blanks.length === 1 ? '' : 's'} to go.`,
      faceletIndices: blanks,
    };
  }

  // VA-1: nine of each color.
  const wrong = COLORS.filter((c) => chars.filter((x) => x === c).length !== 9);
  if (wrong.length) {
    const say = (c: Color) => `${chars.filter((x) => x === c).length} ${COLOR_NAME[c]}`;
    return {
      code: 'counts',
      message: `${wrong.map(say).join(', ')}. There should be nine of each — one of these is misread.`,
      faceletIndices: indicesWhere(chars, (c) => wrong.includes(c as Color)),
    };
  }

  // VA-2: six distinct centers.
  const centerColors = CENTERS.map((i) => facelets[i]);
  const dupe = centerColors.find((c, i) => centerColors.indexOf(c) !== i);
  if (dupe) {
    return {
      code: 'centers',
      message: `Two centers read as ${COLOR_NAME[dupe as Color]}. Centers never move, so one of them is wrong.`,
      faceletIndices: CENTERS.filter((i) => facelets[i] === dupe),
    };
  }

  // VA-3 / VA-4: the pieces are the real twelve edges and eight corners.
  const { state, badCorner, badEdge } = toCubies(toFaces(facelets));
  const firstDuplicate = (p: number[]) => {
    const i = p.findIndex((x, i) => p.indexOf(x) !== i);
    return i < 0 ? null : i;
  };
  const pieceChecks = [
    ['edge', badEdge], ['corner', badCorner],
    ['edge', firstDuplicate(state.ep)], ['corner', firstDuplicate(state.cp)],
  ] as const;
  for (const [kind, slot] of pieceChecks) {
    if (slot === null) continue;
    const [code, pieces, names, perm] = kind === 'edge'
      ? (['edge-set', EDGE_FACELETS, EDGE_NAMES, state.ep] as const)
      : (['corner-set', CORNER_FACELETS, CORNER_NAMES, state.cp] as const);
    const twin = perm.findIndex((p, i) => i !== slot && p === perm[slot] && p >= 0);
    const read = pieces[slot].map((i) => COLOR_NAME[facelets[i] as Color]).join('-and-');
    return {
      code,
      message:
        twin >= 0
          ? `Two pieces read as ${read}. One of them is something else — look at both ${kind} pieces again and check every sticker.`
          : `The ${names[slot]} ${kind} reads as ${read}, which isn’t a real piece. Check its stickers.`,
      faceletIndices: [slot, ...(twin >= 0 ? [twin] : [])].flatMap((i) => pieces[i]),
    };
  }

  // VA-5: corner twists sum to zero mod 3.
  const twist = state.co.reduce((a, b) => a + b, 0) % 3;
  if (twist) {
    const suspects = indicesWhere(state.co, (o) => o === (3 - twist) % 3);
    const pick = suspects.length ? suspects : indicesWhere(state.co, (o) => o !== 0);
    return {
      code: 'twist',
      message:
        pick.length === 1
          ? 'One corner is twisted in place. Check its three stickers — two of them are probably swapped.'
          : `A corner is twisted in place. It is one of these ${pick.length} — check all three stickers on each.`,
      faceletIndices: pick.flatMap((i) => CORNER_FACELETS[i]),
    };
  }

  // VA-6: edge flips sum to zero mod 2.
  const pick = indicesWhere(state.eo, (o) => o === 1);
  if (pick.length % 2) {
    return {
      code: 'flip',
      message:
        pick.length === 1
          ? 'One edge is flipped. Check both of its stickers — they are the wrong way round.'
          : `An edge is flipped. It is one of these ${pick.length} — check both stickers on each.`,
      faceletIndices: pick.flatMap((i) => EDGE_FACELETS[i]),
    };
  }

  // VA-7: corner and edge permutation parity must agree.
  if (permutationParity(state.cp) !== permutationParity(state.ep)) {
    const swapped = state.cp.flatMap((p, i) => (p !== i ? [i] : [])).slice(0, 2);
    return {
      code: 'parity',
      message:
        'Two pieces are swapped, which a real cube can’t do. Two stickers were probably read in the wrong order.',
      faceletIndices: swapped.flatMap((i) => CORNER_FACELETS[i]),
    };
  }

  return null;
}

/**
 * Colors -> faces, using the centers as the mapping. This is what makes a cube
 * held in a non-standard orientation still solve correctly.
 */
export function toFaces(facelets: string): string {
  const map = new Map(CENTERS.map((i, n) => [facelets[i], FACES[n]]));
  return [...facelets].map((c) => map.get(c) ?? '?').join('');
}
