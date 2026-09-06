import { useEffect, useState } from 'react';
import { CENTERS } from '../model/facelets';
import { stringifyAll } from '../model/moves';
import { validate } from '../model/validate';
import { useStore } from '../store';
import MoveList from './MoveList';
import NetEditor from './NetEditor';
import Palette from './Palette';
import Transport, { CurrentMove } from './Transport';
import Viewport from './Viewport';

export default function App() {
  const facelets = useStore((s) => s.input.facelets);
  const status = useStore((s) => s.solve.status);
  const mode = useStore((s) => s.solve.mode);
  const error = useStore((s) => s.solve.error);
  const moves = useStore((s) => s.solve.moves);
  const stages = useStore((s) => s.solve.stages);
  const tablesReady = useStore((s) => s.solve.tablesReady);
  const colorblind = useStore((s) => s.prefs.colorblind);

  useShareLink();

  const problem = status === 'ready' || status === 'solving' ? null : validate(facelets);
  const remaining = [...facelets].filter((c) => c === '-').length;
  const suspects = new Set(error?.faceletIndices ?? []);

  return (
    <div className="flex h-full flex-col bg-stage">
      <header className="flex items-center justify-between gap-4 border-b border-stage-rule px-5 py-3 text-[#EDEEEA]">
        <h1 className="text-[19px] font-semibold">Cube Solver</h1>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={useStore.getState().toggleColorblind}
            aria-pressed={colorblind}
            className="text-[13px] text-[#B9BEC6] underline-offset-4 hover:underline"
          >
            Face letters {colorblind ? 'on' : 'off'}
          </button>
          <div className="flex rounded-sm border border-stage-rule text-[13px]">
            {(['fast', 'learn'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => useStore.getState().setMode(m)}
                aria-pressed={mode === m}
                className={`px-3 py-1 capitalize ${
                  mode === m ? 'bg-[#EDEEEA] text-stage' : 'text-[#B9BEC6]'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="h-[45vh] shrink-0 lg:h-auto lg:w-[62%] lg:flex-1">
          <Viewport />
        </div>

        {/* On a phone the move you are on sits right under the cube, where you
            are already looking, and everything else scrolls beneath it. */}
        {status === 'ready' && (
          <CurrentMove className="shrink-0 flex-wrap border-t border-stage-rule bg-stage px-5 py-4 text-[#EDEEEA] lg:hidden" />
        )}

        <aside className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-sheet px-6 py-5 lg:w-[38%] lg:flex-none">
          {status === 'ready' ? (
            <>
              <h2 className="mb-1 text-[34px] leading-[38px] font-semibold tracking-[-0.02em]">
                {moves.length} moves
                {mode === 'learn' ? `, in ${stages.length} stages` : ''}
              </h2>
              <p className="mb-6 text-[16px] text-muted">
                {mode === 'learn' ? 'Take your time.' : 'Follow along.'}
              </p>
              <MoveList />
              <div className="mt-6 flex gap-4 border-t border-rule pt-4 text-[14px]">
                <button
                  type="button"
                  className="underline underline-offset-4"
                  onClick={() => navigator.clipboard?.writeText(stringifyAll(moves))}
                >
                  Copy solution
                </button>
                <button
                  type="button"
                  className="underline underline-offset-4"
                  onClick={useStore.getState().backToInput}
                >
                  Edit the cube
                </button>
              </div>
            </>
          ) : (
            <InputPanel
              remaining={remaining}
              problem={problem}
              error={error}
              suspects={suspects}
              status={status}
              tablesReady={tablesReady}
            />
          )}
        </aside>
      </main>

      {status === 'ready' && <Transport />}
    </div>
  );
}

function InputPanel({
  remaining,
  problem,
  error,
  suspects,
  status,
  tablesReady,
}: {
  remaining: number;
  problem: ReturnType<typeof validate>;
  error: ReturnType<typeof useStore.getState>['solve']['error'];
  suspects: Set<number>;
  status: string;
  tablesReady: boolean;
}) {
  const [sequence, setSequence] = useState('');
  const [notationError, setNotationError] = useState('');
  const store = useStore.getState();

  return (
    <>
      <h2 className="text-[34px] leading-[38px] font-semibold tracking-[-0.02em]">Your cube</h2>
      <p className="mt-1 mb-5 max-w-[62ch] text-[15px] leading-6 text-muted">
        Hold your cube with the <span className="text-ink">white centre on top</span> and the{' '}
        <span className="text-ink">green centre facing you</span>, then paint what you see.
      </p>

      <NetEditor suspects={suspects} />

      <div className="mt-6">
        <Palette />
      </div>

      {error && (
        <div
          role="alert"
          className="mt-6 border-l-2 border-ink bg-[#E3E4E0] px-4 py-3 text-[15px] leading-6"
        >
          {error.message}
        </div>
      )}

      <button
        type="button"
        disabled={status === 'solving' || !!problem}
        onClick={() => void store.solveCube()}
        className="mt-6 h-12 w-full bg-ink text-[16px] font-medium text-sheet disabled:bg-rule disabled:text-muted"
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
      {problem && !error && remaining === 0 && (
        <p className="mt-2 text-[14px] leading-6 text-muted">{problem.message}</p>
      )}

      <div className="mt-8 border-t border-rule pt-5">
        <div className="flex flex-wrap gap-4 text-[14px]">
          <button type="button" className="underline underline-offset-4" onClick={store.loadScramble}>
            Scramble one for me
          </button>
          <button type="button" className="underline underline-offset-4" onClick={store.clear}>
            Clear
          </button>
          <button type="button" className="underline underline-offset-4" onClick={store.undo}>
            Undo
          </button>
          <button type="button" className="underline underline-offset-4" onClick={store.redo}>
            Redo
          </button>
        </div>
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            try {
              store.loadSequence(sequence);
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
            className="min-w-0 flex-1 border border-rule bg-transparent px-3 py-2 font-mono text-[14px] placeholder:text-muted"
          />
          <button type="submit" className="border border-ink px-4 py-2 text-[14px]">
            Apply
          </button>
        </form>
        {notationError && <p className="mt-2 text-[14px] text-ink">{notationError}</p>}
      </div>
    </>
  );
}

/** Cube state in the URL, so a scramble can be shared or reloaded. */
function useShareLink() {
  const facelets = useStore((s) => s.input.facelets);
  useEffect(() => {
    const hash = decodeURIComponent(location.hash.slice(1));
    if (hash.length === 54 && CENTERS.every((i) => hash[i] !== '-')) {
      useStore.setState((s) => ({
        input: { ...s.input, facelets: hash, history: [hash], cursor: 0 },
      }));
    }
    // Only on first load; after that the URL follows the cube.
  }, []);
  useEffect(() => {
    history.replaceState(null, '', `#${facelets}`);
  }, [facelets]);
}
