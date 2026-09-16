declare module 'cubejs/lib/cube.js' {
  export default class Cube {
    static initSolver(): void;
    static fromString(facelets: string): Cube;
    solve(maxDepth?: number): string;
  }
}
