import { useEffect } from 'react';
import { stringify } from '../model/moves';
import { announce, describe } from './language';
import { useStore } from '../store';

const SPEEDS = [0.25, 0.5, 1, 2, 4];

/**
 * The move you are on, at the size you can read from arm's length with a cube
 * in your hands. On a phone this is the largest thing on the screen, sitting
 * directly under the cube; on a desktop it shares the transport row.
 */
export function CurrentMove({ className = '' }: { className?: string }) {
  const moves = useStore((s) => s.solve.moves);
  const index = useStore((s) => s.playback.index);
  const move = index >= moves.length ? null : moves[index];

  return (
    <div className={`flex min-w-0 items-baseline gap-x-4 gap-y-1 ${className}`}>
      {move ? (
        <>
          <span className="font-mono text-[44px] leading-none font-bold tracking-[-0.06em]">
            {stringify(move)}
          </span>
          <span className="text-[16px] leading-6 text-[#B9BEC6]">{describe(move)}</span>
        </>
      ) : (
        <span className="text-[34px] leading-none font-semibold">Solved.</span>
      )}
    </div>
  );
}

export default function Transport() {
  const moves = useStore((s) => s.solve.moves);
  const index = useStore((s) => s.playback.index);
  const playing = useStore((s) => s.playback.playing);
  const speed = useStore((s) => s.playback.speed);
  const { seek, step, setPlaying, setSpeed } = useStore.getState();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const actions: Record<string, () => void> = {
        ' ': () => setPlaying(!useStore.getState().playback.playing),
        ArrowRight: () => step(1),
        ArrowLeft: () => step(-1),
        Home: () => seek(0),
        End: () => seek(moves.length),
      };
      const action = actions[e.key];
      if (!action) return;
      e.preventDefault();
      action();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moves.length, seek, step, setPlaying]);

  const done = index >= moves.length;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-stage-rule bg-stage px-5 py-3 text-[#EDEEEA]">
      <div className="flex items-center gap-1">
        <Button label="Restart" onClick={() => seek(0)} disabled={index === 0}>
          <Icon shape="restart" />
        </Button>
        <Button label="Step back" onClick={() => step(-1)} disabled={index === 0}>
          <Icon shape="stepBack" />
        </Button>
        <Button
          label={playing ? 'Pause' : 'Play'}
          onClick={() => setPlaying(!playing)}
          disabled={done}
          wide
        >
          <Icon shape={playing ? 'pause' : 'play'} />
        </Button>
        <Button label="Step forward" onClick={() => step(1)} disabled={done}>
          <Icon shape="stepForward" />
        </Button>
      </div>

      <CurrentMove className="hidden flex-1 lg:flex" />

      <label className="flex items-center gap-2 text-[13px] text-[#B9BEC6]">
        Speed
        <select
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          className="rounded-sm border border-stage-rule bg-transparent px-2 py-1 font-mono text-[13px]"
        >
          {SPEEDS.map((s) => (
            <option key={s} value={s} className="text-ink">
              {s}x
            </option>
          ))}
        </select>
      </label>

      <p className="font-mono text-[13px] tabular-nums text-[#B9BEC6]">
        {Math.min(index + (done ? 0 : 1), moves.length)} / {moves.length}
      </p>

      <p className="sr-only" role="status" aria-live="polite">
        {announce(moves, index)}
      </p>
    </div>
  );
}

/**
 * Drawn rather than typed: the ▶ character for "play" and for "step forward"
 * is the same glyph, and two identical triangles side by side is a coin toss.
 * The bar says which one moves by a single turn.
 */
function Icon({ shape }: { shape: 'restart' | 'stepBack' | 'play' | 'pause' | 'stepForward' }) {
  const paths = {
    restart: 'M10 4v12L4 10zM17 4v12l-6-6z',
    stepBack: 'M4 4h2.5v12H4zM17 4v12L8 10z',
    stepForward: 'M3 4v12l9-6zM13.5 4H16v12h-2.5z',
    play: 'M5 3.5v13L16 10z',
    pause: 'M6 4h2.5v12H6zM11.5 4H14v12h-2.5z',
  };
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" fill="currentColor">
      <path d={paths[shape]} />
    </svg>
  );
}

function Button({
  label,
  onClick,
  disabled,
  wide,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`grid h-11 place-items-center rounded-sm disabled:opacity-30 ${
        wide ? 'w-16 bg-[#EDEEEA] text-stage' : 'w-11 hover:bg-stage-rule'
      }`}
    >
      {children}
    </button>
  );
}
