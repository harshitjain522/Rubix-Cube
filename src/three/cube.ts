import {
  BoxGeometry, CanvasTexture, Color, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  PlaneGeometry, SRGBColorSpace, Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { FACELETS } from '../model/facelets';
import { COLOR_FACE, CUBE_COLORS, PALETTE, SURFACE } from '../design/tokens';

/** Sticker meshes carry the facelet they show, so picking is a property read. */
export interface StickerMesh extends Mesh<PlaneGeometry, MeshBasicMaterial> {
  userData: { faceletIndex: number };
}

/**
 * Stickers are unlit and skip tone mapping, so every one of them renders the
 * exact token hex on every face of the cube. Lit + ACES turned #FDFDFB white
 * into grey and #C41E3A red into maroon, which breaks the one job this screen
 * has: matching against the plastic in someone's hand. The black body is still
 * lit, so the bevels and the gaps between stickers carry the form.
 */
const stickerMaterial = (options: ConstructorParameters<typeof MeshBasicMaterial>[0]) =>
  new MeshBasicMaterial({ ...options, toneMapped: false });

const CUBIE_SIZE = 0.98;
const STICKER_SIZE = 0.82;

/** One 128px canvas per color, carrying the face letter for colorblind mode. */
function letterMaterials(): Record<string, MeshBasicMaterial> {
  const out: Record<string, MeshBasicMaterial> = {};
  for (const color of PALETTE) {
    const hex = CUBE_COLORS[color];
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = hex;
    ctx.fillRect(0, 0, 128, 128);
    // Ink on light stickers, paper on dark ones, so the letter always reads.
    const { l } = new Color(hex).getHSL({ h: 0, s: 0, l: 0 });
    ctx.fillStyle = l > 0.55 ? SURFACE.ink : '#FFFFFF';
    ctx.font = '700 76px Archivo, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(COLOR_FACE[color], 64, 70);
    const map = new CanvasTexture(canvas);
    map.colorSpace = SRGBColorSpace;
    out[color] = stickerMaterial({ map });
  }
  return out;
}

export interface CubeMeshes {
  root: Group;
  /** Each cubie carries `userData.home`, the cell it belongs in when solved. */
  cubies: Group[];
  stickers: StickerMesh[];
  /** Flash a set of cubies. The only way a reduced-motion turn is legible. */
  highlight: MeshStandardMaterial;
  bodyMaterial: MeshStandardMaterial;
  /** Repaint every sticker from a 54-character color string. */
  paint(colors: string, colorblind: boolean): void;
  dispose(): void;
}

export function buildCube(lowDetail: boolean): CubeMeshes {
  const root = new Group();
  const bodyMaterial = new MeshStandardMaterial({ color: 0x101114, roughness: 0.72, metalness: 0 });
  const blank = stickerMaterial({ color: 0x2b2f36 });
  const highlight = new MeshStandardMaterial({ color: 0x4c5360, roughness: 0.6, metalness: 0 });
  const bodyGeometry = lowDetail
    ? new BoxGeometry(CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE)
    : new RoundedBoxGeometry(CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE, 2, 0.06);
  const stickerGeometry = new PlaneGeometry(STICKER_SIZE, STICKER_SIZE);

  const flat: Record<string, MeshBasicMaterial> = Object.fromEntries(
    Object.entries(CUBE_COLORS).map(([c, hex]) => [c, stickerMaterial({ color: hex })]),
  );
  let lettered: Record<string, MeshBasicMaterial> | null = null;

  const cubies = new Map<string, Group>();
  const stickers: StickerMesh[] = [];

  FACELETS.forEach((facelet, index) => {
    const key = facelet.pos.join(',');
    let cubie = cubies.get(key);
    if (!cubie) {
      cubie = new Group();
      cubie.position.set(facelet.pos[0], facelet.pos[1], facelet.pos[2]);
      cubie.userData = { home: cubie.position.clone() };
      cubie.add(new Mesh(bodyGeometry, bodyMaterial));
      cubies.set(key, cubie);
      root.add(cubie);
    }
    const sticker = new Mesh(stickerGeometry, blank) as StickerMesh;
    const n = new Vector3(...facelet.normal);
    sticker.position.copy(n).multiplyScalar(0.501);
    sticker.lookAt(n.clone().multiplyScalar(2));
    sticker.userData = { faceletIndex: index };
    cubie.add(sticker);
    stickers.push(sticker);
  });

  return {
    root,
    cubies: [...cubies.values()],
    stickers,
    highlight,
    bodyMaterial,
    paint(colors, colorblind) {
      if (colorblind) lettered ??= letterMaterials();
      const set = colorblind ? lettered! : flat;
      for (const sticker of stickers) {
        sticker.material = set[colors[sticker.userData.faceletIndex]] ?? blank;
      }
    },
    dispose() {
      bodyGeometry.dispose();
      stickerGeometry.dispose();
      bodyMaterial.dispose();
      blank.dispose();
      highlight.dispose();
      for (const m of [...Object.values(flat), ...Object.values(lettered ?? {})]) {
        m.map?.dispose();
        m.dispose();
      }
    },
  };
}
