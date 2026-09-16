import { COLOR_LABEL, CUBE_COLORS, PALETTE } from '../design/tokens';
import { useStore } from '../store';

export default function Palette() {
  const facelets = useStore((s) => s.input.facelets);
  const selected = useStore((s) => s.input.selectedColor);
  const selectColor = useStore((s) => s.selectColor);

  return (
    <div className="flex gap-3" role="radiogroup" aria-label="Sticker color">
      {PALETTE.map((color, i) => {
        const placed = [...facelets].filter((c) => c === color).length;
        const active = color === selected;
        return (
          <div key={color} className="flex flex-col items-center gap-1">
            <button
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${COLOR_LABEL[color]}, ${placed} of 9 placed. Shortcut ${i + 1}.`}
              onClick={() => selectColor(color)}
              className={`rounded-full transition-none ${
                active ? 'h-11 w-11 ring-2 ring-ink ring-offset-2 ring-offset-sheet' : 'h-9 w-9'
              }`}
              style={{
                background: CUBE_COLORS[color],
                boxShadow: 'inset 0 0 0 1px rgb(0 0 0 / 0.18), 0 1px 2px rgb(0 0 0 / 0.2)',
              }}
            />
            {/* Weight, not colour, carries "this count is wrong" — red is a
                cube colour and is never allowed to mean anything else here. */}
            <span
              className={`text-[13px] tabular-nums ${
                placed === 9 ? 'text-muted' : 'font-bold text-ink'
              }`}
            >
              {placed}
            </span>
          </div>
        );
      })}
    </div>
  );
}
