import { useEffect, useRef, useState } from 'react';
import { FACES, type Face } from '../model/facelets';
import { inverse } from '../model/moves';
import { createRenderer, type Renderer } from '../three/renderer';
import { stateAt, useStore } from '../store';

const TURN_MS = 250;

/**
 * The one place React and three.js meet. React never renders the scene; it
 * writes to the store, and this effect makes the scene agree with it.
 */
export default function Viewport() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { prefs } = useStore.getState();
    const renderer = createRenderer(canvas, prefs.reducedMotion);
    rendererRef.current = renderer;
    renderer.onPick((index) => useStore.getState().paint(index));

    // Which move the scene is currently showing. The store owns the truth; this
    // is only how far the pictures have caught up.
    let shown = 0;
    let busy = false;

    const sync = async () => {
      if (busy) return;
      const { solve, playback, input, prefs: p } = useStore.getState();
      if (solve.status !== 'ready') {
        shown = 0;
        renderer.setState(input.facelets);
        renderer.setPickingEnabled(solve.status === 'idle' || solve.status === 'error');
        return;
      }
      renderer.setPickingEnabled(false);
      const target = playback.index;
      if (target === shown) {
        if (!playback.playing) return;
        if (target < solve.moves.length) useStore.getState().seek(target + 1);
        else useStore.getState().setPlaying(false);
        return;
      }
      busy = true;
      try {
        const delta = target - shown;
        const ms = p.reducedMotion ? 0 : TURN_MS / playback.speed;
        if (delta === 1) await renderer.turn(solve.moves[shown], ms);
        else if (delta === -1) await renderer.turn(inverse(solve.moves[shown - 1]), ms);
        else renderer.setState(stateAt(target)); // any bigger jump: rebuild, don't animate
        shown = target;
      } finally {
        busy = false;
      }
      void sync();
    };

    renderer.setState(useStore.getState().input.facelets);
    renderer.setColorblind(prefs.colorblind);
    const unsubscribe = useStore.subscribe(() => void sync());
    void sync();

    return () => {
      unsubscribe();
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  // Colorblind mode and the "show me the face I'm painting" camera nudge are
  // both one-liners once the renderer exists.
  const colorblind = useStore((s) => s.prefs.colorblind);
  useEffect(() => {
    rendererRef.current?.setColorblind(colorblind);
  }, [colorblind]);

  const selectedFace = useSelectedFace();
  useEffect(() => {
    if (selectedFace) rendererRef.current?.lookAt(selectedFace);
  }, [selectedFace]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="h-full w-full touch-none bg-stage"
    />
  );
}

/** The face the user last touched on the net, so the cube can turn to show it. */
function useSelectedFace(): Face | null {
  const facelets = useStore((s) => s.input.facelets);
  const previous = useRef(facelets);
  const [face, setFace] = useState<Face | null>(null);
  useEffect(() => {
    const changed = [...facelets].findIndex((c, i) => c !== previous.current[i]);
    previous.current = facelets;
    if (changed >= 0) setFace(FACES[Math.floor(changed / 9)]);
  }, [facelets]);
  return face;
}
