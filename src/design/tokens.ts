// Shared truth for the six cube colors. The DOM and WebGL both read these; if
// they ever disagree the net and the 3D cube stop matching and the user stops
// trusting either.

import type { Color, Face } from '../model/facelets';

export const CUBE_COLORS: Record<Color, string> = {
  W: '#FDFDFB',
  Y: '#FFD500',
  R: '#C41E3A',
  O: '#FF5800',
  G: '#009E60',
  B: '#0051BA',
};

export const COLOR_LABEL: Record<Color, string> = {
  W: 'white', Y: 'yellow', R: 'red', O: 'orange', G: 'green', B: 'blue',
};

/** The orientation convention the whole app states once and then relies on. */
export const FACE_COLOR: Record<Face, Color> = {
  U: 'W', R: 'R', F: 'G', D: 'Y', L: 'O', B: 'B',
};

/** Reverse of FACE_COLOR: which face a color names under our convention. */
export const COLOR_FACE = Object.fromEntries(
  Object.entries(FACE_COLOR).map(([face, color]) => [color, face]),
) as Record<Color, Face>;

/** Palette order, and therefore the keyboard shortcuts 1-6. */
export const PALETTE: Color[] = ['W', 'Y', 'R', 'O', 'G', 'B'];

export const FACE_LABEL: Record<Face, string> = {
  U: 'Up', R: 'Right', F: 'Front', D: 'Down', L: 'Left', B: 'Back',
};

export const SURFACE = {
  /** The recessed well the cube sits in. Warm, so it reads as shadow cast by
   *  the tray rather than as a separate dark-mode panel. It stays dark for one
   *  functional reason: white stickers need an edge to hold against. */
  stage: '#26241F',
  /** The moulded tray everything else sits on. */
  sheet: '#D5D3CC',
  ink: '#191713',
  /** 4.8:1 on the tray. */
  muted: '#5A5750',
  rule: '#BEBBB2',
  stageRule: '#3A372F',
};
