// Notation is a foreign language to the person this app is for. Every move
// gets a sentence written from where they are standing.

import type { Move } from '../model/moves';

const DIRECTION: Record<string, string> = {
  U1: 'turn the top layer to the left',
  U2: 'turn the top layer half way round',
  U3: 'turn the top layer to the right',
  D1: 'turn the bottom layer to the right',
  D2: 'turn the bottom layer half way round',
  D3: 'turn the bottom layer to the left',
  R1: 'turn the right layer up, away from you',
  R2: 'turn the right layer half way round',
  R3: 'turn the right layer down, toward you',
  L1: 'turn the left layer down, toward you',
  L2: 'turn the left layer half way round',
  L3: 'turn the left layer up, away from you',
  F1: 'turn the front layer clockwise',
  F2: 'turn the front layer half way round',
  F3: 'turn the front layer counter-clockwise',
  B1: 'turn the back layer counter-clockwise',
  B2: 'turn the back layer half way round',
  B3: 'turn the back layer clockwise',
};

export function describe(move: Move): string {
  return DIRECTION[move.layer + move.amount];
}

/** How a screen reader should say the notation itself. */
function spell(move: Move): string {
  const suffix = move.amount === 2 ? ' two' : move.amount === 3 ? ' prime' : '';
  return move.layer + suffix;
}

export function announce(moves: readonly Move[], index: number): string {
  if (!moves.length) return '';
  if (index >= moves.length) return `Solved. All ${moves.length} moves played.`;
  const move = moves[index];
  return `Move ${index + 1} of ${moves.length}. ${spell(move)}. ${describe(move)}.`;
}
