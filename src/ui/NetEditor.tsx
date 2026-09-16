import { useEffect, useRef, useState } from 'react';
import { CENTERS, FACES, type Color, type Face } from '../model/facelets';
import { COLOR_FACE, COLOR_LABEL, CUBE_COLORS, FACE_LABEL, PALETTE } from '../design/tokens';
import { useStore } from '../store';

// Sized by the column it sits in, not by the viewport: the net lives in a
// panel that is 38% of the window, so vw units overflow it on narrow desktops.
const CELL = 'aspect-square w-full';

/** Where each face block sits in the unfolded cross. */
const PLACEMENT: Record<Face, string> = {
  U: 'col-start-2 row-start-1',
  L: 'col-start-1 row-start-2',
  F: 'col-start-2 row-start-2',
  R: 'col-start-3 row-start-2',
  B: 'col-start-4 row-start-2',
  D: 'col-start-2 row-start-3',
};

export default function NetEditor({ suspects }: { suspects: Set<number> }) {
  const facelets = useStore((s) => s.input.facelets);
  const selected = useStore((s) => s.input.selectedColor);
  const colorblind = useStore((s) => s.prefs.colorblind);
  const paint = useStore((s) => s.paint);
  const [painting, setPainting] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stop = () => setPainting(false);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const key = e.key;
    const digit = '123456'.indexOf(key);
    if (digit >= 0) {
      e.preventDefault();
      useStore.getState().selectColor(PALETTE[digit]);
      paint(index);
      return;
    }
    const delta = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 3, ArrowUp: -3 }[key];
    if (delta === undefined) return;
    e.preventDefault();
    const face = Math.floor(index / 9);
    const next = ((index % 9) + delta + 9) % 9;
    gridRef.current
      ?.querySelector<HTMLButtonElement>(`[data-index="${face * 9 + next}"]`)
      ?.focus();
  };

  return (
    <div
      ref={gridRef}
      className="grid w-full max-w-[472px] grid-cols-4 gap-x-4 gap-y-3"
      role="group"
      aria-label="Cube net"
      style={{ touchAction: 'none' }}
    >
      {FACES.map((face, faceIndex) => (
        <div key={face} className={PLACEMENT[face]}>
          <div className="mb-1.5 text-[13px] font-medium text-muted">{FACE_LABEL[face]}</div>
          <div className="grid grid-cols-3 gap-[2px]" role="grid">
            {Array.from({ length: 9 }, (_, cell) => {
              const index = faceIndex * 9 + cell;
              const color = facelets[index] as Color | '-';
              const isCenter = CENTERS.includes(index);
              return (
                <button
                  key={index}
                  data-index={index}
                  type="button"
                  disabled={isCenter}
                  aria-label={`${FACE_LABEL[face]} face, row ${Math.floor(cell / 3) + 1}, column ${
                    (cell % 3) + 1
                  }, ${color === '-' ? 'empty' : COLOR_LABEL[color]}${isCenter ? ', center' : ''}`}
                  onPointerDown={() => {
                    setPainting(true);
                    paint(index);
                  }}
                  onPointerEnter={() => painting && paint(index)}
                  onKeyDown={(e) => onKeyDown(e, index)}
                  className={`${CELL} grid place-items-center rounded-[4px] text-[11px] font-bold ${
                    suspects.has(index) ? 'suspect' : ''
                  } ${isCenter ? 'ring-1 ring-ink/40 ring-inset cursor-default' : 'cursor-pointer'}`}
                  style={{
                    background: color === '-' ? 'rgb(0 0 0 / 0.06)' : CUBE_COLORS[color],
                    // Empty cells are sunk into the tray; painted ones sit
                    // proud of it, the way a sticker sits on plastic.
                    boxShadow:
                      color === '-'
                        ? 'inset 0 1px 2px rgb(0 0 0 / 0.2)'
                        : '0 1px 0 rgb(255 255 255 / 0.35), inset 0 0 0 1px rgb(0 0 0 / 0.14)',
                    color: color === 'W' || color === 'Y' ? '#15171B' : '#FFFFFF',
                  }}
                >
                  {colorblind && color !== '-' ? COLOR_FACE[color] : ''}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p className="col-span-4 mt-1 max-w-[46ch] text-[13px] leading-5 text-muted">
        Painting with <span className="font-medium text-ink">{COLOR_LABEL[selected]}</span>. Drag
        across cells to fill a run. The centres are already set.
      </p>
    </div>
  );
}
