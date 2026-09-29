# Cube Solver

Paint your scrambled cube, get a solution, follow it turn by turn on a 3D cube.
Runs entirely in the browser: no server, no accounts, no env vars.

Two modes: **Fewest moves** (Kociemba via `cubejs`, ≤22 moves) and **Teach me**
(in-house layer-by-layer, ~150 moves grouped into named stages).

```
npm install
npm run dev      # http://localhost:5173 — no type-check
npm test         # 42 tests: model, both solvers, the 3D turn geometry
npm run build    # tsc -b && vite build → dist/
npm run preview  # serve dist/
```

## Layout

```
src/model/     cube state, moves, validation, scrambles — no I/O, no three, no React
src/solver/    Kociemba (cubejs) for Fast, in-house layer-by-layer for Learn, both in a worker
src/three/     scene, cubies, pivot-group layer turns, picking — imperative, outside React
src/store/     Zustand, the single source of truth
src/ui/        net editor, palette, move list, transport
```

The 3D scene is a view, never a source of truth. Jump-to-move and step-back are
"rebuild the scene from the logical state", not animation reversal.

The cube state lives in the URL hash as 54 colour characters, so a scramble can
be shared or reloaded. Kociemba's tables (~2s) are built in the worker at page
load, not at submit.

## Gotchas

- **Share links only work in the production build.** Under `npm run dev`,
  StrictMode runs the effects twice and the URL-sync effect overwrites the hash
  with a blank cube before it loads. Test links against `npm run preview`.
- `src/solver/cubejs.ts` runs `cubejs/lib/solve.js` through `new Function`, so a
  CSP without `unsafe-eval` breaks Fast mode.
- Importing `src/solver/index.ts` spawns the worker and `src/store/index.ts`
  calls `matchMedia`, so neither can be imported from a test (node environment).

`.claude/skills/verify/SKILL.md` has the recipe for driving the UI in a browser.

## Known issues

- Stickers that fail validation are never highlighted: the only code that sets
  the error is behind the Solve button, which is disabled while validation fails.
- An already-solved cube gets a pointless 14-move "solution" in Fewest moves
  (`cubejs` returns an identity sequence; nothing guards it).
- Painting across faces quickly ratchets the camera into the cube until reload.
- Apply with an empty scramble field silently replaces the cube with a solved one.

## Not built yet

- PWA / offline install (`vite-plugin-pwa`); the fonts also come from Google Fonts
- WebGL2 fallback to a 2D net view
- Playwright end-to-end tests and `@axe-core/playwright`
- ESLint / Prettier config, CI, deployment config

Comments through the code still cite the original design docs (validation rules
`VA-1`…`VA-7`, `DESIGN.md` section numbers). Those docs are no longer in the
repo; the code is the spec.
