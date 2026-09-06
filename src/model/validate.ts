// VA-1 .. VA-7. Every failure names the pieces to look at again, because
// "invalid cube state" is where users give up.

import {
  CENTERS, CORNER_FACELETS, CORNER_NAMES, COLORS, EDGE_FACELETS, EDGE_NAMES,
  permutationParity, toCubies, type Color,
} from './facelets';

export type ErrorCode =
  | 'incomplete' | 'counts' | 'centers' | 'edge-set' | 'corner-set'
  | 'twist' | 'flip' | 'parity';

export interface ValidationError {
  code: ErrorCode;
  message: string;
  /** Stickers to highlight on the net and the cube. */
  faceletIndices: number[];
}

const COLOR_NAME: Record<Color, string> = {
  W: 'white', Y: 'yellow', R: 'red', O: 'orange', G: 'green', B: 'blue',
};

/**
 * `facelets` is a 54-char string of colors, or '-' for an unpainted sticker.
 * Checks stop at the first failure: a duplicate piece makes parity meaningless.
 */
export function validate(facelets: string): ValidationError | null {
  const blanks = [...facelets].flatMap((c, i) => (c === '-' ? [i] : []));
  if (blanks.length) {
    return {
      code: 'incomplete',
      message: `${blanks.length} sticker${blanks.length === 1 ? '' : 's'} to go.`,
      faceletIndices: blanks,
    };
  }

  // VA-1: nine of each color.
  const counts = new Map<string, number[]>();
  [...facelets].forEach((c, i) => counts.set(c, [...(counts.get(c) ?? []), i]));
  const over = COLORS.filter((c) => (counts.get(c)?.length ?? 0) > 9);
  const under = COLORS.filter((c) => (counts.get(c)?.length ?? 0) < 9);
  if (over.length || under.length) {
    const say = (c: Color) => `${counts.get(c)?.length ?? 0} ${COLOR_NAME[c]}`;
    return {
      code: 'counts',
      message:
        `${[...over, ...under].map(say).join(', ')}. ` +
        `There should be nine of each — one of these is misread.`,
      faceletIndices: [...over, ...under].flatMap((c) => counts.get(c) ?? []),
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

  const { state, badCorner, badEdge } = toCubies(toFaces(facelets));

  // VA-3 / VA-4: the pieces are the real twelve edges and eight corners.
  if (badEdge !== null) {
    return pieceError('edge-set', badEdge, EDGE_FACELETS, EDGE_NAMES, state.ep, facelets, 'edge');
  }
  if (badCorner !== null) {
    return pieceError('corner-set', badCorner, CORNER_FACELETS, CORNER_NAMES, state.cp, facelets, 'corner');
  }
  const edgeDupe = firstDuplicate(state.ep);
  if (edgeDupe !== null) {
    return pieceError('edge-set', edgeDupe, EDGE_FACELETS, EDGE_NAMES, state.ep, facelets, 'edge');
  }
  const cornerDupe = firstDuplicate(state.cp);
  if (cornerDupe !== null) {
    return pieceError('corner-set', cornerDupe, CORNER_FACELETS, CORNER_NAMES, state.cp, facelets, 'corner');
  }

  // VA-5: corner twists sum to zero mod 3.
  const twist = state.co.reduce((a, b) => a + b, 0) % 3;
  if (twist) {
    const suspects = state.co.flatMap((o, i) => (o === (3 - twist) % 3 ? [i] : []));
    const pick = suspects.length ? suspects : state.co.flatMap((o, i) => (o ? [i] : []));
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
  const flip = state.eo.reduce((a, b) => a + b, 0) % 2;
  if (flip) {
    const pick = state.eo.flatMap((o, i) => (o ? [i] : []));
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
        'Two pieces are swapped, which a real cube can\u2019t do. Two stickers were probably read in the wrong order.',
      faceletIndices: swapped.flatMap((i) => CORNER_FACELETS[i]),
    };
  }

  return null;
}

function firstDuplicate(p: number[]): number | null {
  for (let i = 0; i < p.length; i++) if (p.indexOf(p[i]) !== i) return i;
  return null;
}

function pieceError(
  code: ErrorCode,
  slot: number,
  facelets: readonly number[][],
  names: readonly string[],
  perm: number[],
  colors: string,
  kind: string,
): ValidationError {
  const twin = perm.findIndex((p, i) => i !== slot && p === perm[slot] && p >= 0);
  const slots = twin >= 0 ? [slot, twin] : [slot];
  const read = facelets[slot].map((i) => COLOR_NAME[colors[i] as Color]).join('-and-');
  return {
    code,
    message:
      twin >= 0
        ? `Two pieces read as ${read}. One of them is something else — look at both ${kind} pieces again and check every sticker.`
        : `The ${names[slot]} ${kind} reads as ${read}, which isn\u2019t a real piece. Check its stickers.`,
    faceletIndices: slots.flatMap((i) => facelets[i]),
  };
}

/**
 * Colors -> faces, using the centers as the mapping. This is what makes a cube
 * held in a non-standard orientation still solve correctly.
 */
export function toFaces(facelets: string): string {
  const map = new Map(CENTERS.map((i, n) => [facelets[i], 'URFDLB'[n]]));
  return [...facelets].map((c) => map.get(c) ?? '?').join('');
}
