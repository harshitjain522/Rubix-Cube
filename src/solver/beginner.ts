// Layer-by-layer solver that produces a *teachable* solution: longer than
// Kociemba's, but grouped into the stages a beginner is taught, in order.
//
// The classic method solves the white layer on the bottom. Our facelet frame
// has white on U, so the whole solve runs in a frame flipped 180 degrees about
// z (U<->D, L<->R) and the resulting moves are mapped back at the end. That is
// twenty lines instead of mirroring every algorithm by hand.

import {
  CORNER_NAMES, EDGE_NAMES, FACELETS, SOLVED, faceletAt, toCubies,
  type Face,
} from '../model/facelets';
import { applyMoves, normalize, parse, type Move } from '../model/moves';

// ponytail: stages 1 and 5-7 search over whole algorithms instead of matching a
// hand-built case table (7 OLL + 21 PLL cases). That is a few hundred lines
// less code for solutions around 20% longer than a tuned beginner method. Swap
// searchMacros for a case lookup if move count starts mattering more than the
// solve being teachable.

export interface Stage {
  name: string;
  goal: string;
  look: string;
  moves: Move[];
}

// --- frame flip ------------------------------------------------------------

const FLIP: Record<Face, Face> = { U: 'D', D: 'U', L: 'R', R: 'L', F: 'F', B: 'B' };

/** FLIP_SRC[j] = index whose sticker lands on j after the 180-degree z rotation. */
const FLIP_SRC = (() => {
  const src = new Array<number>(54);
  FACELETS.forEach((f, i) => {
    const p = [-f.pos[0], -f.pos[1], f.pos[2]] as const;
    const n = [-f.normal[0], -f.normal[1], f.normal[2]] as const;
    src[faceletAt(p, n)] = i;
  });
  return src;
})();

function flipState(s: string): string {
  let out = '';
  for (let j = 0; j < 54; j++) out += FLIP[s[FLIP_SRC[j]] as Face];
  return out;
}

const flipMoves = (ms: Move[]): Move[] =>
  ms.map((m) => ({ layer: FLIP[m.layer], amount: m.amount }));

// --- small helpers ---------------------------------------------------------

const RIGHT: Record<string, Face> = { F: 'R', R: 'B', B: 'L', L: 'F' };
const LEFT: Record<string, Face> = { F: 'L', L: 'B', B: 'R', R: 'F' };

const U_TURNS: Move[][] = [[], parse('U'), parse('U2'), parse("U'")];

const edgeIndex = (name: string) => EDGE_NAMES.indexOf(name as never);
const cornerIndex = (name: string) => CORNER_NAMES.indexOf(name as never);

/** Where every piece currently sits, and how it is oriented. */
function locate(s: string) {
  const { state } = toCubies(s);
  return {
    ...state,
    edgeSlot: (piece: number) => state.ep.indexOf(piece),
    edgeFlip: (piece: number) => state.eo[state.ep.indexOf(piece)],
    cornerSlot: (piece: number) => state.cp.indexOf(piece),
    cornerTwist: (piece: number) => state.co[state.cp.indexOf(piece)],
  };
}

class Run {
  state: string;
  moves: Move[] = [];
  constructor(state: string) {
    this.state = state;
  }
  do(ms: Move[] | string) {
    const list = typeof ms === 'string' ? parse(ms) : ms;
    this.state = applyMoves(this.state, list);
    this.moves.push(...list);
  }
  take(): Move[] {
    const m = this.moves;
    this.moves = [];
    return m;
  }
}

/**
 * Breadth-first search over whole algorithms rather than single turns. Every
 * stage that needs searching has a handful of legal algorithms and needs only
 * two or three of them, so this stays in the thousands of nodes.
 */
function searchMacros(
  start: string,
  goal: (s: string) => boolean,
  macros: Move[][],
  maxDepth: number,
): Move[] | null {
  if (goal(start)) return [];
  let frontier: { s: string; path: Move[] }[] = [{ s: start, path: [] }];
  const seen = new Set([start]);
  for (let depth = 0; depth < maxDepth; depth++) {
    const next: typeof frontier = [];
    for (const node of frontier) {
      for (const macro of macros) {
        const s = applyMoves(node.s, macro);
        if (seen.has(s)) continue;
        const path = [...node.path, ...macro];
        if (goal(s)) return path;
        seen.add(s);
        next.push({ s, path });
      }
    }
    frontier = next;
  }
  return null;
}

/** Iterative deepening over single turns, for the four daisy edges. */
function searchTurns(
  start: string,
  goal: (s: string) => boolean,
  maxDepth: number,
): Move[] | null {
  const layers: Face[] = ['U', 'R', 'F', 'D', 'L', 'B'];
  const path: Move[] = [];
  const dfs = (s: string, depth: number, last: Face | null): boolean => {
    if (goal(s)) return true;
    if (depth === 0) return false;
    for (const layer of layers) {
      if (layer === last) continue;
      let next = s;
      for (const amount of [1, 2, 3] as const) {
        next = applyMoves(next, [{ layer, amount: 1 }]);
        path.push({ layer, amount });
        if (dfs(next, depth - 1, layer)) return true;
        path.pop();
      }
    }
    return false;
  };
  for (let d = 0; d <= maxDepth; d++) {
    path.length = 0;
    if (dfs(start, d, null)) return [...path];
  }
  return null;
}

// --- stage tables ----------------------------------------------------------

const DAISY_EDGES = ['DF', 'DR', 'DB', 'DL'].map(edgeIndex);
const U_SLOTS = ['UR', 'UF', 'UL', 'UB'].map(edgeIndex);
const D_CORNERS = ['DFR', 'DLF', 'DBL', 'DRB'].map(cornerIndex);
/** Corner slot -> the face whose X U X' U' trigger inserts into it. */
const CORNER_TRIGGER: Record<string, Face> = { DFR: 'R', DLF: 'F', DBL: 'L', DRB: 'B' };
/** Corner slot -> the U-layer slot directly above it. */
const CORNER_ABOVE: Record<string, string> = { DFR: 'URF', DLF: 'UFL', DBL: 'ULB', DRB: 'UBR' };
const MIDDLE_EDGES = ['FR', 'FL', 'BL', 'BR'].map(edgeIndex);
/** Middle slot -> the face X whose right-hand insert fills it. */
const MIDDLE_HOST: Record<string, Face> = { FR: 'F', BR: 'R', BL: 'B', FL: 'L' };

const rightInsert = (x: Face) => `U ${RIGHT[x]} U' ${RIGHT[x]}' U' ${x}' U ${x}`;
const leftInsert = (x: Face) => `U' ${LEFT[x]}' U ${LEFT[x]} U ${x} U' ${x}'`;

const YELLOW_CROSS_ALG = parse("F R U R' U' F'");
const EDGE_CYCLE = [
  parse("R U' R U R U R U' R' U' R2"),
  parse("R2 U R U R' U' R' U' R' U R'"),
];
const CORNER_CYCLE = [parse("R U' L' U R' U' L U"), parse("U' L' U R U' L U R'")];

/**
 * The corner cycles, set up and undone with a top-layer turn. Conjugating like
 * this keeps the edges solved in step 6 exactly where step 6 left them — a
 * bare U in this stage would rotate them back out of place.
 */
const CORNER_MACROS = U_TURNS.flatMap((setup, i) =>
  CORNER_CYCLE.map((cycle) => [...setup, ...cycle, ...U_TURNS[(4 - i) % 4]]),
);

/** Is this white edge parked in the top layer with white facing up? */
function inDaisy(s: string, piece: number): boolean {
  const l = locate(s);
  const slot = l.edgeSlot(piece);
  return U_SLOTS.includes(slot) && l.eo[slot] === 0;
}

function solveFlipped(start: string): Stage[] {
  const run = new Run(start);
  const stages: Stage[] = [];
  const push = (name: string, goal: string, look: string) =>
    stages.push({ name, goal, look, moves: normalize(run.take()) });

  // 1. Daisy: the four white edges parked around the yellow center.
  for (const piece of DAISY_EDGES) {
    if (inDaisy(run.state, piece)) continue;
    const placed = DAISY_EDGES.slice(0, DAISY_EDGES.indexOf(piece));
    const found = searchTurns(
      run.state,
      (s) => inDaisy(s, piece) && placed.every((p) => inDaisy(s, p)),
      6,
    );
    if (!found) throw new Error('daisy');
    run.do(found);
  }
  push(
    'Daisy',
    'Gather the four white edges around the yellow center, white facing up.',
    'You are looking for the four edge pieces that have a white sticker. Ignore their other color for now.',
  );

  // 2. White cross: line each petal up with its center, then drop it.
  for (const piece of DAISY_EDGES) {
    const side = EDGE_NAMES[piece][1] as Face; // the non-white face of this edge
    const turn = U_TURNS.find(
      (t) => EDGE_NAMES[locate(applyMoves(run.state, t)).edgeSlot(piece)] === `U${side}`,
    );
    if (turn === undefined) throw new Error('white cross');
    run.do(turn);
    run.do(`${side}2`);
  }
  push(
    'White cross',
    'Turn each petal down into place so the white cross sits on the bottom.',
    "Match the edge's second color to the center below it, then turn that face twice.",
  );

  // 3. White corners.
  for (const piece of D_CORNERS) {
    const name = CORNER_NAMES[piece];
    const sexy = parse(`${CORNER_TRIGGER[name]} U ${CORNER_TRIGGER[name]}' U'`);
    for (let guard = 0; ; guard++) {
      const l = locate(run.state);
      if (l.cornerSlot(piece) === piece && l.cornerTwist(piece) === 0) break;
      if (guard > 24) throw new Error('white corners');
      const slot = l.cornerSlot(piece);
      if (D_CORNERS.includes(slot)) {
        // Wrong slot, or right slot but twisted: lift it out to the top layer.
        const t = CORNER_TRIGGER[CORNER_NAMES[slot]];
        run.do(`${t} U ${t}'`);
        continue;
      }
      // In the top layer: bring it above its home, then repeat the trigger.
      const turn = U_TURNS.find(
        (t) =>
          CORNER_NAMES[locate(applyMoves(run.state, t)).cornerSlot(piece)] ===
          CORNER_ABOVE[name],
      );
      if (turn === undefined) throw new Error('white corners: lost the corner');
      run.do(turn);
      run.do(sexy);
    }
  }
  push(
    'White corners',
    'Drop each white corner into the gap under it.',
    'Find a white corner in the top layer, put it directly above the gap it belongs in, and repeat the trigger until it falls in.',
  );

  // 4. Middle layer edges.
  for (const piece of MIDDLE_EDGES) {
    for (let guard = 0; ; guard++) {
      const l = locate(run.state);
      if (l.edgeSlot(piece) === piece && l.edgeFlip(piece) === 0) break;
      if (guard > 8) throw new Error('middle layer');
      const slot = l.edgeSlot(piece);
      if (MIDDLE_EDGES.includes(slot)) {
        run.do(rightInsert(MIDDLE_HOST[EDGE_NAMES[slot]])); // eject it upward
        continue;
      }
      // In the top layer. Its side sticker names the face it must meet.
      const colors = EDGE_NAMES[piece];
      const flipped = l.eo[slot] === 1;
      const sideColor = (flipped ? colors[0] : colors[1]) as Face;
      const topColor = (flipped ? colors[1] : colors[0]) as Face;
      const turn = U_TURNS.find(
        (t) =>
          EDGE_NAMES[locate(applyMoves(run.state, t)).edgeSlot(piece)] === `U${sideColor}`,
      );
      if (turn === undefined) throw new Error('middle layer: lost the edge');
      run.do(turn);
      run.do(RIGHT[sideColor] === topColor ? rightInsert(sideColor) : leftInsert(sideColor));
    }
  }
  push(
    'Middle layer',
    'Put the four edges that have no yellow into the middle band.',
    "Match an edge's front color to the center it faces, then send it left or right depending on where its other color needs to go.",
  );

  // 5. Yellow cross: orient the last-layer edges.
  {
    const found = searchMacros(
      run.state,
      (s) => U_SLOTS.every((slot) => locate(s).eo[slot] === 0),
      [...U_TURNS.slice(1), YELLOW_CROSS_ALG],
      8,
    );
    if (!found) throw new Error('yellow cross');
    run.do(found);
  }
  push(
    'Yellow cross',
    'Make a yellow cross on the top face.',
    'A dot becomes an L, an L becomes a line, a line becomes the cross. Same algorithm every time.',
  );

  // 6. Yellow edges: permute them.
  {
    const found = searchMacros(
      run.state,
      (s) => {
        const l = locate(s);
        return U_SLOTS.every((slot) => l.ep[slot] === slot && l.eo[slot] === 0);
      },
      [...U_TURNS.slice(1), ...EDGE_CYCLE],
      6,
    );
    if (!found) throw new Error('yellow edges');
    run.do(found);
  }
  push(
    'Yellow edges',
    'Slide the yellow edges around until each meets its own center.',
    'Line up the one edge that is already home, then cycle the other three.',
  );

  // 7. Yellow corners: right places, twist comes last.
  {
    const found = searchMacros(
      run.state,
      (s) => {
        const l = locate(s);
        return [0, 1, 2, 3].every((slot) => l.cp[slot] === slot);
      },
      CORNER_MACROS,
      4,
    );
    if (!found) throw new Error('yellow corners');
    run.do(found);
  }
  push(
    'Yellow corners',
    'Get every corner to the right spot, even if it is facing the wrong way.',
    'One corner is usually already in the right place. Hold it still and cycle the other three.',
  );

  // 8. Final twist.
  for (let i = 0; i < 4; i++) {
    // Two repeats twist the corner in place by a third; an odd number leaves a
    // different corner sitting in the slot, so always go in pairs. Twisting the
    // short way round saves eight moves whenever the corner is off by two.
    for (let guard = 0; ; guard++) {
      const twist = locate(run.state).co[0];
      if (twist === 0) break;
      if (guard > 2) throw new Error('final twist');
      run.do(twist === 1 ? "R' D' R D R' D' R D" : "D' R' D R D' R' D R");
    }
    run.do('U');
  }
  push(
    'Final twist',
    'Twist the last corners upright without breaking the cube underneath.',
    'It will look destroyed while you do this. Keep going — the layers underneath come back.',
  );

  return stages.filter((s) => s.moves.length > 0);
}

export function solveBeginner(facelets: string): Stage[] {
  if (facelets === SOLVED) return [];
  return solveFlipped(flipState(facelets)).map((s) => ({
    ...s,
    moves: flipMoves(s.moves),
  }));
}
