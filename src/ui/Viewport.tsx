import { useEffect, useRef } from 'react';
import { FACES, type Face } from '../model/facelets';
import { inverse } from '../model/moves';
import { createRenderer } from '../three/renderer';
import { stateAt, useStore } from '../store';

const TURN_MS = 250;

/**
 * The one place React and three.js meet. React never renders the scene; it
 * writes to the store, and this subscription makes the scene agree with it.
 */
export default function Viewport() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const store = useStore.getState();
    const renderer = createRenderer(canvasRef.current!, store.prefs.reducedMotion, store.paint);
    renderer.setState(store.input.facelets);
    renderer.setColorblind(store.prefs.colorblind);

    // Which move the scene is currently showing. The store owns the truth; this
    // is only how far the pictures have caught up.
    let shown = 0;
    let busy = false;
    let lastFace: Face | null = null;

    const sync = async () => {
      if (busy) return;
      const { solve, playback, input, prefs } = useStore.getState();
      if (solve.status !== 'ready') {
        shown = 0;
        renderer.setState(input.facelets);
        renderer.setPickingEnabled(solve.status === 'idle' || solve.status === 'error');
        return;
      }
      renderer.setPickingEnabled(false);
      const target = playback.index;
      if (target === shown) {
        if (playback.playing) {
          if (target < solve.moves.length) useStore.getState().seek(target + 1);
          else useStore.getState().setPlaying(false);
        }
        return;
      }
      busy = true;
      try {
        const ms = prefs.reducedMotion ? 0 : TURN_MS / playback.speed;
        if (target === shown + 1) await renderer.turn(solve.moves[shown], ms);
        else if (target === shown - 1) await renderer.turn(inverse(solve.moves[target]), ms);
        else renderer.setState(stateAt(target)); // any bigger jump: rebuild, don't animate
        shown = target;
      } finally {
        busy = false;
      }
      void sync();
    };

    const unsubscribe = useStore.subscribe((s, prev) => {
      if (s.prefs.colorblind !== prev.prefs.colorblind) renderer.setColorblind(s.prefs.colorblind);
      // Turn the cube to show the face the user last touched on the net.
      const changed = [...s.input.facelets].findIndex((c, i) => c !== prev.input.facelets[i]);
      if (changed >= 0 && FACES[Math.floor(changed / 9)] !== lastFace) {
        lastFace = FACES[Math.floor(changed / 9)];
        renderer.lookAt(lastFace);
      }
      void sync();
    });
    void sync();

    return () => {
      unsubscribe();
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="h-full w-full touch-none bg-stage" />;
}
