import { stringify } from '../model/moves';
import { useStore } from '../store';

/**
 * Set as a printed algorithm sheet would set it: fixed columns, so R, R' and
 * R2 line up down the page instead of drifting with their own widths. That
 * alignment is the entire reason the notation is monospaced.
 */
export default function MoveList() {
  const stages = useStore((s) => s.solve.stages);
  const mode = useStore((s) => s.solve.mode);
  const index = useStore((s) => s.playback.index);
  const seek = useStore((s) => s.seek);

  let offset = 0;
  return (
    <div className="flex flex-col gap-7">
      {stages.map((stage, stageNumber) => {
        const start = offset;
        offset += stage.moves.length;
        return (
          <section key={stage.name} className="border-t border-ink pt-3">
            <header className="mb-2 flex items-baseline justify-between gap-4">
              <h3 className="text-[17px] font-semibold">
                {mode === 'learn' ? `${stageNumber + 1}. ` : ''}
                {stage.name}
              </h3>
              <span className="text-[13px] whitespace-nowrap text-muted">
                {stage.moves.length} moves
              </span>
            </header>
            <p className="mb-4 max-w-[62ch] text-[15px] leading-6 text-muted">{stage.goal}</p>
            <ol className="grid grid-cols-[repeat(auto-fill,minmax(3rem,1fr))]">
              {stage.moves.map((move, i) => {
                const position = start + i;
                const current = position === index;
                return (
                  <li key={position}>
                    <button
                      type="button"
                      onClick={() => seek(position)}
                      aria-current={current ? 'step' : undefined}
                      aria-label={`Move ${position + 1}, ${stringify(move)}`}
                      className={`h-9 w-full border-b-2 text-left font-mono text-[18px] font-medium ${
                        current
                          ? 'border-ink text-ink'
                          : position < index
                            ? 'border-transparent text-muted'
                            : 'border-transparent text-ink'
                      }`}
                    >
                      {stringify(move)}
                    </button>
                  </li>
                );
              })}
            </ol>
            {mode === 'learn' && (
              <p className="mt-3 max-w-[62ch] text-[14px] leading-6 text-muted italic">
                {stage.look}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
