/** Reads JSON with comments and trailing commas (tsconfig). Leaves `//` and `/*` inside strings alone. `undefined` if it cannot be read. */
export declare function parseJsonc(text: string): unknown;
/** Candidate locations of the config file, the module that exports the CMS instance as `cms`. */
export declare const CONFIG_CANDIDATES: readonly ["monti.config.ts", "src/monti.config.ts"];
/**
 * Location of the config file (`monti.config.ts`, the module that exports the CMS instance as `cms`). Looked up in this order: the chosen value
 * (`--config`) -> the `MONTI_CONFIG_PATH` environment variable -> common locations (`./monti.config.ts`, `./src/monti.config.ts`). Relative to `cwd`.
 * It is an error if the file is missing.
 */
export declare function resolveConfigPath(cwd: string, chosen?: string | undefined, env?: Record<string, string | undefined>): string;
