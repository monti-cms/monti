/** Config alias names. CMS code reads the two config files through these names. */
export declare const CONFIG_ALIAS = "@cms-config";
export declare const SERVER_ALIAS = "@cms-server";
/** Reads JSON with comments and trailing commas (tsconfig). Leaves `//` and `/*` inside strings alone. `undefined` if it cannot be read. */
export declare function parseJsonc(text: string): unknown;
/** Alias file listed in tsconfig `paths` (relative to `cwd`). `undefined` if none. */
export declare function tsconfigAliasPath(cwd: string, alias: string): string | undefined;
export interface ConfigPaths {
    /** Site config file (relative to `cwd`). */
    readonly config: string;
    /** Server config file (relative to `cwd`). */
    readonly server: string;
}
/**
 * Locations of the two config files. Looked up in this order: the chosen value (`--config`, `--server`) -> environment variable (`CMS_CONFIG_PATH`, `CMS_SERVER_PATH`) -> the tsconfig `paths`
 * alias -> common locations (`./cms.config.ts`, `./src/cms.config.ts`). It is an error if the file is missing.
 */
export declare function resolveConfigPaths(cwd: string, chosen?: {
    config?: string;
    server?: string;
}, env?: Record<string, string | undefined>): ConfigPaths;
