// The 3D scene is a *view*. It never decides anything: the logical facelet
// string decides, and this module's job is to make the scene agree with it.
// That is why jump-to-move, step-back and reduced motion all reduce to
// "rebuild from state" instead of each needing its own animation logic.

import {
  ACESFilmicToneMapping, AmbientLight, ConeGeometry, DirectionalLight, DoubleSide, Group,
  Mesh, MeshBasicMaterial, PerspectiveCamera, Raycaster, SRGBColorSpace, Scene,
  TorusGeometry, Vector2, Vector3, WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LAYER, type Face } from '../model/facelets';
import type { Move } from '../model/moves';
import { SURFACE } from '../design/tokens';
import { buildCube } from './cube';

const easeInOutQuad = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/** Where the camera sits to look a given face square in the eye. */
const FACE_VIEW: Record<Face, Vector3> = {
  U: new Vector3(2.5, 6.5, 3.5),
  D: new Vector3(2.5, -6.5, 3.5),
  F: new Vector3(1.6, 2.2, 7),
  B: new Vector3(-1.6, 2.2, -7),
  R: new Vector3(7, 2.2, 1.6),
  L: new Vector3(-7, 2.2, -1.6),
};

type Point = { x: number; y: number };

/**
 * Did the pointer stay put, or was it orbiting the camera? Only a tap picks a
 * sticker, and only picking a sticker rewrites the shareable URL — so spinning
 * the cube to look at it leaves a link you already copied untouched.
 */
export const isTap = (from: Point, to: Point) => Math.hypot(to.x - from.x, to.y - from.y) <= 5;

/**
 * Lift one layer of cubies onto a pivot. `rotate(t)` turns it that fraction of
 * the way; `finish()` puts the cubies back on the root, snapped to the grid.
 * Exported so the turn test exercises this code, not a copy of it.
 */
export function beginTurn(root: Group, cubies: Group[], move: Move) {
  const { axis, plane } = LAYER[move.layer];
  const xyz = (['x', 'y', 'z'] as const)[axis];
  // Three.js rotations follow the right-hand rule; a face turn is clockwise
  // seen from *outside* that face, hence the sign flips with the plane.
  const angle = -plane * (Math.PI / 2) * (move.amount === 3 ? -1 : move.amount);
  const pivot = new Group();
  root.add(pivot);
  const layer = cubies.filter((c) => Math.abs(c.position[xyz] - plane) < 0.1);
  // attach(), not add(): attach keeps the world transform, add would snap the
  // layer to the pivot's frame and the cube would visibly jump every turn.
  layer.forEach((c) => pivot.attach(c));

  return {
    layer,
    rotate(t: number) {
      pivot.rotation[xyz] = angle * t;
    },
    finish() {
      pivot.rotation[xyz] = angle;
      pivot.updateMatrixWorld(true);
      for (const c of layer) {
        root.attach(c);
        // Without this, float error compounds over a hundred-move solution and
        // the cube slowly deforms. Cube rotations have quaternion components in
        // {0, ±1/2, ±1/√2, ±1}; rounding to halves and renormalising recovers
        // every one of them exactly.
        c.position.round();
        const q = c.quaternion;
        const half = (v: number) => Math.round(v * 2) / 2;
        q.set(half(q.x), half(q.y), half(q.z), half(q.w)).normalize();
      }
      root.remove(pivot);
    },
  };
}

export function createRenderer(
  canvas: HTMLCanvasElement,
  reducedMotion: boolean,
  onPick: (faceletIndex: number) => void,
) {
  const lowDetail = matchMedia('(max-width: 900px)').matches;

  const renderer = new WebGLRenderer({ canvas, antialias: !lowDetail });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.setClearColor(SURFACE.stage);

  const scene = new Scene();
  const camera = new PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(4.2, 4.2, 6);

  scene.add(new AmbientLight(0xffffff, 0.55));
  const key = new DirectionalLight(0xffffff, 0.8);
  key.position.set(5, 8, 6);
  scene.add(key);
  if (!lowDetail) {
    const fill = new DirectionalLight(0xffffff, 0.25);
    fill.position.set(-4, -2, -5);
    scene.add(fill);
  }

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 4.5;
  controls.maxDistance = 12;

  const cube = buildCube(lowDetail);
  scene.add(cube.root);
  let colorblind = false;
  let state = '-'.repeat(54);
  cube.paint(state, colorblind);

  // --- resize --------------------------------------------------------------
  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  // --- animation -----------------------------------------------------------
  type Tween = { elapsed: number; ms: number; step: (t: number) => void; done: () => void };
  const tweens = new Set<Tween>();
  let idleSpin = !reducedMotion;
  let last = performance.now();

  const run = (ms: number, step: (t: number) => void) =>
    new Promise<void>((done) => {
      if (ms > 0) return tweens.add({ elapsed: 0, ms, step, done });
      step(1);
      done();
    });

  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const dt = now - last;
    last = now;
    for (const tween of tweens) {
      tween.elapsed += dt;
      const t = Math.min(tween.elapsed / tween.ms, 1);
      tween.step(t);
      if (t === 1) {
        tweens.delete(tween);
        tween.done();
      }
    }
    if (idleSpin) cube.root.rotation.y += (dt / 1000) * (Math.PI / 30); // ~6 deg/s
    controls.update();
    renderer.render(scene, camera);
  });

  const stopIdle = () => {
    if (!idleSpin) return;
    idleSpin = false;
    void run(320, (t) => {
      cube.root.rotation.y *= 1 - easeOutCubic(t);
    });
  };
  window.addEventListener('keydown', stopIdle);

  // --- picking -------------------------------------------------------------
  const raycaster = new Raycaster();
  let pickingEnabled = false;
  let down: Point | null = null;

  canvas.addEventListener('pointerdown', (e) => {
    stopIdle();
    down = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointerup', (e) => {
    const start = down;
    down = null;
    if (!start || !pickingEnabled || !isTap(start, { x: e.clientX, y: e.clientY })) return;
    const rect = canvas.getBoundingClientRect();
    raycaster.setFromCamera(
      new Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      camera,
    );
    const hit = raycaster.intersectObjects(cube.stickers, false)[0];
    if (hit) onPick(cube.stickers.indexOf(hit.object as (typeof cube.stickers)[number]));
  });

  // --- turn arrow ----------------------------------------------------------
  // Which way a layer is about to go is the one thing notation makes people
  // look up. A quarter-circle drawn on the axis of the turn says it without
  // words, and it is gone by the time the layer has moved far enough to read.
  const arrowMaterial = new MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0, depthTest: false, side: DoubleSide,
  });
  const arcGeometry = new TorusGeometry(1.9, 0.045, 6, 24, Math.PI / 2);
  const headGeometry = new ConeGeometry(0.16, 0.34, 12);
  const arrow = new Group();
  const head = new Mesh(headGeometry, arrowMaterial);
  // Torus sweeps counter-clockwise from +x, so the head sits at the 90 degree
  // end, pointing along the tangent there.
  head.position.set(0, 1.9, 0);
  head.rotation.z = Math.PI / 2;
  arrow.add(new Mesh(arcGeometry, arrowMaterial), head);
  arrow.renderOrder = 1;
  arrow.visible = false;
  cube.root.add(arrow);

  /** Show the arrow on `move`'s layer, then fade it out as the turn starts. */
  function showArrow(move: Move, ms: number) {
    const { axis, plane } = LAYER[move.layer];
    const normal = new Vector3().setComponent(axis, plane);
    // Clockwise seen from outside the face means the arrow's plane normal
    // points *into* the cube for a normal turn, and outward for a prime.
    arrow.quaternion.setFromUnitVectors(
      new Vector3(0, 0, 1),
      move.amount === 3 ? normal : normal.clone().negate(),
    );
    arrow.position.copy(normal).multiplyScalar(1.62);
    arrow.visible = true;
    void run(ms, (t) => {
      // Full strength for the first third, then out of the way.
      arrowMaterial.opacity = 0.85 * (t < 0.33 ? 1 : 1 - (t - 0.33) / 0.67);
      if (t === 1) arrow.visible = false;
    });
  }

  return {
    /** Reset every cubie to its home orientation and repaint from this state. */
    setState(colors: string) {
      state = colors;
      // Turns leave the cubies rotated. Putting every one back on its home
      // cell is what makes "jump to any move" a one-liner.
      for (const cubie of cube.cubies) {
        cubie.quaternion.identity();
        cubie.position.copy(cubie.userData.home);
      }
      cube.paint(colors, colorblind);
    },

    /** Animate one turn; resolves when the cubies have been snapped back. */
    async turn(move: Move, ms: number) {
      stopIdle();
      const turn = beginTurn(cube.root, cube.cubies, move);
      if (ms > 0) {
        showArrow(move, ms);
        await run(ms, (t) => turn.rotate(easeInOutQuad(t)));
      } else {
        // Reduced motion still has to show you *which* layer moved.
        const bodies = turn.layer.map((c) => c.children[0] as Mesh);
        bodies.forEach((b) => (b.material = cube.highlight));
        await run(200, () => {});
        bodies.forEach((b) => (b.material = cube.bodyMaterial));
      }
      turn.finish();
    },

    lookAt(face: Face, ms = 400) {
      const target = FACE_VIEW[face].clone().setLength(camera.position.length());
      const from = camera.position.clone();
      void run(reducedMotion ? 0 : ms, (t) => {
        camera.position.copy(from).lerp(target, easeOutCubic(t));
        controls.update();
      });
    },

    setColorblind(on: boolean) {
      colorblind = on;
      cube.paint(state, colorblind);
    },

    setPickingEnabled(on: boolean) {
      pickingEnabled = on;
    },

    dispose() {
      renderer.setAnimationLoop(null);
      window.removeEventListener('keydown', stopIdle);
      observer.disconnect();
      controls.dispose();
      arcGeometry.dispose();
      headGeometry.dispose();
      arrowMaterial.dispose();
      cube.dispose();
      renderer.dispose();
    },
  };
}
