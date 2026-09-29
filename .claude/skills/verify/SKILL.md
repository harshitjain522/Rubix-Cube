---
name: verify
description: Build, launch and drive Cube Solver in the built-in browser to verify a change at the UI.
---

# Verifying Cube Solver

Single-package Vite app, no backend, no env vars. The surface is the browser page.

## Launch

```bash
npm run build
npx vite preview --port 4175 --strictPort   # run in background
```

Use the **production preview**, not `npm run dev`: under dev `StrictMode` the
share-link hash is overwritten with a blank cube, so `#<54 colors>` URLs don't load.

Load a specific cube: `history.replaceState(null, '', '#' + colors); location.reload()`
(colors = 54 chars of `WRGYOB-`, index order U R F D L B; solved =
`WWWWWWWWWRRRRRRRRRGGGGGGGGGYYYYYYYYYOOOOOOOOOBBBBBBBBB`). Navigating to a new
hash on the same page does not reload the app.

## Flows worth driving

- Net: palette radio click, cell click (`[data-index=N]`), keys 1–6 / arrows on a focused cell, drag across cells.
- 3D: tap a sticker paints it (read `location.hash` diff); a drag orbits and must not paint; taps are ignored while a solution is shown.
- "Start it another way" → Scramble / Clear / Undo / Redo / paste sequence + **Apply button**.
- Solve → Transport (Restart / Step back / Play / Step forward, speed select), click a move chip to jump, End/Home keys.
- Header: "Teach me" re-solves when a solution is showing; "Face letters" persists in `localStorage.colorblind`.
- Read state from the DOM: `h2`, the "N of M" `<p>`, `[role=status]` live region, `.suspect` count.

## Harness gotchas

- `computer key "space"` and `"Return"` arrive with an empty `e.key`; use the Apply button, or dispatch `new KeyboardEvent('keydown', { key: ' ', bubbles: true })` on `document.body` for Space. `type` sends no keydown.
- `left_click_drag` on the net reports "page navigated" because each paint calls `history.replaceState`; the paint still happens.
- Screenshot coordinates are an 800x600 frame; the viewport is 1024x768 CSS px.
- Capture the WebGL canvas inside `requestAnimationFrame(() => canvas.toDataURL(...))` (no `preserveDrawingBuffer`), and POST it to a tiny local node server to save it as a file.
- Many face-changing paints in quick succession ratchet the camera toward the cube (pre-existing; overlapping `lookAt` tweens). Reload to reset the view.
- Can't emulate `prefers-reduced-motion` from the tools; that path stays unverified.
