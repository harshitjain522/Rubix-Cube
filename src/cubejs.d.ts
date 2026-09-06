declare module 'cubejs' {
  export default class Cube {
    static initSolver(): void;
    static fromString(facelets: string): Cube;
    solve(maxDepth?: number): string;
    asString(): string;
  }
}

declare module 'cubejs/lib/cube.js' {
  export { default } from 'cubejs';
}
