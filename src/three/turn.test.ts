// The scene and the model must agree about which way a layer turns. A sign
// error here shows the user a cube turning the wrong way while the solution
// underneath is still correct, which is the worst kind of wrong. This rebuilds
// the renderer's pivot-group turn with real three.js math (no WebGL needed)
// and checks it against the facelet permutation table.

import { describe, expect, it } from 'vitest';
import { Group, Object3D, Vector3 } from 'three';
import { FACELETS, FACES, LAYER, faceletAt, type V3 } from '../model/facelets';
import { permutationFor, type Amount, type Move } from '../model/moves';
import { isTap } from './renderer';

const AXIS = { U: 'y', D: 'y', R: 'x', L: 'x', F: 'z', B: 'z' } as const;
const SIGN = { U: -1, D: 1, R: -1, L: 1, F: -1, B: 1 } as const;

function buildScene() {
  const root = new Group();
  const cubies = new Map<string, Group>();
  const markers: { object: Object3D; cubie: Group; facelet: number }[] = [];

  FACELETS.forEach((facelet, index) => {
    const key = facelet.pos.join(',');
    let cubie = cubies.get(key);
    if (!cubie) {
      cubie = new Group();
      cubie.position.set(...(facelet.pos as unknown as [number, number, number]));
      cubies.set(key, cubie);
      root.add(cubie);
    }
    const marker = new Object3D();
    marker.position.set(...(facelet.normal as unknown as [number, number, number]));
    cubie.add(marker);
    markers.push({ object: marker, cubie, facelet: index });
  });
  return { root, cubies: [...cubies.values()], markers };
}

function turn(root: Group, cubies: Group[], move: Move) {
  const pivot = new Group();
  root.add(pivot);
  const axis = AXIS[move.layer];
  const { plane } = LAYER[move.layer];
  const angle = SIGN[move.layer] * (Math.PI / 2) * (move.amount === 3 ? -1 : move.amount);
  const layer = cubies.filter((c) => Math.abs(c.position[axis] - plane) < 0.1);
  layer.forEach((c) => pivot.attach(c));
  pivot.rotation[axis] = angle;
  pivot.updateMatrixWorld(true);
  layer.forEach((c) => root.attach(c));
  root.remove(pivot);
  root.updateMatrixWorld(true);
}

const round = (v: Vector3): V3 => [Math.round(v.x), Math.round(v.y), Math.round(v.z)];

describe('layer rotation', () => {
  const moves: Move[] = FACES.flatMap((layer) =>
    ([1, 2, 3] as Amount[]).map((amount) => ({ layer, amount })),
  );

  it.each(moves)('animates $layer$amount the way the model permutes it', (move) => {
    const { root, cubies, markers } = buildScene();
    turn(root, cubies, move);

    const perm = permutationFor(move);
    for (const { object, cubie, facelet } of markers) {
      const centre = cubie.getWorldPosition(new Vector3());
      const normal = object.getWorldPosition(new Vector3()).sub(centre);
      const landed = faceletAt(round(centre), round(normal));
      // The sticker that started at `facelet` now occupies `landed`, which is
      // exactly what perm[landed] === facelet means.
      expect(perm[landed]).toBe(facelet);
    }
  });

  it('leaves every cubie on a lattice point after a hundred turns', () => {
    const { root, cubies } = buildScene();
    for (let i = 0; i < 100; i++) {
      turn(root, cubies, {
        layer: FACES[i % 6],
        amount: ((i % 3) + 1) as Amount,
      });
    }
    for (const cubie of cubies) {
      for (const value of [cubie.position.x, cubie.position.y, cubie.position.z]) {
        expect(Math.abs(value - Math.round(value))).toBeLessThan(1e-6);
      }
    }
  });
});

// Orbiting the cube must never paint a sticker, because painting is the only
// thing that rewrites the shareable URL. If this heuristic goes, a link you
// copied starts changing under you every time you spin the cube to look at it.
describe('picking versus orbiting', () => {
  const from = { x: 200, y: 200 };

  it('picks a sticker only when the pointer stayed put', () => {
    expect(isTap(from, { x: 200, y: 200 })).toBe(true);
    expect(isTap(from, { x: 203, y: 201 })).toBe(true);
    expect(isTap(from, { x: 204, y: 203 })).toBe(true); // 5px away, still a tap
  });

  it('reads anything further as an orbit', () => {
    expect(isTap(from, { x: 206, y: 200 })).toBe(false);
    expect(isTap(from, { x: 200, y: 260 })).toBe(false);
    expect(isTap(from, { x: 140, y: 140 })).toBe(false);
  });
});
