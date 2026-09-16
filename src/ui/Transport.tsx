import { useEffect } from 'react';
import { stringify } from '../model/moves';
import { announce, describe } from './language';
import { useStore } from '../store';

const SPEEDS = [0.25, 0.5, 1, 2, 4];

/**
 * The move you are on, at the size you can read from arm's length with a cube
 * in your hands. On a phone this is the largest thing below the cube; on a
 * desktop it shares the transport row.
 */
function CurrentMove() {
  const moves = useStore((s) => s.solve.moves);
  const index = useStore((s) => s.playback.index);
  const move = index >= moves.length ? null : moves[index];

  return (
    <div className="flex min-w-0 items-baseline gap-x-4 gap-y-1 lg:order-2 lg:flex-1">
      {move ? (
        <>
          <span className="font-mono text-[44px] leading-none font-bold tracking-[-0.06em]">
            {stringify(move)}
          </span>
          <span className="text-[16px] leading-6 text-muted">{describe(move)}</span>
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
    // Sticky on a phone so the controls stay under your thumb while the move
    // list scrolls; just the last row of the tray on a desktop.
    <div className="sticky bottom-0 -mx-4 flex flex-col gap-3 bg-sheet px-4 pt-3 pb-4 lg:static lg:mx-0 lg:flex-row lg:items-center lg:gap-6 lg:p-0">
      <CurrentMove />

      <div className="flex items-center gap-3 lg:order-1">
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
            primary
          >
            <Icon shape={playing ? 'pause' : 'play'} />
          </Button>
          <Button label="Step forward" onClick={() => step(1)} disabled={done}>
            <Icon shape="stepForward" />
          </Button>
        </div>

        {/* Count and speed ride along with the buttons so a phone gets two
            rows here, not three: the cube needs the vertical space more. */}
        <p className="ml-auto text-[14px] tabular-nums text-muted lg:hidden">
          {Math.min(index + (done ? 0 : 1), moves.length)} of {moves.length}
        </p>
        <SpeedControl speed={speed} setSpeed={setSpeed} />
      </div>

      <p className="hidden text-[14px] tabular-nums text-muted lg:order-3 lg:block">
        {Math.min(index + (done ? 0 : 1), moves.length)} of {moves.length}
      </p>

      <p className="sr-only" role="status" aria-live="polite">
        {announce(moves, index)}
      </p>
    </div>
  );
}

function SpeedControl({ speed, setSpeed }: { speed: number; setSpeed: (n: number) => void }) {
  return (
    <label className="flex items-center gap-2 text-[14px] text-muted lg:order-3">
      <span className="hidden lg:inline">Speed</span>
      <span className="sr-only lg:hidden">Speed</span>
      <select
        value={speed}
        onChange={(e) => setSpeed(Number(e.target.value))}
        className="slot h-9 px-2 text-[14px] text-ink"
      >
        {SPEEDS.map((s) => (
          <option key={s} value={s}>
            {s}x
          </option>
        ))}
      </select>
    </label>
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
  primary,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`grid h-11 place-items-center rounded-full disabled:opacity-30 ${
        primary ? 'w-16 bg-ink text-sheet' : 'key w-11 text-ink'
      }`}
    >
      {children}
    </button>
  );
}
