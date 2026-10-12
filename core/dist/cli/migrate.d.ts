import { type AppOptions } from "./app.js";
export interface MigrateOptions extends AppOptions {
    /** List every body that could not be read, and the other per-body detail, instead of a short summary. */
    readonly verbose?: boolean;
    /** Read the bodies kept as unreadable again, with the config as it is now. */
    readonly reconvertBodies?: boolean;
}
/**
 * Writes the full per-body detail of a migration to `.monti/logs/migrate-<time>.log` under `cwd` and returns that path relative to `cwd` (with `/`).
 * Called only when there is something to report, so a clean run leaves no file.
 */
export declare function writeMigrateLog(cwd: string, lines: readonly string[], now?: Date): string;
/**
 * `monti migrate`: reads env files, loads the app's CMS instance (`monti.config.ts`) and creates the tables in the store.
 * TypeScript files are read by tsx, which the command (`bin/monti.mjs`) registers first. Returns `true` on success.
 */
export declare function migrate(options: MigrateOptions): Promise<boolean>;
