// The scene and the model must agree about which way a layer turns. A sign
// error here shows the user a cube turning the wrong way while the solution
// underneath is still correct, which is the worst kind of wrong. This drives
// the renderer's real pivot-group turn (no WebGL needed) and checks it against
// the facelet permutation table.

import { describe, expect, it } from 'vitest';
import { Group, Object3D, Vector3 } from 'three';
import { FACELETS, FACES, faceletAt, type V3 } from '../model/facelets';
import { permutationFor, type Amount, type Move } from '../model/moves';
import { beginTurn, isTap } from './renderer';

function buildScene() {
  const root = new Group();
  const cubies = new Map<string, Group>();
  const markers = FACELETS.map((facelet, index) => {
    const key = facelet.pos.join(',');
    let cubie = cubies.get(key);
    if (!cubie) {
      cubie = new Group();
      cubie.position.set(...facelet.pos);
      cubies.set(key, cubie);
      root.add(cubie);
    }
    const object = new Object3D();
    object.position.set(...facelet.normal);
    cubie.add(object);
    return { object, cubie, facelet: index };
  });
  return { root, cubies: [...cubies.values()], markers };
}

function turn(root: Group, cubies: Group[], move: Move) {
  beginTurn(root, cubies, move).finish();
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

  it('leaves every cubie exactly on the grid after a hundred turns', () => {
    const { root, cubies } = buildScene();
    for (let i = 0; i < 100; i++) {
      turn(root, cubies, { layer: FACES[i % 6], amount: ((i % 3) + 1) as Amount });
    }
    for (const cubie of cubies) {
      for (const v of [...cubie.position.toArray(), ...cubie.quaternion.toArray()]) {
        expect(Math.abs(v * 2 - Math.round(v * 2)) < 1e-9 || Math.abs(Math.abs(v) - Math.SQRT1_2) < 1e-9).toBe(true);
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
