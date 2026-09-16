import { useEffect, useState, type ReactNode } from 'react';
import { CENTERS } from '../model/facelets';
import { stringifyAll } from '../model/moves';
import { validate } from '../model/validate';
import { useStore } from '../store';
import MoveList from './MoveList';
import NetEditor from './NetEditor';
import Palette from './Palette';
import Transport from './Transport';
import Viewport from './Viewport';

const store = useStore.getState;

export default function App() {
  const ready = useStore((s) => s.solve.status === 'ready');
  const mode = useStore((s) => s.solve.mode);
  const colorblind = useStore((s) => s.prefs.colorblind);
  useShareLink();

  return (
    <div className="min-h-full bg-sheet lg:flex lg:h-full lg:flex-col">
      <div className="mx-auto flex w-full max-w-[1320px] flex-1 flex-col gap-4 px-4 pt-4 lg:min-h-0 lg:gap-6 lg:px-8 lg:py-6">
        <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <h1 className="text-[20px] font-semibold tracking-[-0.02em]">Cube Solver</h1>
          <div className="flex items-center gap-2 text-[14px]">
            <button
              type="button"
              onClick={store().toggleColorblind}
              aria-pressed={colorblind}
              className={`h-9 rounded-full px-4 ${
                colorblind ? 'bg-ink font-medium text-sheet' : 'key text-muted hover:text-ink'
              }`}
            >
              Face letters
            </button>
            <div className="slot flex rounded-full p-1">
              {(['fast', 'learn'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => store().setMode(m)}
                  aria-pressed={mode === m}
                  className={`h-7 rounded-full px-3 ${
                    mode === m ? 'bg-ink font-medium text-sheet' : 'text-muted hover:text-ink'
                  }`}
                >
                  {m === 'fast' ? 'Fewest moves' : 'Teach me'}
                </button>
              ))}
            </div>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:gap-8">
          {/* The cube stays put while the notes scroll under it: the person
              reading this is looking between the screen and their own hands. */}
          <section className="sticky top-0 z-10 -mx-4 h-[42vh] shrink-0 bg-sheet px-4 pb-4 lg:static lg:mx-0 lg:h-auto lg:min-h-0 lg:flex-1 lg:p-0">
            <div className="well h-full overflow-hidden">
              <Viewport />
            </div>
          </section>

          <aside className="flex min-h-0 flex-col pb-5 lg:w-[460px] lg:shrink-0 lg:overflow-y-auto lg:pb-0">
            {ready ? <SolutionPanel /> : <InputPanel />}
          </aside>
        </main>

        {ready && <Transport />}
      </div>
    </div>
  );
}

function SolutionPanel() {
  const moves = useStore((s) => s.solve.moves);
  const stageCount = useStore((s) => s.solve.stages.length);
  const learn = useStore((s) => s.solve.mode === 'learn');

  return (
    <>
      <h2 className="text-[36px] leading-[40px] font-semibold tracking-[-0.03em]">
        {moves.length} moves{learn && `, in ${stageCount} stages`}
      </h2>
      <p className="mt-1 mb-6 text-[16px] text-muted">{learn ? 'Take your time.' : 'Follow along.'}</p>
      <MoveList />
      <div className="mt-7 flex gap-3 text-[14px]">
        <Quiet onClick={() => navigator.clipboard?.writeText(stringifyAll(moves))}>Copy solution</Quiet>
        <Quiet onClick={store().backToInput}>Edit the cube</Quiet>
      </div>
    </>
  );
}

function InputPanel() {
  const facelets = useStore((s) => s.input.facelets);
  const status = useStore((s) => s.solve.status);
  const error = useStore((s) => s.solve.error);
  const tablesReady = useStore((s) => s.solve.tablesReady);
  const [sequence, setSequence] = useState('');
  const [notationError, setNotationError] = useState('');

  const problem = status === 'solving' ? null : validate(facelets);
  const remaining = [...facelets].filter((c) => c === '-').length;

  return (
    <>
      <h2 className="text-[36px] leading-[40px] font-semibold tracking-[-0.03em]">Paint your cube</h2>
      <p className="mt-1 mb-5 max-w-[58ch] text-[15px] leading-6 text-muted">
        Hold it with the <span className="text-ink">white centre up</span> and the{' '}
        <span className="text-ink">green centre facing you</span>. Then paint what you see.
      </p>

      <Palette />

      <div className="mt-5">
        <NetEditor suspects={new Set(error?.faceletIndices)} />
      </div>

      {error ? (
        <p role="alert" className="mt-5 text-[15px] leading-6 font-medium">
          {error.message}
        </p>
      ) : (
        problem && remaining === 0 && <p className="mt-5 text-[15px] leading-6 text-muted">{problem.message}</p>
      )}

      <button
        type="button"
        disabled={status === 'solving' || !!problem}
        onClick={() => void store().solveCube()}
        className="mt-5 h-13 w-full rounded-lg bg-ink text-[17px] font-medium text-sheet disabled:bg-transparent disabled:text-muted disabled:shadow-[inset_0_0_0_1px_var(--color-rule)]"
      >
        {status === 'solving'
          ? 'Working out a solution…'
          : remaining
            ? `${remaining} sticker${remaining === 1 ? '' : 's'} to go`
            : problem
              ? 'Fix the cube first'
              : 'Solve this cube'}
      </button>
      {status === 'solving' && !tablesReady && (
        <p className="mt-2 text-[13px] text-muted">Warming up the solver…</p>
      )}

      {/* Every shortcut past painting lives here, folded away, so the net and
          the solve button own the panel on first sight. */}
      <details className="mt-6 text-[14px]">
        <summary className="w-fit cursor-pointer text-muted hover:text-ink">Start it another way</summary>
        <div className="mt-4 flex flex-wrap gap-3">
          <Quiet onClick={store().loadScramble}>Scramble one for me</Quiet>
          <Quiet onClick={store().clear}>Clear</Quiet>
          <Quiet onClick={store().undo}>Undo</Quiet>
          <Quiet onClick={store().redo}>Redo</Quiet>
        </div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            try {
              store().loadSequence(sequence);
              setNotationError('');
            } catch (err) {
              setNotationError(err instanceof Error ? err.message : 'Not a move sequence.');
            }
          }}
        >
          <input
            value={sequence}
            onChange={(e) => setSequence(e.target.value)}
            placeholder="Or paste a scramble: R U R' U' F2"
            aria-label="Scramble sequence"
            className="slot min-w-0 flex-1 px-3 py-2 font-mono text-[14px] placeholder:text-muted"
          />
          <button type="submit" className="rounded-lg px-4 py-2 shadow-[inset_0_0_0_1px_var(--color-ink)]">
            Apply
          </button>
        </form>
        {notationError && <p className="mt-2 leading-6">{notationError}</p>}
      </details>
    </>
  );
}

/** A text action that stays out of the way until you go looking for it. */
function Quiet({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="key h-9 rounded-full px-4 text-muted hover:text-ink">
      {children}
    </button>
  );
}

/** Cube state in the URL, so a scramble can be shared or reloaded. */
function useShareLink() {
  const facelets = useStore((s) => s.input.facelets);
  useEffect(() => {
    // Only on first load; after that the URL follows the cube.
    const hash = location.hash.slice(1); // colors and "-" only, nothing to decode
    if (hash.length === 54 && CENTERS.every((i) => hash[i] !== '-')) {
      useStore.setState((s) => ({ input: { ...s.input, facelets: hash, history: [hash], cursor: 0 } }));
    }
  }, []);
  useEffect(() => history.replaceState(null, '', `#${facelets}`), [facelets]);
}
