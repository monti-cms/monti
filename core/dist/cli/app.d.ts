import type { Cms } from "../cms/index.js";
/** What the commands that run against the app's own configuration (`migrate`) take. */
export interface AppOptions {
    readonly cwd: string;
    /** Env files to read. If unset, `.env.local` and `.env` (only those that exist); an empty array reads none. */
    readonly envFiles?: readonly string[];
    /** Config file (`monti.config.ts`): the module that exports the CMS instance. */
    readonly config?: string;
    readonly log?: (message: string) => void;
}
/**
 * Loads the config file (a path relative to `cwd`) and returns the CMS instance it exports (`export const cms = defineConfig({ ... })`, or as the default
 * export). TypeScript files are read by tsx, which the command (`bin/monti.mjs`) registers first. The environment must already hold the values the file reads.
 */
export declare function importCms(cwd: string, configPath: string): Promise<Cms>;
/**
 * Reads env files, then loads the app's config file and returns the CMS instance it exports (see {@link importCms}).
 */
export declare function loadApp(options: AppOptions): Promise<Cms>;
