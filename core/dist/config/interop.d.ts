/**
 * Reads the default export of a config file. Where the app is compiled to CommonJS (e.g. when running the CLI with `tsx`),
 * this ES module package receives the `export default` value wrapped once more as `{ default: value }`.
 */
export declare function unwrapDefault<T>(imported: T): T;
