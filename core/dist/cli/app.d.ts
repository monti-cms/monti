import type { Cms } from "../cms/index.js";
import type { AppFlags, CliContext } from "./command.js";
/** What the commands that run against the app's own configuration (`db:migrate`, `events:retry`, ...) take: the context, and the app options. */
export interface AppOptions extends CliContext, AppFlags {
    /** Do not print the `env:` and `config:` lines (the commands that open with a line of their own). */
    readonly quiet?: boolean;
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
