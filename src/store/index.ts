import { create } from 'zustand';
import { CENTERS, SOLVED, type Color, type Face } from '../model/facelets';
import { applyMoves, parse, scrambledState, type Move } from '../model/moves';
import { toFaces, validate, type ValidationError } from '../model/validate';
import { FACE_COLOR } from '../design/tokens';
import { initSolver, solve, type SolveMode } from '../solver';
import type { Stage } from '../solver/beginner';

/** Faces -> colors under our orientation convention. */
const colorsOf = (faces: string) => [...faces].map((f) => FACE_COLOR[f as Face]).join('');

/** Only the centers painted, because centers never move. */
const BLANK = [...SOLVED].map((f, i) => (CENTERS.includes(i) ? FACE_COLOR[f as Face] : '-')).join('');

const HISTORY_LIMIT = 60;

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

export const useStore = create<AppState>((set, get) => {
  const commit = (facelets: string) =>
    set((s) => {
      const history = [...s.input.history.slice(0, s.input.cursor + 1), facelets].slice(-HISTORY_LIMIT);
      return {
        input: { ...s.input, facelets, history, cursor: history.length - 1 },
        solve: { ...s.solve, error: undefined },
      };
    });
  const moveCursor = (delta: number) =>
    set(({ input }) => {
      const cursor = Math.max(0, Math.min(input.history.length - 1, input.cursor + delta));
      return { input: { ...input, cursor, facelets: input.history[cursor] } };
    });
  const setSolve = (patch: Partial<AppState['solve']>) => set((s) => ({ solve: { ...s.solve, ...patch } }));
  const setPlayback = (patch: Partial<AppState['playback']>) =>
    set((s) => ({ playback: { ...s.playback, ...patch } }));

  let colorblind = false;
  try {
    colorblind = localStorage.getItem('colorblind') === '1';
  } catch {} // storage blocked: fall back to off

  return {
    input: { facelets: BLANK, selectedColor: 'W', history: [BLANK], cursor: 0 },
    solve: { status: 'idle', mode: 'fast', stages: [], moves: [], tablesReady: false },
    playback: { index: 0, playing: false, speed: 1 },
    prefs: {
      colorblind,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    },

    paint(index) {
      const { facelets, selectedColor } = get().input;
      // Centers never move, so they never change.
      if (CENTERS.includes(index) || facelets[index] === selectedColor) return;
      commit(facelets.slice(0, index) + selectedColor + facelets.slice(index + 1));
    },
    selectColor: (selectedColor) => set((s) => ({ input: { ...s.input, selectedColor } })),
    undo: () => moveCursor(-1),
    redo: () => moveCursor(1),
    clear: () => commit(BLANK),
    loadScramble: () => commit(colorsOf(scrambledState().facelets)),
    // Throws on bad notation; the caller shows the message.
    loadSequence: (text) => commit(colorsOf(applyMoves(SOLVED, parse(text)))),
    setMode(mode) {
      setSolve({ mode });
      if (get().solve.status === 'ready') void get().solveCube();
    },
    async solveCube() {
      const { facelets } = get().input;
      const problem = validate(facelets);
      if (problem) return setSolve({ status: 'error', error: problem });
      setSolve({ status: 'solving', error: undefined });
      setPlayback({ index: 0, playing: false });
      try {
        const stages = await solve(toFaces(facelets), get().solve.mode);
        setSolve({ status: 'ready', stages, moves: stages.flatMap((st) => st.moves) });
      } catch (err) {
        const message = `Couldn’t solve that. ${
          err instanceof Error ? err.message : 'Try again, or clear and re-enter the cube.'
        }`;
        setSolve({ status: 'error', error: { code: 'solver', message, faceletIndices: [] } });
      }
    },
    backToInput() {
      setSolve({ status: 'idle', stages: [], moves: [], error: undefined });
      setPlayback({ index: 0, playing: false });
    },
    seek: (index) => setPlayback({ index: Math.max(0, Math.min(get().solve.moves.length, index)) }),
    step: (delta) => get().seek(get().playback.index + delta),
    setPlaying: (playing) => setPlayback({ playing }),
    setSpeed: (speed) => setPlayback({ speed }),
    toggleColorblind() {
      const colorblind = !get().prefs.colorblind;
      try {
        localStorage.setItem('colorblind', colorblind ? '1' : '0');
      } catch {} // still works for this visit
      set((s) => ({ prefs: { ...s.prefs, colorblind } }));
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
  initSolver()
    .then(() => useStore.setState((s) => ({ solve: { ...s.solve, tablesReady: true } })))
    .catch(() => {}); // the failure surfaces on the first solve, with a message
}
