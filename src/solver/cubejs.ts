// cubejs ships two CommonJS files written for a browser <script> tag:
// lib/solve.js starts with `Cube = this.Cube || require('./cube')`. In a CJS
// module `this` is `exports`; every ES bundler (Vite/rolldown included) gives
// the wrapper a top-level `this` of `undefined`, so that line throws
// "Cannot read properties of undefined (reading 'Cube')" and the worker dies
// before it ever handles a message. Running the file ourselves with a real
// receiver is the whole fix.
//
// ponytail: uses new Function, so a page served with a strict CSP (no
// 'unsafe-eval') would break. Vendor lib/solve.js with that one line edited
// if a CSP ever lands.
import Cube from 'cubejs/lib/cube.js';
import solveSource from 'cubejs/lib/solve.js?raw';

new Function(solveSource).call({ Cube });

export default Cube;
