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
import { buildCube, type CubeMeshes, type StickerMesh } from './cube';

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

export interface Renderer {
  /** Reset every cubie to its home orientation and repaint from this state. */
  setState(colors: string): void;
  /** Animate one turn; resolves when the cubies have been snapped back. */
  turn(move: Move, ms: number): Promise<void>;
  lookAt(face: Face, ms?: number): void;
  setColorblind(on: boolean): void;
  setPickingEnabled(on: boolean): void;
  onPick(handler: (faceletIndex: number) => void): void;
  dispose(): void;
}

/**
 * Did the pointer stay put, or was it orbiting the camera? Only a tap picks a
 * sticker, and only picking a sticker rewrites the shareable URL — so spinning
 * the cube to look at it leaves a link you already copied untouched.
 */
export function isTap(from: Point, to: Point): boolean {
  return Math.hypot(to.x - from.x, to.y - from.y) <= DRAG_SLOP;
}

const DRAG_SLOP = 5;

interface Point {
  x: number;
  y: number;
}

export function createRenderer(canvas: HTMLCanvasElement, reducedMotion: boolean): Renderer {
  const lowDetail = window.matchMedia('(max-width: 900px)').matches;

  const renderer = new WebGLRenderer({ canvas, antialias: !lowDetail, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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

  const cube: CubeMeshes = buildCube(lowDetail);
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
    new Promise<void>((resolve) => {
      if (ms <= 0) {
        step(1);
        resolve();
        return;
      }
      tweens.add({ elapsed: 0, ms, step, done: resolve });
    });

  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const dt = now - last;
    last = now;
    for (const tween of [...tweens]) {
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
  canvas.addEventListener('pointerdown', stopIdle);
  window.addEventListener('keydown', stopIdle);

  // --- picking -------------------------------------------------------------
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  let pickingEnabled = false;
  let pickHandler: ((i: number) => void) | null = null;
  let down: { x: number; y: number } | null = null;

  canvas.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointerup', (e) => {
    const start = down;
    down = null;
    if (!start || !pickingEnabled || !pickHandler) return;
    if (!isTap(start, { x: e.clientX, y: e.clientY })) return;
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(cube.stickers, false)[0];
    if (hit) pickHandler((hit.object as StickerMesh).userData.faceletIndex);
  });

  // --- layer turns ---------------------------------------------------------
  const AXIS = { U: 'y', D: 'y', R: 'x', L: 'x', F: 'z', B: 'z' } as const;
  // Three.js rotations follow the right-hand rule; a face turn is clockwise
  // seen from *outside* that face, which is the opposite sign on U, R and F.
  const SIGN = { U: -1, D: 1, R: -1, L: 1, F: -1, B: 1 } as const;

  function snapToGrid(object: Group) {
    object.position.set(
      Math.round(object.position.x),
      Math.round(object.position.y),
      Math.round(object.position.z),
    );
    const q = object.quaternion;
    q.set(
      Math.round(q.x * 2) / 2,
      Math.round(q.y * 2) / 2,
      Math.round(q.z * 2) / 2,
      Math.round(q.w * 2) / 2,
    ).normalize();
  }

  /** Reduced motion still has to show you *which* layer moved. */
  function flash(layer: Group[]) {
    const bodies = layer.map((c) => c.children[0] as Mesh);
    bodies.forEach((b) => (b.material = cube.highlight));
    return run(200, (t) => {
      if (t === 1) bodies.forEach((b) => (b.material = cube.bodyMaterial));
    });
  }

  // --- turn arrow ----------------------------------------------------------
  // Which way a layer is about to go is the one thing notation makes people
  // look up. A quarter-circle drawn on the axis of the turn says it without
  // words, and it is gone by the time the layer has moved far enough to read.
  /** Outward unit normal of a face, straight off the layer table. */
  const faceNormal = (face: Face) => {
    const { axis, plane } = LAYER[face];
    return new Vector3().setComponent(axis, plane);
  };

  const arrowMaterial = new MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0, depthTest: false, side: DoubleSide,
  });
  const arcGeometry = new TorusGeometry(1.9, 0.045, 6, 24, Math.PI / 2);
  const headGeometry = new ConeGeometry(0.16, 0.34, 12);
  const arrow = new Group();
  const arc = new Mesh(arcGeometry, arrowMaterial);
  const head = new Mesh(headGeometry, arrowMaterial);
  // Torus sweeps counter-clockwise from +x, so the head sits at the 90 degree
  // end, pointing along the tangent there.
  head.position.set(0, 1.9, 0);
  head.rotation.z = Math.PI / 2;
  arrow.add(arc, head);
  arrow.renderOrder = 1;
  arrow.visible = false;
  cube.root.add(arrow);

  /** Show the arrow on `move`'s layer, then fade it out as the turn starts. */
  function showArrow(move: Move, ms: number) {
    if (ms <= 0) return;
    const axis = faceNormal(move.layer);
    // Clockwise seen from outside the face means the arrow's plane normal
    // points *into* the cube for a normal turn, and outward for a prime.
    const facing = move.amount === 3 ? axis.clone() : axis.clone().negate();
    arrow.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), facing);
    arrow.position.copy(axis).multiplyScalar(1.62);
    arrow.visible = true;
    void run(ms, (t) => {
      // Full strength for the first third, then out of the way.
      arrowMaterial.opacity = 0.85 * (t < 0.33 ? 1 : 1 - (t - 0.33) / 0.67);
      if (t === 1) arrow.visible = false;
    });
  }

  async function turn(move: Move, ms: number) {
    stopIdle();
    const pivot = new Group();
    cube.root.add(pivot);

    const axis = AXIS[move.layer];
    const { plane } = LAYER[move.layer];
    const angle = SIGN[move.layer] * (Math.PI / 2) * (move.amount === 3 ? -1 : move.amount);
    const layer = cube.cubies.filter((c) => Math.abs(c.position[axis] - plane) < 0.1);
    // attach(), not add(): attach keeps the world transform, add would snap the
    // layer to the pivot's frame and the cube would visibly jump every turn.
    layer.forEach((c) => pivot.attach(c));

    if (ms <= 0) await flash(layer);
    showArrow(move, ms);
    await run(ms, (t) => {
      pivot.rotation[axis] = angle * easeInOutQuad(t);
    });

    pivot.rotation[axis] = angle;
    pivot.updateMatrixWorld(true);
    layer.forEach((c) => {
      cube.root.attach(c);
      // Without this, float error compounds over a hundred-move solution and
      // the cube slowly deforms.
      snapToGrid(c);
    });
    cube.root.remove(pivot);
  }

  return {
    setState(colors) {
      state = colors;
      // Turns leave the cubies rotated and reparented. Putting every one back
      // on its home cell is what makes "jump to any move" a one-liner.
      for (const cubie of cube.cubies) {
        cubie.quaternion.identity();
        cubie.position.copy(cubie.userData.home as Vector3);
      }
      cube.paint(colors, colorblind);
    },
    turn,
    lookAt(face, ms = 400) {
      const target = FACE_VIEW[face].clone().setLength(camera.position.length());
      const from = camera.position.clone();
      void run(reducedMotion ? 0 : ms, (t) => {
        camera.position.copy(from).lerp(target, easeOutCubic(t));
        controls.update();
      });
    },
    setColorblind(on) {
      colorblind = on;
      cube.paint(state, colorblind);
    },
    setPickingEnabled(on) {
      pickingEnabled = on;
    },
    onPick(handler) {
      pickHandler = handler;
    },
    dispose() {
      renderer.setAnimationLoop(null);
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

export const STAGE_BACKGROUND = SURFACE.stage;
