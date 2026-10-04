/**
 * The `monti` command line (package `bin`). `bin/monti.mjs` registers tsx and then calls it.
 *
 * - `monti init [--admin-path /admin] [--locale en] [--time-zone UTC]`: creates config and route files in a Next app and wires up tsconfig, CSS and the next config.
 * - `monti migrate [--env-file .env.local] [--no-env-file] [--config <file>] [--server <file>]`: creates the DB tables.
 */
export { type ConfigPaths, parseJsonc, resolveConfigPaths } from "./config-paths.js";
export { DEFAULT_ENV_FILES, loadEnvFiles } from "./env.js";
export { formatInitReport, type InitOptions, type InitReport, initProject } from "./init.js";
export { type MigrateOptions, migrate } from "./migrate.js";
export interface CliIo {
    readonly cwd: string;
    readonly log: (message: string) => void;
    readonly error: (message: string) => void;
}
/** Runs the command and returns the exit code. */
export declare function runCli(argv: readonly string[], io?: CliIo): Promise<number>;
