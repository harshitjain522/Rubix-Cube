import { useState } from 'react';
import { stringify } from '../model/moves';
import { useStore } from '../store';

/**
 * Set as a printed algorithm sheet would set it: fixed columns, so R, R' and
 * R2 line up down the page instead of drifting with their own widths. That
 * alignment is the entire reason the notation is monospaced.
 *
 * In Learn mode the stages collapse to the one you are on (DESIGN.md §13.4).
 * Seven open stages is a scroll you have to manage while holding a cube; one
 * open stage is the thing you are actually doing, and the rest stay one tap
 * away for anyone reading ahead.
 */
export default function MoveList() {
  const stages = useStore((s) => s.solve.stages);
  const mode = useStore((s) => s.solve.mode);
  const index = useStore((s) => s.playback.index);
  const seek = useStore((s) => s.seek);
  const [pinned, setPinned] = useState<number | null>(null);

  let sum = 0;
  const starts = stages.map((stage) => {
    const start = sum;
    sum += stage.moves.length;
    return start;
  });

  // The stage the playhead is inside: the last one that has already begun.
  const active = starts.reduce((best, start, i) => (index >= start ? i : best), 0);
  const collapsible = stages.length > 1;

  return (
    <div className="flex flex-col gap-6">
      {stages.map((stage, i) => {
        const body = (
          <>
            <p className="mb-4 max-w-[58ch] text-[15px] leading-6 text-muted">{stage.goal}</p>
            <ol className="grid grid-cols-[repeat(auto-fill,minmax(3.25rem,1fr))]">
              {stage.moves.map((move, m) => {
                const position = starts[i] + m;
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
              <p className="mt-3 max-w-[58ch] text-[14px] leading-6 text-muted italic">
                {stage.look}
              </p>
            )}
          </>
        );

        const heading = (
          <span className="flex flex-1 items-baseline justify-between gap-4">
            <span className="text-[17px] font-semibold">
              {/* Numbered because these genuinely are a sequence you cannot
                  reorder — you can't place the middle layer before the cross. */}
              {mode === 'learn' ? `${i + 1}. ` : ''}
              {stage.name}
            </span>
            <span className="text-[14px] whitespace-nowrap text-muted tabular-nums">
              {stage.moves.length} moves
            </span>
          </span>
        );

        if (!collapsible) {
          return (
            <section key={stage.name}>
              <h3 className="mb-2 flex">{heading}</h3>
              {body}
            </section>
          );
        }

        return (
          <details
            key={stage.name}
            open={i === active || i === pinned}
            onToggle={(e) => setPinned(e.currentTarget.open ? i : null)}
          >
            <summary className="mb-2 flex cursor-pointer list-none items-baseline gap-3">
              <Chevron />
              {heading}
            </summary>
            {body}
          </details>
        );
      })}
    </div>
  );
}

/** CSS rotates it open; the marker is hidden because `list-none` removes it. */
function Chevron() {
  return (
    <svg
      viewBox="0 0 12 12"
      width="11"
      height="11"
      aria-hidden="true"
      fill="currentColor"
      className="shrink-0 translate-y-[-1px] text-muted [details[open]_&]:rotate-90"
    >
      <path d="M4 2l5 4-5 4z" />
    </svg>
  );
}
