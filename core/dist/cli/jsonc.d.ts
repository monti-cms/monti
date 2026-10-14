/** Reads JSON with comments and trailing commas (tsconfig). Leaves `//` and `/*` inside strings alone. `undefined` if it cannot be read. */
export declare function parseJsonc(text: string): unknown;
