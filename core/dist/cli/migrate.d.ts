import { type AppOptions } from "./app.js";
export type MigrateOptions = AppOptions;
/**
 * `monti migrate`: reads env files, loads the app's CMS instance (`monti.config.ts`) and creates the tables in the store.
 * TypeScript files are read by tsx, which the command (`bin/monti.mjs`) registers first. Returns `true` on success.
 */
export declare function migrate(options: MigrateOptions): Promise<boolean>;
