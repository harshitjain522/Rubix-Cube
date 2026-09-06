import { create } from 'zustand';
import { CENTERS, SOLVED, type Color, type Face } from '../model/facelets';
import { applyMoves, parse, type Move } from '../model/moves';
import { scrambledState } from '../model/scramble';
import { toFaces, validate, type ValidationError } from '../model/validate';
import { FACE_COLOR } from '../design/tokens';
import { solver, type SolveMode } from '../solver';
import type { Stage } from '../solver/beginner';

const BLANK = [...'-'.repeat(54)]
  .map((c, i) => (CENTERS.includes(i) ? FACE_COLOR['URFDLB'[Math.floor(i / 9)] as Face] : c))
  .join('');

const HISTORY_LIMIT = 60;

export type Phase = 'input' | 'solved';

export interface AppState {
  input: {
    facelets: string;
    selectedColor: Color;
    history: string[];
    cursor: number;
  };
  solve: {
    status: 'idle' | 'solving' | 'ready' | 'error';
    mode: SolveMode;
    stages: Stage[];
    moves: Move[];
    error?: ValidationError | { code: 'solver'; message: string; faceletIndices: number[] };
    tablesReady: boolean;
  };
  playback: { index: number; playing: boolean; speed: number };
  prefs: { colorblind: boolean; reducedMotion: boolean };

  paint(index: number): void;
  selectColor(color: Color): void;
  undo(): void;
  redo(): void;
  clear(): void;
  loadScramble(): void;
  loadSequence(text: string): void;
  setMode(mode: SolveMode): void;
  solveCube(): Promise<void>;
  backToInput(): void;
  seek(index: number): void;
  step(delta: number): void;
  setPlaying(playing: boolean): void;
  setSpeed(speed: number): void;
  toggleColorblind(): void;
}

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const storedColorblind =
  typeof localStorage !== 'undefined' && localStorage.getItem('colorblind') === '1';

/** Colors of a state that has been scrambled from solved. */
function colorsOf(faces: string): string {
  return [...faces].map((f) => FACE_COLOR[f as Face]).join('');
}

export const useStore = create<AppState>((set, get) => {
  const commit = (facelets: string) =>
    set((s) => {
      const history = [...s.input.history.slice(0, s.input.cursor + 1), facelets].slice(
        -HISTORY_LIMIT,
      );
      return {
        input: { ...s.input, facelets, history, cursor: history.length - 1 },
        solve: { ...s.solve, error: undefined },
      };
    });

  return {
    input: { facelets: BLANK, selectedColor: 'W', history: [BLANK], cursor: 0 },
    solve: { status: 'idle', mode: 'fast', stages: [], moves: [], tablesReady: false },
    playback: { index: 0, playing: false, speed: 1 },
    prefs: { colorblind: storedColorblind, reducedMotion: prefersReducedMotion },

    paint(index) {
      if (CENTERS.includes(index)) return; // centers never move, so they never change
      const { facelets, selectedColor } = get().input;
      if (facelets[index] === selectedColor) return;
      commit(facelets.slice(0, index) + selectedColor + facelets.slice(index + 1));
    },
    selectColor(color) {
      set((s) => ({ input: { ...s.input, selectedColor: color } }));
    },
    undo() {
      set((s) => {
        const cursor = Math.max(0, s.input.cursor - 1);
        return { input: { ...s.input, cursor, facelets: s.input.history[cursor] } };
      });
    },
    redo() {
      set((s) => {
        const cursor = Math.min(s.input.history.length - 1, s.input.cursor + 1);
        return { input: { ...s.input, cursor, facelets: s.input.history[cursor] } };
      });
    },
    clear() {
      commit(BLANK);
    },
    loadScramble() {
      commit(colorsOf(scrambledState(25).facelets));
    },
    loadSequence(text) {
      // Throws on bad notation; the caller shows the message.
      commit(colorsOf(applyMoves(SOLVED, parse(text))));
    },
    setMode(mode) {
      set((s) => ({ solve: { ...s.solve, mode } }));
      if (get().solve.status === 'ready') void get().solveCube();
    },
    async solveCube() {
      const { facelets } = get().input;
      const problem = validate(facelets);
      if (problem) {
        set((s) => ({ solve: { ...s.solve, status: 'error', error: problem } }));
        return;
      }
      set((s) => ({
        solve: { ...s.solve, status: 'solving', error: undefined },
        playback: { ...s.playback, index: 0, playing: false },
      }));
      try {
        const stages = await solver.solve(toFaces(facelets), get().solve.mode);
        set((s) => ({
          solve: {
            ...s.solve,
            status: 'ready',
            stages,
            moves: stages.flatMap((st) => st.moves),
          },
        }));
      } catch (err) {
        set((s) => ({
          solve: {
            ...s.solve,
            status: 'error',
            error: {
              code: 'solver',
              message:
                err instanceof Error
                  ? `Couldn’t solve that. ${err.message}`
                  : 'Couldn’t solve that. Try again, or clear and re-enter the cube.',
              faceletIndices: [],
            },
          },
        }));
      }
    },
    backToInput() {
      set((s) => ({
        solve: { ...s.solve, status: 'idle', stages: [], moves: [], error: undefined },
        playback: { index: 0, playing: false, speed: s.playback.speed },
      }));
    },
    seek(index) {
      const max = get().solve.moves.length;
      set((s) => ({
        playback: { ...s.playback, index: Math.max(0, Math.min(max, index)) },
      }));
    },
    step(delta) {
      get().seek(get().playback.index + delta);
    },
    setPlaying(playing) {
      set((s) => ({ playback: { ...s.playback, playing } }));
    },
    setSpeed(speed) {
      set((s) => ({ playback: { ...s.playback, speed } }));
    },
    toggleColorblind() {
      set((s) => {
        const colorblind = !s.prefs.colorblind;
        localStorage.setItem('colorblind', colorblind ? '1' : '0');
        return { prefs: { ...s.prefs, colorblind } };
      });
    },
  };
});

/** The logical cube after `index` moves of the current solution. */
export function stateAt(index: number): string {
  const { input, solve } = useStore.getState();
  return applyMoves(input.facelets, solve.moves.slice(0, index));
}

/** Solver table warm-up, started at page load rather than at submit. */
export function warmSolver() {
  solver
    .init()
    .then(() => useStore.setState((s) => ({ solve: { ...s.solve, tablesReady: true } })))
    .catch(() => {}); // the failure surfaces on the first solve, with a message
}
