import { SOLVED, FACES } from './facelets';
import { applyMoves, type Amount, type Move } from './moves';

export function isSolved(facelets: string): boolean {
  return facelets === SOLVED;
}

/** A random scramble that never turns the same face twice in a row. */
export function randomScramble(length = 25): Move[] {
  const moves: Move[] = [];
  while (moves.length < length) {
    const layer = FACES[Math.floor(Math.random() * 6)];
    if (moves[moves.length - 1]?.layer === layer) continue;
    moves.push({ layer, amount: (1 + Math.floor(Math.random() * 3)) as Amount });
  }
  return moves;
}

export function scrambledState(length = 25): { facelets: string; moves: Move[] } {
  const moves = randomScramble(length);
  return { facelets: applyMoves(SOLVED, moves), moves };
}
