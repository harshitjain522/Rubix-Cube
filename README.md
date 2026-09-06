# Cube Solver

Paint your scrambled cube, get a solution, follow it turn by turn on a 3D cube.
Built from `PRD.md`, `TECHSTACK.md` and `DESIGN.md`. No server, no accounts.

```
npm install
npm run dev      # http://localhost:5173
npm test         # model, both solvers, and the 3D turn geometry
npm run build
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

## Not built yet

- PWA / offline install (`vite-plugin-pwa`)
- WebGL2 fallback to a 2D net view
- Playwright end-to-end tests and `@axe-core/playwright`
- ESLint / Prettier config

Everything else in the PRD's M1–M6 is in place. The UI has not been checked in a
real browser — the tests cover the model, both solvers, and the agreement
between the animated turn and the facelet permutation, but not the rendering.
